import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DetailApiResponse,
  DetailMaterial,
} from '../models/detail-api-response';

@Injectable()
export class ProcessMaterialsStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (
      !context.state.materialsIds ||
      context.state.materialsIds.length === 0
    ) {
      this.logger.log('No material IDs to process');
      return true;
    }

    try {
      // Use the API config from previous step
      if (!context.state.apiConfig) {
        throw new Error('API configuration is missing');
      }

      const { headers } = context.state.apiConfig;
      const baseDetailUrl =
        'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/detail';

      this.logger.log(
        `Processing ${context.state.materialsIds.length} materials in parallel`,
      );

      // Set batch size to control concurrency
      const batchSize = 5; // Process 5 materials at a time to avoid rate limiting
      const materialIds = [...context.state.materialsIds];
      const results: DetailMaterial[] = [];

      // Initialize current page for dynamic delay calculation
      let currentPage = 0;

      // Process materials in batches
      while (materialIds.length > 0) {
        const batch = materialIds.splice(0, batchSize);
        currentPage++;

        // Calculate dynamic delay for current page
        const dynamicDelay = Math.min(500 + (currentPage - 1) * 100, 2000);
        this.logger.debug(
          `Using dynamic delay of ${dynamicDelay}ms for page ${currentPage}`,
        );

        // Process batch in parallel
        const batchPromises = batch.map((materialId) =>
          this.processMaterial(materialId, baseDetailUrl, headers, currentPage),
        );
        const batchResults = await Promise.all(batchPromises);

        // Filter out failures and add successful results
        const validResults = batchResults.filter((result) => result !== null);
        results.push(...validResults);

        // Add a dynamic delay between batches to prevent rate limiting
        if (materialIds.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
        }
      }

      // Add processed materials to collected ads
      context.state.adsCollected.push(...results);
      this.logger.log(`Materials IDs:`, {
        materialsIds: context.state.materialsIds,
        // adsCollected: context.state.adsCollected,
      });

      this.logger.log(
        `Successfully processed ${results.length} materials out of ${context.state.materialsIds.length}`,
      );
      context.state.materialsIds = [];

      // Check if max ads limit is reached
      const maxAds = context.options.behavior?.maxAdsToCollect || 200;
      if (context.state.adsCollected.length >= maxAds) {
        this.logger.log(`Reached maximum of ${maxAds} ads to collect`);
        context.state.hasMoreResults = false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Process a single material by making an API request
   */
  private async processMaterial(
    materialId: string,
    baseUrl: string,
    headers: Record<string, string>,
    pageNumber: number = 1,
  ): Promise<DetailMaterial | null> {
    try {
      // Create URL with material_id parameter
      const url = new URL(baseUrl);
      url.searchParams.set('material_id', materialId);

      this.logger.debug(
        `Processing material: ${materialId} on page ${pageNumber}`,
      );

      // Calculate dynamic delay for individual request based on page number
      const requestDelay = Math.min(500 + (pageNumber - 1) * 100, 2000);

      // Apply delay before making the request
      await new Promise((resolve) => setTimeout(resolve, requestDelay));

      // Make the request for material details
      const response = await firstValueFrom(
        this.httpService.get<DetailApiResponse>(url.toString(), { headers }),
      );

      // Check if the request was successful and data exists
      if (response.status === 200 && response.data?.data) {
        return this.mapResponseToAdData(materialId, response.data.data);
      } else {
        this.logger.warn(`Invalid response for material ${materialId}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error processing material ${materialId}:`, error);
      return null;
    }
  }

  /**
   * Map the TikTok API response to our AdData format
   */
  private mapResponseToAdData(
    materialId: string,
    data: DetailMaterial,
  ): DetailMaterial {
    return {
      id: materialId,
      ad_title: data.ad_title || '',
      brand_name: data.brand_name || '',
      comment: data.comment || 0,
      cost: data.cost || 0,
      country_code: data.country_code || [],
      ctr: data.ctr || 0,
      favorite: data.favorite || false,
      has_summary: data.has_summary || false,
      highlight_text: data.highlight_text || '',
      industry_key: data.industry_key || '',
      is_search: data.is_search || false,
      keyword_list: data.keyword_list || [],
      landing_page: data.landing_page || '',
      like: data.like || 0,
      objective_key: data.objective_key || '',
      objectives: data.objectives || [],
      pattern_label: data.pattern_label || [],
      share: data.share || 0,
      source: data.source || '',
      source_key: data.source_key || 0,
      tag: data.tag || 0,
      video_info: {
        vid: data.video_info?.vid || '',
        duration: data.video_info?.duration || 0,
        cover: data.video_info?.cover || '',
        video_url: data.video_info?.video_url || {},
        width: data.video_info?.width || 0,
        height: data.video_info?.height || 0,
      },
      voice_over: data.voice_over || false,
    };
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    return Promise.resolve(
      !!context.state.materialsIds && context.state.materialsIds.length > 0,
    );
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}
