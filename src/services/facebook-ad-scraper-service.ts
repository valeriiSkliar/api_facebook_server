import { Injectable, Logger } from '@nestjs/common';
import { FacebookScraperFactory } from '../scrapers/common/factories/facabook-scraper-factory';
import { AdLibraryQuery } from '../scrapers/facebook/models/facebook-ad-lib-query';
import { ScraperOptions } from '../scrapers/facebook/models/facebook-scraper-options';
import { ScraperResult } from '../scrapers/facebook/models/facebook-scraper-result';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { Browser, Page } from 'playwright';

@Injectable()
export class FacebookAdScraperService {
  constructor(
    private readonly scraperFactory: FacebookScraperFactory,
    private readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {}

  async executeScrapingLogic(
    query: AdLibraryQuery,
    page: Page,
    options?: Partial<ScraperOptions>,
    browser?: Browser,
    browserId?: string,
    requestId?: string,
  ): Promise<ScraperResult> {
    this.logger.log(
      `Executing scraper for request ${requestId} using browser ${browserId} and provided page.`,
    );

    const scraper = this.scraperFactory.createScraper(options);
    const context = this.scraperFactory.createContext(query, options);

    context.state.page = page;

    if (browser) {
      context.state.browser = browser;
      context.state.browserId = browserId;
      context.state.externalBrowser = true;
    }

    try {
      const result = await scraper.execute(context);
      result.includeAdsInResponse = options?.includeAdsInResponse || false;
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed for request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * @deprecated Use executeScrapingLogic instead
   */
  async scrapeAdsWithBrowser(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
    browserId?: string,
  ): Promise<ScraperResult> {
    this.logger.warn(
      'This method is deprecated. Use executeScrapingLogic instead',
    );

    if (browserId) {
      return this.browserPoolService.executeInBrowser(
        browserId,
        async ({
          browserId,
          browser,
        }: {
          browserId: string;
          browser: Browser;
        }) => {
          const page = await browser.newPage();
          try {
            return await this.executeScrapingLogic(
              query,
              page,
              options,
              browser,
              browserId,
            );
          } finally {
            await page.close();
          }
        },
      );
    }

    return this.scrapeAds(query, options);
  }

  /**
   * @deprecated Use executeScrapingLogic instead
   */
  private async scrapeAds(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
  ): Promise<ScraperResult> {
    this.logger.warn(
      'This method is deprecated. Use executeScrapingLogic instead',
    );

    const scraper = this.scraperFactory.createScraper(options);
    const context = this.scraperFactory.createContext(query, options);

    try {
      const result = await scraper.execute(context);
      result.includeAdsInResponse = options?.includeAdsInResponse || false;
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed`, error);
      throw error;
    }
  }

  /**
   * @deprecated Use executeScrapingLogic instead
   */
  public async executeScraperWithBrowser(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
    browser?: Browser,
    browserId?: string,
    requestId?: string,
  ): Promise<ScraperResult> {
    this.logger.warn(
      'This method is deprecated. Use executeScrapingLogic instead',
    );

    const page = await browser?.newPage();
    if (!page) {
      throw new Error('Browser is required to create a new page');
    }

    try {
      return await this.executeScrapingLogic(
        query,
        page,
        options,
        browser,
        browserId,
        requestId,
      );
    } finally {
      await page.close();
    }
  }
}
