/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { AdData } from '../models/facebook-ad-data';

@Injectable()
export class FacebookCreativeService {
  private readonly logger = new Logger(FacebookCreativeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save Facebook ad creatives to the database
   * @param adsData Array of Facebook ad data to save
   */
  async saveCreatives(adsData: AdData[]): Promise<void> {
    this.logger.log(
      `[FacebookCreativeService] Attempting to save ${adsData.length} Facebook creatives.`,
    );

    // Deduplicate ads based on adArchiveId to avoid unique constraint violations
    const uniqueAdsMap = new Map<string, AdData>();
    for (const adData of adsData) {
      if (!uniqueAdsMap.has(adData.adArchiveId)) {
        uniqueAdsMap.set(adData.adArchiveId, adData);
      }
    }

    const uniqueAdsData = Array.from(uniqueAdsMap.values());
    this.logger.log(
      `[FacebookCreativeService] Removed duplicates. Processing ${uniqueAdsData.length} unique Facebook creatives.`,
    );

    try {
      // Process ads in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < uniqueAdsData.length; i += batchSize) {
        const batch = uniqueAdsData.slice(i, i + batchSize);
        await this.processBatch(batch);
        this.logger.log(
          `[FacebookCreativeService] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            uniqueAdsData.length / batchSize,
          )}`,
        );
      }

      this.logger.log(
        `[FacebookCreativeService] Successfully saved ${uniqueAdsData.length} Facebook creatives.`,
      );
    } catch (error) {
      const prismaError = error as Error;
      this.logger.error(
        '[FacebookCreativeService] Error saving Facebook creatives to database',
        prismaError.stack,
      );
    }
  }

  /**
   * Process a batch of ad data and save to database
   * @param batch Array of ad data to process
   */
  private async processBatch(batch: AdData[]): Promise<void> {
    const createPromises = batch.map((adData) => this.createOrUpdateAd(adData));
    await Promise.all(createPromises);
  }

  /**
   * Create or update a single Facebook ad
   * @param adData The ad data to save
   */
  private async createOrUpdateAd(adData: AdData): Promise<void> {
    try {
      // Convert Unix timestamp to Date
      const startDate = new Date(adData.startDate * 1000);
      const endDate = new Date(adData.endDate * 1000);

      // Create the base Facebook ad material
      await this.prisma.facebookAdMaterial.upsert({
        where: { adArchiveId: adData.adArchiveId },
        create: {
          id: adData.adArchiveId, // Using adArchiveId as the primary ID
          adArchiveId: adData.adArchiveId,
          adId: adData.adId || null,
          pageId: adData.pageId,
          pageName: adData.pageName,
          startDate,
          endDate,
          status: adData.status,
          platforms: {
            create: adData.publisherPlatform.map((platform) => ({
              platform,
            })),
          },

          // Add caption, CTA, and link information if available in snapshot
          caption: adData.snapshot?.caption || null,
          ctaText: adData.snapshot?.cta_text || null,
          ctaType: adData.snapshot?.cta_type || null,
          linkDescription: adData.snapshot?.link_description || null,
          linkUrl: adData.snapshot?.link_url || null,

          // Add categories if available
          categories: {
            create: (adData.snapshot?.page_categories || []).map(
              (category) => ({
                category,
              }),
            ),
          },

          // Create related entities
          body: adData.snapshot?.body?.text
            ? {
                create: {
                  text: adData.snapshot.body.text,
                },
              }
            : undefined,

          // Process images if available
          images: adData.snapshot?.images?.length
            ? {
                create: adData.snapshot.images
                  .filter((img) => img.url)
                  .map((img) => ({
                    url: img.url,
                  })),
              }
            : undefined,

          // Process videos if available
          videos: adData.snapshot?.videos?.length
            ? {
                create: adData.snapshot.videos
                  .filter((vid) => vid.url)
                  .map((vid) => ({
                    url: vid.url,
                    thumbnailUrl: vid.thumbnail_url || null,
                    duration: vid.duration || null,
                    width: vid.width || null,
                    height: vid.height || null,
                  })),
              }
            : undefined,
        },
        update: {
          // Update fields that might change
          status: adData.status,
          endDate,
          platforms: {
            create: adData.publisherPlatform.map((platform) => ({
              platform,
            })),
          },

          // Update the body if it exists
          body: adData.snapshot?.body?.text
            ? {
                upsert: {
                  create: { text: adData.snapshot.body.text },
                  update: { text: adData.snapshot.body.text },
                },
              }
            : undefined,

          // For images and videos, we don't update existing records
          // as the strategy here is to avoid duplicates, not modify them
        },
      });
    } catch (error) {
      this.logger.error(
        `[FacebookCreativeService] Error processing Facebook ad ${adData.adArchiveId}:`,
        error,
      );
      throw error;
    }
  }
}
