/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';

import { IScraper } from '../common/interfaces';
import { ScraperResult } from '../facebook/models/facebook-scraper-result';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { TiktokLibraryQuery } from './models/tiktok-library-query';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TiktokScraperOptionsDto } from './dto/tiktok-scraper-options.dto';

@Injectable()
export class TiktokApiScraper implements IScraper<TiktokScraperOptionsDto> {
  private readonly logger = new Logger(TiktokApiScraper.name);

  constructor(private readonly queryTransformer: TiktokQueryTransformer) {}

  async scrape(
    request: RequestMetadata<TiktokScraperOptionsDto>,
  ): Promise<ScraperResult> {
    const startTime = Date.now();

    const query = this.buildQuery(request.parameters);
    this.logger.log('Scraping TikTok ads...', request);
    this.logger.log('Query: ', query);

    return await Promise.resolve({
      success: false,
      errors: [new Error('Not implemented')],
      ads: [],
      totalCount: 0,
      executionTime: Date.now() - startTime,
    });
  }

  private buildQuery(parameters: TiktokScraperOptionsDto): TiktokLibraryQuery {
    return this.queryTransformer.transform(parameters);
  }
}
