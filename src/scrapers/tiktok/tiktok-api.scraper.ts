/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';

import { IScraper } from '../common/interfaces';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { TiktokLibraryQuery } from './models/tiktok-library-query';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { IBaseScraperResult } from '../common/interfaces/base-scraper-result';
import { AdData } from '../facebook/models/facebook-ad-data';

@Injectable()
export class TiktokApiScraper implements IScraper<TiktokLibraryQuery, AdData> {
  private readonly logger = new Logger(TiktokApiScraper.name);

  constructor(
    private readonly queryTransformer: TiktokQueryTransformer,
    private readonly scraperFactory: TikTokScraperFactory,
  ) {}

  async scrape(
    request: RequestMetadata<any>,
  ): Promise<IBaseScraperResult<AdData>> {
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

      console.log('result', result);

      return await Promise.resolve({
        success: false,
        errors: [new Error('Not implemented')],
        ads: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
      });
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
}
