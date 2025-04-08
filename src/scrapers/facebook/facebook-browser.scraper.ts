/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { BrowserLifecycleManager } from '@src/core';
import { Page } from 'playwright-core';
import { IScraper } from '../common/interfaces';
import { BrowserPoolService } from '@src/core';
import { FacebookAdScraperService } from '@src/services';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { ScraperResult } from './models/facebook-scraper-result';
import { AdLibraryQuery } from './models/facebook-ad-lib-query';
import { ScraperOptions } from './models/facebook-scraper-options';
import { ScraperOptionsDto } from '@src/api/facebook/dto';

@Injectable()
export class FacebookBrowserScraper implements IScraper {
  private readonly logger = new Logger(FacebookBrowserScraper.name);

  constructor(
    private readonly browserPoolService: BrowserPoolService,
    private readonly lifecycleManager: BrowserLifecycleManager,
    private readonly facebookAdScraperService: FacebookAdScraperService, // Placeholder service
  ) {}

  async scrape(request: RequestMetadata): Promise<ScraperResult> {
    let browserId: string | null = null;
    let tabId: string | null = null;

    try {
      this.logger.log(`[${request.id}] Starting Facebook browser scrape task.`);

      // 1. Get browserId and tabId
      const tabCreationResult =
        await this.browserPoolService.createTabForRequest(
          request.id,
          request.user_id,
          request.user_email,
        );
      if (!tabCreationResult) {
        this.logger.error(`[${request.id}] Failed to create browser tab.`);
        // TODO: Define a more specific error structure for ScraperResult
        return {
          success: false,
          errors: [new Error('Failed to create browser tab')],
          ads: [],
          totalCount: 0,
          executionTime: 0,
        };
      }
      browserId = tabCreationResult.browserId;
      tabId = tabCreationResult.tabId;
      this.logger.log(
        `[${request.id}] Created tab ${tabId} in browser ${browserId}`,
      );

      // 2. Get Page object
      const page: Page | null = this.lifecycleManager.getPageForTab(tabId);
      if (!page || page.isClosed()) {
        this.logger.error(
          `[${request.id}] Failed to get valid Page object for tab ${tabId}. Page is ${page ? 'closed' : 'null'}.`,
        );
        // TODO: Implement retry logic or fail request based on strategy
        return {
          success: false,
          errors: [new Error('Failed to get valid Page object')],
          ads: [],
          totalCount: 0,
          executionTime: 0,
        };
      }
      this.logger.log(`[${request.id}] Obtained Page object for tab ${tabId}.`);

      // 3. Prepare parameters for the ad scraper service
      // Assuming request.parameters contains necessary fields for query and options
      // Needs specific implementation based on actual RequestMetadata structure
      const query: AdLibraryQuery = this.buildQuery(request.parameters);
      const options: ScraperOptions = {
        // ... ScraperOptions fields from request.parameters
      };
      this.logger.log(
        `[${request.id}] Prepared AdLibraryQuery and ScraperOptions.`,
      );

      // 4. Call the core scraping logic
      // Assuming FacebookAdScraperService has a method like scrapeAds
      const scrapeResult =
        await this.facebookAdScraperService.executeScrapingLogic(
          query,
          page,
          options,
          undefined,
          browserId,
          request.id,
        );

      this.logger.log(
        `[${request.id}] FacebookAdScraperService returned result.`,
      );

      // 5. Process result and transform to ScraperResult
      // This part depends heavily on the structure returned by facebookAdScraperService.scrapeAds
      if (scrapeResult.success) {
        return {
          success: true,
          ads: scrapeResult.ads, // Use ads from scrapeResult
          totalCount: scrapeResult.totalCount, // Use totalCount from scrapeResult
          executionTime: scrapeResult.executionTime, // Use executionTime from scrapeResult
          errors: [], // Keep errors as empty array for success
          // requestId: request.id,        // Remove requestId if not part of ScraperResult
        };
      } else {
        this.logger.error(
          `[${request.id}] Scraping failed: ${scrapeResult.errors[0]}`,
        );
        return {
          success: false,
          errors: [new Error('Facebook scraping failed')],
          ads: [],
          totalCount: 0,
          executionTime: 0,
        };
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[${request.id}] Unhandled error during Facebook scrape: ${errorMessage}`,
        errorStack,
      );
      return {
        success: false,
        errors: [new Error(`Unhandled error: ${errorMessage}`)],
        ads: [],
        totalCount: 0,
        executionTime: 0,
      };
    } finally {
      // 6. Ensure tab is closed
      if (browserId && tabId) {
        this.logger.log(
          `[${request.id}] Closing tab ${tabId} in browser ${browserId}.`,
        );
        try {
          await this.browserPoolService.closeTab(browserId, tabId, {
            deleteRedisKeys: true,
          });
          this.logger.log(`[${request.id}] Successfully closed tab ${tabId}.`);
        } catch (closeError: unknown) {
          const closeErrorMessage =
            closeError instanceof Error
              ? closeError.message
              : 'Unknown error closing tab';
          const closeErrorStack =
            closeError instanceof Error ? closeError.stack : undefined;
          this.logger.error(
            `[${request.id}] Error closing tab ${tabId} in browser ${browserId}: ${closeErrorMessage}`,
            closeErrorStack,
          );
          // Log error but don't overwrite the original scrape result/error
        }
      } else {
        this.logger.warn(
          `[${request.id}] Could not close tab because browserId (${browserId}) or tabId (${tabId}) is missing.`,
        );
      }
    }
  }

  private buildQuery(parameters: ScraperOptionsDto): AdLibraryQuery {
    // Map request parameters to AdLibraryQuery format
    return {
      queryString: parameters.query?.queryString || '',
      countries: parameters.query?.countries || ['ALL'],
      activeStatus: parameters.query?.activeStatus || 'active',
      adType: parameters.query?.adType || 'all',
      isTargetedCountry: parameters.query?.isTargetedCountry || false,
      mediaType: parameters.query?.mediaType || 'all',
      searchType: parameters.query?.searchType || 'keyword_unordered',
      filters: parameters.query?.filters || {},
    };
  }
}
