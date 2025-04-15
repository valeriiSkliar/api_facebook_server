// src/scrapers/facebook/facebook-browser.scraper.ts

import { Injectable, Logger } from '@nestjs/common';
import { BrowserLifecycleManager } from '@src/core';
import { BrowserPoolService } from '@src/core';
import { IScraper } from '../common/interfaces';
import { RequestMetadata } from '@src/api/requests/request-manager-service';
import { FacebookScraperOptionsDto } from '@src/api/facebook/dto';
import { IBaseScraperResult } from '../common/interfaces/base-scraper-result';
import { AdData } from './models/facebook-ad-data';
import { AdLibraryQuery } from './models/facebook-ad-lib-query';
import { FacebookScraperFactory } from './factories/facebook-scraper-factory';

@Injectable()
export class FacebookBrowserScraper
  implements IScraper<FacebookScraperOptionsDto, AdData>
{
  private readonly logger = new Logger(FacebookBrowserScraper.name);

  constructor(
    private readonly browserPoolService: BrowserPoolService,
    private readonly lifecycleManager: BrowserLifecycleManager,
    private readonly facebookScraperFactory: FacebookScraperFactory,
  ) {}

  async scrape(
    request: RequestMetadata<FacebookScraperOptionsDto>,
  ): Promise<IBaseScraperResult<AdData>> {
    let browserId: string | null = null;
    let tabId: string | null = null;

    try {
      this.logger.log(`[${request.id}] Starting Facebook browser scrape task`);

      // 1. Get browser and tab
      const tabCreationResult =
        await this.browserPoolService.createTabForRequest(
          request.id,
          request.user_id,
          request.user_email,
        );

      if (!tabCreationResult) {
        this.logger.error(`[${request.id}] Failed to create browser tab`);
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
      const page = this.lifecycleManager.getPageForTab(tabId);

      if (!page || page.isClosed()) {
        this.logger.error(
          `[${request.id}] Failed to get valid Page object for tab ${tabId}. Page is ${page ? 'closed' : 'null'}.`,
        );
        return {
          success: false,
          errors: [new Error('Failed to get valid Page object')],
          ads: [],
          totalCount: 0,
          executionTime: 0,
        };
      }

      this.logger.log(`[${request.id}] Obtained Page object for tab ${tabId}`);

      // 3. Convert request parameters to our query format
      const query = this.buildQuery(request.parameters);

      // 4. Prepare options with browser information
      const options = {
        ...request.parameters,
        useExternalBrowser: true,
        storage: {
          enabled: true,
          outputPath: `./data/facebook/${request.id}`,
          format: 'json',
        },
      };

      // 5. Create context with external browser info
      const context = this.facebookScraperFactory.createContext(query, options);
      context.state.browserId = browserId;
      context.state.page = page;
      context.state.externalBrowser = true;

      // 6. Create scraper pipeline
      const scraper = this.facebookScraperFactory.createScraper(options);

      // 7. Execute scraper pipeline
      this.logger.log(`[${request.id}] Executing Facebook scraper pipeline`);
      const result = await scraper.execute(context);

      this.logger.log(
        `[${request.id}] Scraping completed with ${result.ads.length} ads collected`,
      );

      return result;
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
      // 8. Ensure tab is closed
      if (browserId && tabId) {
        this.logger.log(
          `[${request.id}] Closing tab ${tabId} in browser ${browserId}`,
        );

        try {
          await this.browserPoolService.closeTab(browserId, tabId, {
            deleteRedisKeys: true,
          });

          this.logger.log(`[${request.id}] Successfully closed tab ${tabId}`);
        } catch (closeError: unknown) {
          const closeErrorMessage =
            closeError instanceof Error
              ? closeError.message
              : 'Unknown error closing tab';

          this.logger.error(
            `[${request.id}] Error closing tab ${tabId} in browser ${browserId}: ${closeErrorMessage}`,
            closeError instanceof Error ? closeError.stack : undefined,
          );
        }
      }
    }
  }

  private buildQuery(parameters: FacebookScraperOptionsDto): AdLibraryQuery {
    // Map request parameters to AdLibraryQuery format
    return {
      queryString: parameters.query?.queryString || '',
      countries: parameters.query?.countries || ['ALL'],
      activeStatus: parameters.query?.activeStatus || 'active',
      adType: parameters.query?.adType || 'all',
      isTargetedCountry: parameters.query?.isTargetedCountry || false,
      mediaType: parameters.query?.mediaType || 'all',
      searchType: parameters.query?.searchType || 'keyword_unordered',
      // filters: parameters.query?.filters || {},
    };
  }
}
