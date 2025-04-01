/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { ScraperFactory } from '../implementations/factories/ScraperFactory';
import { AdLibraryQuery } from '../models/AdLibraryQuery';
import { ScraperOptions } from '../models/ScraperOptions';
import { ScraperResult } from '../models/ScraperResult';
import { BrowserPoolService } from './browser-pool/browser-pool-service';
import { Browser } from 'playwright';
// import { plainToInstance } from 'class-transformer';
// import { ScraperResponseDto } from '@src/dto';

@Injectable()
export class FacebookAdScraperService {
  constructor(
    private readonly scraperFactory: ScraperFactory,
    private readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {}

  /**
   * Scrape ads using a specific browser ID from the pool
   */
  async scrapeAdsWithBrowser(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
    browserId?: string,
  ): Promise<ScraperResult> {
    this.logger.log(
      `Starting Facebook Ad Library scraper for query: ${query.queryString} ${browserId ? 'with browser: ' + browserId : ''}`,
    );

    // If a browserId is provided, use the browser from the pool
    if (browserId) {
      this.logger.log(
        '[FacebookAdScraperService.scrapeAdsWithBrowser] Browser assigned, execute in browser',
        browserId,
      );
      return this.browserPoolService.executeInBrowser(
        browserId,
        async ({
          browserId,
          browser,
        }: {
          browserId: string;
          browser: Browser;
        }) => {
          return this.executeScraperWithBrowser(
            query,
            options,
            browser,
            browserId,
          );
        },
      );
    }

    // No browserId provided, create a temporary browser
    this.logger.log('No browser assigned, just use the service directly');
    return this.scrapeAds(query, options);
  }

  private async scrapeAds(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
  ): Promise<ScraperResult> {
    this.logger.log(
      `Starting Facebook Ad Library scraper for query: ${query.queryString}`,
    );

    // Create scraper pipeline and context
    const scraper = this.scraperFactory.createScraper(options);
    const context = this.scraperFactory.createContext(query, options);

    try {
      // Execute the scraper
      const result = await scraper.execute(context);

      // Add the includeAdsInResponse flag to the result
      result.includeAdsInResponse = options?.includeAdsInResponse || false;

      //TODO: Optional: validate against the DTO for internal checks
      // try {
      //   const resultDto = plainToInstance(ScraperResponseDto, {
      //     success: result.success,
      //     totalCount: result.totalCount,
      //     executionTime: result.executionTime,
      //     outputPath: result.outputPath || '',
      //     errors: result.errors.map((e) => e.message || String(e)),
      //     includeAdsInResponse: !!result.includeAdsInResponse,
      //     ads: result.includeAdsInResponse ? result.ads : undefined,
      //   });

      //   // Log validation success
      //   this.logger.debug('Result validated successfully');
      // } catch (validationError) {
      //   this.logger.warn('Result validation issues:', validationError);
      // }

      this.logger.log(
        `Scraping completed. Collected ${result.totalCount} ads.`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Scraping failed`, error);
      throw error;
    }
  }
  /**
   * Private method to execute scraper with provided browser and page
   * This ensures the entire pipeline runs regardless of browser source
   */
  public async executeScraperWithBrowser(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
    browser?: Browser,
    browserId?: string,
  ): Promise<ScraperResult> {
    // Create the scraper pipeline with all required steps
    const scraper = this.scraperFactory.createScraper(options);

    // Create context with external browser info
    const context = this.scraperFactory.createContext(query, options);
    this.logger.log(
      '[FacebookAdScraperService.executeScraperWithBrowser] Context created',
    );
    // Store the browser and page in the context state
    // The InitializationStep will detect and use these
    if (browser) {
      context.state.browser = browser;
      context.state.browserId = browserId;
      context.state.externalBrowser = true; // Flag to indicate we're using an external browser

      this.logger.log('Using external browser in scraper pipeline');
    }

    try {
      // Execute the entire pipeline - all steps will be run
      // Each step will check context.state to determine what to do
      const result = await scraper.execute(context);
      result.includeAdsInResponse = options?.includeAdsInResponse || false;
      return result;
    } catch (error) {
      this.logger.error(`Scraping with provided browser failed`, error);
      throw error;
    }
  }
}
