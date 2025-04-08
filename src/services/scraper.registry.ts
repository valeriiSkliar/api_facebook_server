import { Injectable } from '@nestjs/common';
import { FacebookAdScraperService } from './FacebookAdScraperService';
import { TiktokAdScraperService } from '@src/scrapers/tiktok/tik-tok-ad-scraper-service';

@Injectable()
export class ScraperRegistry {
  private scrapers: Map<string, any> = new Map();

  constructor(
    private readonly facebookAdScraperService: FacebookAdScraperService,
    private readonly tiktokAdScraperService: TiktokAdScraperService,
  ) {
    // Register all available scrapers
    this.registerScraper('facebook-ads', facebookAdScraperService);
    this.registerScraper('tiktok-ads', tiktokAdScraperService);
  }

  registerScraper(type: string, scraper: any): void {
    if (this.scrapers.has(type)) {
      throw new Error(`Scraper type '${type}' already registered`);
    }
    this.scrapers.set(type, scraper);
  }

  getScraper(type: string): any {
    if (!this.scrapers.has(type)) {
      throw new Error(`Scraper type '${type}' not found`);
    }
    return this.scrapers.get(type);
  }

  hasScraper(type: string): boolean {
    return this.scrapers.has(type);
  }

  getAllScraperTypes(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
