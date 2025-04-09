/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';

import { IScraper } from '../common/interfaces';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { TiktokLibraryQuery } from './models/tiktok-library-query';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { IBaseScraperResult } from '../common/interfaces/base-scraper-result';
import { DetailMaterial } from './models/detail-api-response';
import { TikTokAdData } from './models/tiktok-ad-data';

@Injectable()
export class TiktokApiScraper
  implements IScraper<TiktokLibraryQuery, TikTokAdData>
{
  private readonly logger = new Logger(TiktokApiScraper.name);

  constructor(
    private readonly queryTransformer: TiktokQueryTransformer,
    private readonly scraperFactory: TikTokScraperFactory,
  ) {}

  async scrape(
    request: RequestMetadata<any>,
  ): Promise<IBaseScraperResult<TikTokAdData>> {
    const startTime = Date.now();

    // Cast to TiktokLibraryQuery if needed or extract from request parameters
    let query: TiktokLibraryQuery;

    if (this.isTiktokLibraryQuery(request.parameters)) {
      // If parameters directly match TiktokLibraryQuery format
      query = this.buildQuery(request.parameters);
    } else if (
      request.parameters?.query &&
      this.isTiktokLibraryQuery(request.parameters.query)
    ) {
      // If parameters have a query object that matches TiktokLibraryQuery format
      query = this.buildQuery(request.parameters.query);
    } else {
      // Default fallback with error
      this.logger.error('Invalid TikTok query parameters', request.parameters);
      return {
        success: false,
        errors: [new Error('Invalid TikTok query parameters')],
        ads: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const scraper = this.scraperFactory.createScraper();
      const context = this.scraperFactory.createContext(
        query,
        typeof request.parameters === 'object' ? request.parameters : {},
      );
      const result = await scraper.execute(context);
      const adsData = this.mapResultToAdData(result.ads as DetailMaterial[]);

      console.log('result', result);

      return {
        success: result.success,
        errors: result.errors,
        ads: adsData,
        totalCount: adsData.length,
        executionTime: Date.now() - startTime,
        outputPath: result.outputPath,
        includeAdsInResponse: result.includeAdsInResponse,
        hasMoreResults: false,
        currentPage: 0,
      };
    } catch (error) {
      this.logger.error('Error scraping TikTok ads', error);
      return {
        success: false,
        errors: [error instanceof Error ? error : new Error('Unknown error')],
        ads: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  // Type guard to check if an object is a TiktokLibraryQuery
  private isTiktokLibraryQuery(obj: unknown): obj is TiktokLibraryQuery {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'queryString' in obj &&
      'period' in obj &&
      'orderBy' in obj
    );
  }

  private buildQuery(parameters: TiktokLibraryQuery): TiktokLibraryQuery {
    return this.queryTransformer.transform(parameters);
  }

  private mapResultToAdData(materials: DetailMaterial[]): TikTokAdData[] {
    return materials.map((material) => ({
      id: material.id,
      ad_title: material.ad_title,
      brand_name: material.brand_name,
      cost: material.cost,
      ctr: material.ctr,
      favorite: material.favorite,
      industry_key: material.industry_key,
      is_search: material.is_search,
      like: material.like,
      objective_key: material.objective_key,
      tag: material.tag,
      video_info: {
        vid: material.video_info.vid,
        duration: material.video_info.duration,
        height: material.video_info.height,
        width: material.video_info.width,
        cover: material.video_info.cover,
        video_url: material.video_info.video_url,
      },
    }));
  }
}
