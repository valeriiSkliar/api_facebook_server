/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { IAdScraperService } from '../common/interfaces/I-ad-scraper-service';

// TODO: Define actual types for TikTok query, options, and result
type TikTokQuery = any;
type TikTokOptions = any;
type TikTokResult = any;

@Injectable()
export class TiktokAdScraperService
  implements IAdScraperService<TikTokQuery, TikTokOptions, TikTokResult>
{
  constructor(
    private readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {}

  async scrapeAds(
    query: TikTokQuery,
    options: TikTokOptions,
  ): Promise<TikTokResult> {
    this.logger.log('Scraping TikTok ads', { query, options });
    return null;
  }
}
