/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Logger } from '@nestjs/common';

import { Injectable } from '@nestjs/common';
import {
  RequestManagerService,
  RequestMetadata,
  RequestStatus,
} from '@src/api/requests/request-manager-service';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { FacebookAdScraperService } from '../FacebookAdScraperService';
import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';
import { Browser } from 'playwright';
import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
import { BrowserLifecycleManager } from '@src/core/browser/lifecycle/browser-lifecycle-manager';

@Injectable()
export class RequestProcessorService {
  private readonly logger = new Logger(RequestProcessorService.name);

  constructor(
    private readonly requestManager: RequestManagerService,
    private readonly browserPool: BrowserPoolService,
    private readonly tabManager: TabManager,
    private readonly facebookAdScraperService: FacebookAdScraperService,
    private readonly lifecycleManager: BrowserLifecycleManager,

    // Include other scrapers as needed
  ) {}

  /**
   * Process a request by ID
   */
  async processRequest(requestId: string): Promise<any> {
    try {
      // Get request details
      const request = await this.requestManager.getRequest(requestId);
      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      // Record activity and update status
      await this.requestManager.recordActivity(requestId);
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.PROCESSING,
      );

      // Choose the appropriate scraper based on request type
      let result;
      switch (request.requestType) {
        case 'facebook_scraper': {
          const tabInfo = await this.tabManager.getTabByRequest(requestId);
          if (!tabInfo) {
            throw new Error(
              `Tab not found for request ${requestId}. Cannot proceed.`,
            );
          }
          const tabId = tabInfo.id;
          const browserId = tabInfo.browserId;

          if (!browserId) {
            // Handle case where tab exists but browserId is missing (shouldn't normally happen if tab is active)
            throw new Error(
              `Browser ID not found for tab ${tabId} associated with request ${requestId}.`,
            );
          }

          result = await this.browserPool.executeInBrowser(
            browserId,
            async ({ browser }) => {
              const page = this.lifecycleManager.getPageForTab(tabId);
              if (!page || page.isClosed()) {
                this.logger.error(
                  `Page object for tab ${tabId} is invalid (Not found or closed). Request ${requestId}`,
                );
                throw new Error(`Page not found or closed for tab ${tabId}`);
              }

              this.logger.debug(
                `Executing scraper in page for tab ${tabId}, browser ${browserId}`,
              );

              return await this.facebookAdScraperService.executeScraperWithBrowserAndPage(
                this.buildFacebookQuery(request),
                request.parameters,
                browser,
                page,
                browserId,
                requestId,
              );
            },
          );
          break;
        }
        case 'tiktok_scraper':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result = await this.processTikTokScraper(request);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.requestType}`);
      }

      // Update request with results
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.COMPLETED,
        result,
      );

      return result;
    } catch (error: unknown) {
      this.logger.error(`Error processing request ${requestId}`, error);

      // Update request status to FAILED
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.FAILED,
        { error: (error as Error).message },
      );

      throw error;
    }
  }

  private async processFacebookScraper(request: RequestMetadata): Promise<any> {
    // If we have a browser assigned, use it
    if (request.browserId) {
      return await this.browserPool.executeInBrowser(
        request.browserId,
        async ({
          browserId,
          browser,
        }: {
          browserId: string;
          browser: Browser;
        }) => {
          // Prepare the query from request parameters
          const query = this.buildFacebookQuery(request);
          // Directly execute with the browser instance
          return await this.facebookAdScraperService.executeScraperWithBrowser(
            query,
            request.parameters,
            browser,
            browserId,
          );
        },
      );
    } else {
      // No browser assigned, just use the service directly
      const query = this.buildFacebookQuery(request);
      return await this.facebookAdScraperService.scrapeAdsWithBrowser(
        query,
        request.parameters,
      );
    }
  }

  private buildFacebookQuery(request: RequestMetadata): AdLibraryQuery {
    // this.logger.log('Building Facebook query', request);

    // Создаем запрос с данными по умолчанию
    const defaultQuery: AdLibraryQuery = {
      queryString: '',
      countries: ['ALL'],
      activeStatus: 'active',
      adType: 'all',
      isTargetedCountry: false,
      mediaType: 'all',
      searchType: 'keyword_unordered',
      filters: {},
    };

    // Проверяем наличие параметров запроса
    if (!request.parameters || !request.parameters.query) {
      return defaultQuery;
    }

    // Получаем query из параметров и устанавливаем значения
    const query = request.parameters.query;

    return {
      queryString: query.queryString || defaultQuery.queryString,
      countries: query.countries || defaultQuery.countries,
      activeStatus:
        (query.activeStatus as 'active' | 'inactive' | 'all') ||
        defaultQuery.activeStatus,
      adType:
        (query.adType as 'political_and_issue_ads' | 'all') ||
        defaultQuery.adType,
      isTargetedCountry:
        typeof query.isTargetedCountry === 'boolean'
          ? query.isTargetedCountry
          : defaultQuery.isTargetedCountry,
      mediaType:
        (query.mediaType as 'all' | 'image' | 'video') ||
        defaultQuery.mediaType,
      searchType:
        (query.searchType as 'keyword_unordered' | 'keyword_exact_phrase') ||
        defaultQuery.searchType,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      filters: query.filters || defaultQuery.filters,
    };
  }

  private processTikTokScraper(request: RequestMetadata): Promise<any> {
    this.logger.log('Processing TikTok scraper', request);
    // Similar implementation for Instagram scraping
    // ...
    throw new Error('TikTok scraper not yet implemented');
  }
}
