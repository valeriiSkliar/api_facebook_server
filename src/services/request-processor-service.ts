import { Logger } from '@nestjs/common';

import { Injectable } from '@nestjs/common';
import {
  RequestManagerService,
  RequestMetadata,
  RequestStatus,
} from './request-manager-service';
import { BrowserPoolService } from './browser-pool-service';
import { FacebookAdScraperService } from './FacebookAdScraperService';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';
import { Page } from 'playwright';
import { Browser } from 'playwright';

@Injectable()
export class RequestProcessorService {
  private readonly logger = new Logger(RequestProcessorService.name);

  constructor(
    private readonly requestManager: RequestManagerService,
    private readonly browserPool: BrowserPoolService,
    private readonly facebookAdScraperService: FacebookAdScraperService,
    // Include other scrapers as needed
  ) {}

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
        case 'facebook_scraper':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result = await this.processFacebookScraper(request);
          break;
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
        async (browser: Browser) => {
          // Prepare the query from request parameters
          const query = this.buildFacebookQuery(request);
          // Execute the Facebook scraper with the page
          // const testPage = await browser.newPage();
          // await testPage.goto('https://www.google.com');
          // await testPage.waitForTimeout(10000);
          // await testPage.close();
          return await this.facebookAdScraperService.scrapeAdsWithBrowser(
            query,
            request.parameters,
          );
        },
      );
    } else {
      // No browser assigned, just use the service directly
      // (it will create its own browser)
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
