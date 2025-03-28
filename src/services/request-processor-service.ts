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
          result = await this.processFacebookScraper(request);
          break;
        case 'tiktok_scraper':
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
    } catch (error) {
      this.logger.error(`Error processing request ${requestId}`, error);

      // Update request status to FAILED
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.FAILED,
        { error: error.message },
      );

      throw error;
    }
  }

  private async processFacebookScraper(request: RequestMetadata): Promise<any> {
    // If we have a browser assigned, use it
    if (request.browserId) {
      return await this.browserPool.executeInBrowser(
        request.browserId,
        async (page) => {
          // Prepare the query from request parameters
          const query = this.buildFacebookQuery(request.parameters);

          // Execute the Facebook scraper with the page
          return await this.facebookAdScraperService.scrapeAds(
            query,
            request.parameters,
          );
        },
      );
    } else {
      // No browser assigned, just use the service directly
      // (it will create its own browser)
      const query = this.buildFacebookQuery(request.parameters);
      return await this.facebookAdScraperService.scrapeAds(
        query,
        request.parameters,
      );
    }
  }

  private buildFacebookQuery(parameters: any): AdLibraryQuery {
    // Extract and map parameters to the AdLibraryQuery format
    return {
      queryString: parameters.queryString || '',
      countries: parameters.countries || ['ALL'],
      activeStatus: parameters.activeStatus || 'active',
      adType: parameters.adType || 'all',
      isTargetedCountry: parameters.isTargetedCountry || false,
      mediaType: parameters.mediaType || 'all',
      searchType: parameters.searchType || 'keyword_unordered',
      filters: parameters.filters || {},
    };
  }

  private async processTikTokScraper(request: RequestMetadata): Promise<any> {
    // Similar implementation for Instagram scraping
    // ...
    throw new Error('Instagram scraper not yet implemented');
  }
}
