import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { IScraper } from './interfaces';
import { FacebookBrowserScraper } from '../facebook/facebook-browser.scraper';
import { TiktokApiScraper } from '../tiktok/tiktok-api.scraper';
import { ScraperType } from '@src/api/requests/dto/create-request.dto';
import {
  TiktokScraperQuery,
  TiktokScraperResult,
} from '../tiktok/tiktok-scraper-types';
import {
  FacebookScraperQuery,
  FacebookScraperResult,
} from '../facebook/facebook-scraper-types';

// Type mappings for strong typing - this maps scraper types to their input parameter types
export interface ScraperParamsMap {
  facebook_scraper: FacebookScraperQuery;
  tiktok_scraper: TiktokScraperQuery;
}

// Type mappings for result types
export interface ScraperResultMap {
  facebook_scraper: FacebookScraperResult;
  tiktok_scraper: TiktokScraperResult;
}

@Injectable()
export class ScraperRegistry {
  // Use type assertion to store the scrapers with their specific types
  // while still allowing generic access
  private readonly scrapers = new Map<string, IScraper<any, any>>();
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

  /**
   * Register a scraper with its type
   * Using any here allows us to register scrapers with different specific types
   */
  private register(type: string, instance: IScraper<any, any>): void {
    this.scrapers.set(type, instance);
    this.logger.log(`Registered scraper: ${type}`);
  }

  /**
   * Get a scraper by type, with support for both string and ScraperType
   * Returns any to allow flexibility in caller usage while preserving runtime behavior
   */
  public getScraper(type: string): IScraper<any, any> {
    const scraper = this.scrapers.get(type);

    if (!scraper) {
      throw new Error(`Scraper not found for type: ${type}`);
    }

    return scraper;
  }

  /**
   * Type-safe accessor for scrapers when caller knows the exact type
   */
  public getTypedScraper<T extends ScraperType>(
    type: T,
  ): IScraper<ScraperParamsMap[T], ScraperResultMap[T]> {
    const scraper = this.scrapers.get(type) as
      | IScraper<ScraperParamsMap[T], ScraperResultMap[T]>
      | undefined;

    if (!scraper) {
      throw new Error(`Scraper not found for type: ${type}`);
    }

    return scraper;
  }

  /**
   * Check if a scraper exists
   */
  hasScraper(type: string): boolean {
    return this.scrapers.has(type);
  }

  /**
   * Get all registered scraper types
   */
  getAllScraperTypes(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
