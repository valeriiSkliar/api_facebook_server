/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';

import { IScraper } from '../common/interfaces';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { TiktokLibraryQuery } from './models/tiktok-library-query';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TiktokScraperOptionsDto } from './dto/tiktok-scraper-options.dto';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { ScraperOptions } from '@src/scrapers/common/interfaces/scraper-options.interface';
import { BaseScraperResult } from '../common/interfaces/base-scraper-result';
import { AdData } from '../facebook/models/facebook-ad-data';

@Injectable()
export class TiktokApiScraper
  implements IScraper<ScraperOptions<TiktokLibraryQuery>>
{
  private readonly logger = new Logger(TiktokApiScraper.name);

  constructor(
    private readonly queryTransformer: TiktokQueryTransformer,
    private readonly scraperFactory: TikTokScraperFactory,
  ) {}

  async scrape(
    request: RequestMetadata<TiktokLibraryQuery>,
  ): Promise<BaseScraperResult<AdData>> {
    const startTime = Date.now();

    const query = this.buildQuery(request.parameters);

    const scraper = this.scraperFactory.createScraper();
    const context = this.scraperFactory.createContext(
      query,
      request.parameters as Partial<TiktokScraperOptionsDto>,
    );
    // const result = await scraper.execute(context);

    // this.logger.log('Scraping TikTok ads...', request);
    // this.logger.log('Query: ', query);

    return await Promise.resolve({
      success: false,
      errors: [new Error('Not implemented')],
      ads: [],
      totalCount: 0,
      executionTime: Date.now() - startTime,
    });
  }

  private buildQuery(parameters: TiktokLibraryQuery): TiktokLibraryQuery {
    return this.queryTransformer.transform(parameters);
  }
}
