import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { IScraper } from './interfaces';
import { FacebookBrowserScraper } from '../facebook/facebook-browser.scraper';
import { TiktokApiScraper } from '../tiktok/tiktok-api.scraper';
import { AdData } from '../facebook/models/facebook-ad-data';

@Injectable()
export class ScraperRegistry {
  private readonly scrapers: Map<string, IScraper<unknown, AdData>> = new Map();
  private readonly logger = new Logger(ScraperRegistry.name);

  constructor(
    @Optional()
    @Inject(FacebookBrowserScraper)
    private readonly facebookScraper: FacebookBrowserScraper,
    @Optional()
    @Inject(TiktokApiScraper)
    private readonly tiktokScraper: TiktokApiScraper,
  ) {
    this.logger.debug('ScraperRegistry constructor called');
    this.logger.debug(`Facebook scraper injected: ${!!this.facebookScraper}`);
    this.logger.debug(`Tiktok scraper injected: ${!!this.tiktokScraper}`);

    if (this.facebookScraper) {
      this.register('facebook_scraper', this.facebookScraper);
    }
    if (this.tiktokScraper) {
      this.register('tiktok_scraper', this.tiktokScraper);
    }
  }

  private register(type: string, instance: IScraper<unknown, AdData>): void {
    this.scrapers.set(type, instance);
    this.logger.log(`Registered scraper: ${type}`);
  }

  public getScraper(type: string): IScraper<unknown, AdData> {
    const scraper = this.scrapers.get(type);
    if (!scraper) {
      throw new Error(`Scraper not found for type: ${type}`);
    }
    return scraper;
  }

  hasScraper(type: string): boolean {
    return this.scrapers.has(type);
  }

  getAllScraperTypes(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
