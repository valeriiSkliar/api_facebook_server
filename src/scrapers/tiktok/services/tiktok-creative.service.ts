/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { Prisma, DetailMaterial } from '@prisma/client';

// Define a type for DetailMaterial that includes videoInfo
// type DetailMaterialWithVideoInfo = Prisma.DetailMaterialGetPayload<{
//   include: { videoInfo: true };
// }>;

// Import the actual type from models
import { DetailMaterial as DetailMaterialModel } from '../models/detail-api-response';

@Injectable()
export class TiktokCreativeService {
  private readonly logger = new Logger(TiktokCreativeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveCreatives(adsData: DetailMaterialModel[]): Promise<void> {
    this.logger.log(`Attempting to save ${adsData.length} creatives.`);

    // Deduplicate the ads data based on id to avoid unique constraint violations
    const uniqueAdsMap = new Map<string, DetailMaterialModel>();
    for (const adData of adsData) {
      if (!uniqueAdsMap.has(adData.id)) {
        uniqueAdsMap.set(adData.id, adData);
      }
    }

    const uniqueAdsData = Array.from(uniqueAdsMap.values());
    this.logger.log(
      `Removed duplicates. Processing ${uniqueAdsData.length} unique creatives.`,
    );

    const createPromises: Prisma.PrismaPromise<DetailMaterial>[] = [];

    for (const adData of uniqueAdsData) {
      // Access video_info properly (using the API response format from DetailMaterialModel)
      const videoUrl = adData.video_info?.video_url?.['720p'] ?? '';
      const vid = adData.video_info?.vid ?? '';

      // Skip entries with empty vid to prevent constraint errors
      if (!vid) {
        this.logger.warn(`Skipping ad ${adData.id} due to missing video ID`);
        continue;
      }

      // Get highlight text and truncate if needed
      const MAX_HIGHLIGHT_TEXT_LENGTH = 191; // Same safe limit
      const highlightText = (adData.highlight_text ?? '').slice(
        0,
        MAX_HIGHLIGHT_TEXT_LENGTH,
      );

      const detailMaterialData: Omit<
        Prisma.DetailMaterialCreateInput,
        'countryCodes' | 'keywords' | 'objectives' | 'patterns' | 'videoInfo'
      > = {
        id: adData.id,
        adTitle: (adData.ad_title ?? '').slice(0, 255),
        brandName: (adData.brand_name ?? '').slice(0, 255),
        comment: adData.comment ?? 0,
        cost: adData.cost ?? 0,
        ctr: adData.ctr ?? 0,
        favorite: adData.favorite ?? false,
        hasSummary: adData.has_summary ?? false,
        highlightText: highlightText,
        industryKey: (adData.industry_key ?? '').slice(0, 100),
        isSearch: adData.is_search ?? false,
        landingPage: adData.landing_page ?? '',
        like: adData.like ?? 0,
        objectiveKey: (adData.objective_key ?? '').slice(0, 100),
        share: adData.share ?? 0,
        source: 'tiktok',
        sourceKey: 0,
        tag: adData.tag ?? 0,
        voiceOver: adData.voice_over ?? false,
      };

      try {
        // First check if a VideoInfo with this vid already exists
        const existingVideoInfo = await this.prisma.videoInfo.findUnique({
          where: { vid },
        });

        if (existingVideoInfo) {
          // If VideoInfo exists but is attached to a different DetailMaterial, we need a different approach
          if (existingVideoInfo.detailMaterialId !== adData.id) {
            this.logger.warn(
              `VideoInfo with vid ${vid} already exists for a different material. Using a different transaction approach.`,
            );

            // Update the DetailMaterial first
            await this.prisma.detailMaterial.upsert({
              where: { id: adData.id },
              create: {
                ...detailMaterialData,
                countryCodes: { create: [] },
                keywords: { create: [] },
                objectives: { create: [] },
                patterns: { create: [] },
              },
              update: detailMaterialData,
            });

            continue; // Skip adding to createPromises
          }
        }

        // Create VideoInfo with camelCase field names
        // Apply limits to text fields in VideoInfo
        const MAX_COVER_URL_LENGTH = 1000; // Adjust based on your schema (TEXT column can store a lot)
        const MAX_VIDEO_URL_LENGTH = 1000; // Adjust based on your schema

        const videoInfoData: Prisma.VideoInfoCreateWithoutDetailMaterialInput =
          {
            vid,
            cover: (adData.video_info?.cover ?? '').slice(
              0,
              MAX_COVER_URL_LENGTH,
            ),
            duration: adData.video_info?.duration ?? 0,
            height: adData.video_info?.height ?? 0,
            width: adData.video_info?.width ?? 0,
            videoUrl720p: videoUrl.slice(0, MAX_VIDEO_URL_LENGTH),
          };

        createPromises.push(
          this.prisma.detailMaterial.upsert({
            where: { id: adData.id },
            create: {
              ...detailMaterialData,
              videoInfo: {
                create: videoInfoData,
              },
              countryCodes: { create: [] },
              keywords: { create: [] },
              objectives: { create: [] },
              patterns: { create: [] },
            },
            update: {
              ...detailMaterialData,
              videoInfo: {
                upsert: {
                  create: videoInfoData,
                  update: videoInfoData,
                },
              },
            },
          }),
        );
      } catch (error) {
        this.logger.error(`Error preparing upsert for ad ${adData.id}:`, error);
      }
    }

    try {
      if (createPromises.length > 0) {
        const results = await this.prisma.$transaction(createPromises);
        this.logger.log(
          `Successfully saved or updated ${results.length} creatives.`,
        );
      } else {
        this.logger.log('No creatives to save after filtering.');
      }
    } catch (error) {
      const prismaError = error as Error;
      this.logger.error(
        'Error saving creatives to database',
        prismaError.stack,
      );

      // Try saving one by one to identify which creatives are causing issues
      this.logger.log('Attempting to save creatives individually...');
      let successCount = 0;

      for (let i = 0; i < createPromises.length; i++) {
        try {
          await createPromises[i];
          successCount++;
        } catch (individualError) {
          this.logger.error(
            `Failed to save creative at index ${i}:`,
            individualError,
          );
        }
      }

      this.logger.log(
        `Individually saved ${successCount} out of ${createPromises.length} creatives.`,
      );
    }
  }
}
