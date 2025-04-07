/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '@core/queue/queue.service';
import {
  RequestManagerService,
  RequestMetadata,
  RequestStatus,
} from '@src/api/requests/request-manager-service';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { ScraperRegistry } from '@src/services/ScraperRegistry';
import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
import { ScraperResult } from '@src/scrapers/facebook/models/facebook-scraper-result';
import { ScraperOptionsDto } from '@src/api/facebook/dto';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private isProcessing = false;
  private readonly workerCount = 3; // Configure based on your needs
  private activeWorkers = 0;

  constructor(
    private readonly queueService: QueueService,
    private readonly requestManager: RequestManagerService,
    private readonly scraperFactory: ScraperFactory,
    private readonly scraperRegistry: ScraperRegistry,
    private readonly browserPoolService: BrowserPoolService,
  ) {}

  async onModuleInit() {
    // Start worker processes when the application starts
    this.isProcessing = true;
    for (let i = 0; i < this.workerCount; i++) {
      // Запускаем воркеры без await, чтобы не блокировать инициализацию
      void this.startWorker(i);
    }
  }

  private async startWorker(workerId: number) {
    this.activeWorkers++;
    this.logger.log(`Starting worker ${workerId}`);

    try {
      while (true) {
        // Check if we should continue processing
        if (this.isProcessing === false) {
          this.logger.log(`Worker ${workerId} stopped`);
          break;
        }

        // Get next request from queue
        const requestId = await this.queueService.dequeueRequest();
        if (!requestId) {
          // No requests in queue, wait before checking again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Process the request
        await this.processRequest(requestId, workerId);
      }
    } catch (error) {
      this.logger.error(`Worker ${workerId} encountered an error`, error);
    } finally {
      this.activeWorkers--;

      // Restart worker if it died unexpectedly
      if (this.isProcessing) {
        this.logger.warn(`Worker ${workerId} died unexpectedly, restarting...`);
        void this.startWorker(workerId);
      }
    }
  }

  private async processRequest(requestId: string, workerId: number) {
    this.logger.log(`Worker ${workerId} processing request ${requestId}`);

    try {
      // Get request details
      const request = await this.requestManager.getRequest(requestId);
      if (!request) {
        this.logger.warn(`Request ${requestId} not found, skipping`);
        return;
      }

      // Record activity to keep request alive
      await this.requestManager.recordActivity(requestId);

      // Update status to PROCESSING if not already
      if (request.status !== RequestStatus.PROCESSING) {
        await this.requestManager.updateRequestStatus(
          requestId,
          RequestStatus.PROCESSING,
        );
      }

      // Get the appropriate scraper based on request type
      const scraperType = this.mapRequestTypeToScraperType(request.requestType);
      const scraper = this.scraperRegistry.getScraper(scraperType);

      if (!scraper) {
        throw new Error(`No scraper found for type ${scraperType}`);
      }

      // Execute the scraping process
      const result = await this.executeScrapingProcess(request, scraper);

      // Update request with results
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.COMPLETED,
        result,
      );

      // If there's a webhook URL, trigger it
      if (request.webhookUrl) {
        await this.triggerWebhook(request.webhookUrl, requestId, result);
      }

      this.logger.log(`Request ${requestId} completed successfully`);
    } catch (error: unknown) {
      this.logger.error(`Error processing request ${requestId}`, error);

      // Update request status to FAILED
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.FAILED,
        { error: error instanceof Error ? error.message : 'Unknown error' },
      );
    }
  }

  private async executeScrapingProcess(
    request: RequestMetadata,
    scraper: FacebookAdScraperService,
  ): Promise<ScraperResult> {
    // Create a ScraperContext for this request
    const context = this.scraperFactory.createContext(
      this.buildQuery(request.parameters),
      request.parameters,
    );

    // If we have an active browser from BrowserPoolService, use it
    if (request.browserId) {
      // Get browser instance
      const browserInstance = await this.browserPoolService.getBrowser(
        request.browserId,
      );

      if (browserInstance && browserInstance.browser) {
        // Use the existing browser in our context
        context.state.browser = browserInstance.browser;

        // Create a new page in the existing browser
        context.state.page = await browserInstance.browser.newPage();
      }
    }

    // Execute the scraping pipeline using the appropriate method
    const result: ScraperResult = await scraper.scrapeAdsWithBrowser(
      this.buildQuery(request.parameters),
      request.parameters,
      request.browserId,
    );

    return result;
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

  private mapRequestTypeToScraperType(requestType: string): string {
    const mapping: Record<string, string> = {
      facebook_scraper: 'facebook-ads',
      tiktok_scraper: 'tiktok-ads',
      // Add more mappings as needed
    };

    return mapping[requestType] || requestType;
  }

  private async triggerWebhook(url: string, requestId: string, data: any) {
    try {
      // Implement webhook notification
      // You might want to use an HTTP client like axios
      // axios.post(url, { requestId, status: 'completed', data });
      this.logger.log(`Webhook triggered for request ${requestId}`);
    } catch (error) {
      this.logger.error(
        `Failed to trigger webhook for request ${requestId}`,
        error,
      );
    }
  }

  stopAllWorkers() {
    this.isProcessing = false;
    this.logger.log('Stopping all workers');
  }
}
