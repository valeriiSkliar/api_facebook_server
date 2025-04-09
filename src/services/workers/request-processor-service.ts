/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Logger, Injectable } from '@nestjs/common';
import {
  RequestManagerService,
  RequestMetadata,
  RequestStatus,
} from '@src/api/requests/request-manager-service';
import { ScraperRegistry } from '@src/scrapers/common/scraper.registry';
import { IScraper } from '@src/scrapers/common/interfaces';
import { ScraperResult } from '@src/scrapers/facebook/models/facebook-scraper-result';

@Injectable()
export class RequestProcessorService {
  private readonly logger = new Logger(RequestProcessorService.name);

  constructor(
    private readonly requestManager: RequestManagerService,
    private readonly scraperRegistry: ScraperRegistry,
  ) {}

  /**
   * Process a request by ID using the appropriate scraper from the registry.
   */
  async processRequest(requestId: string): Promise<any> {
    let request: RequestMetadata | null = null;
    let finalStatus: RequestStatus;
    let result: ScraperResult | { error: string };

    try {
      // Get request details
      request = await this.requestManager.getRequest(requestId);
      if (!request) {
        // Handle case where request might be deleted or invalid before processing starts
        this.logger.warn(
          `Request ${requestId} not found during processing. It might have been deleted.`,
        );
        return; // Exit gracefully if request doesn't exist
      }

      // Record activity and update status to PROCESSING
      await this.requestManager.recordActivity(requestId);
      await this.requestManager.updateRequestStatus(
        requestId,
        RequestStatus.PROCESSING,
      );

      // Get the scraper instance from the registry
      const scraper: IScraper = this.scraperRegistry.getScraper(
        request.requestType,
      );

      // Execute the scrape method
      const scrapeResult = await scraper.scrape(request);

      // Determine final status based on scrape result
      finalStatus = scrapeResult.success
        ? RequestStatus.COMPLETED
        : RequestStatus.FAILED;
      result = scrapeResult as ScraperResult;

      // Optionally trigger webhook if URL is provided
      if (request.webhookUrl) {
        this.triggerWebhook(request.webhookUrl, result);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Critical error processing request ${requestId}: ${
          (error as Error).message
        }`,
        (error as Error).stack,
      );
      finalStatus = RequestStatus.FAILED;
      result = {
        error: `Critical processing error: ${(error as Error).message}`,
      };

      // Optionally trigger webhook on critical failure too
      if (request?.webhookUrl) {
        this.triggerWebhook(request.webhookUrl, result);
      }
    }

    // Update request with final status and results/error
    // Ensure request was fetched before trying to update
    if (request) {
      try {
        await this.requestManager.updateRequestStatus(
          requestId,
          finalStatus,
          result,
        );
      } catch (updateError: unknown) {
        this.logger.error(
          `Failed to update final status for request ${requestId} to ${finalStatus}`,
          updateError,
        );
        // Decide if we need to re-throw or handle this specific error further
      }
    } else {
      this.logger.warn(
        `Cannot update status for request ${requestId} as it was not found initially.`,
      );
    }

    // If the original processing resulted in an error, rethrow it
    // so the job queue handler knows the job failed.
    if (finalStatus === RequestStatus.FAILED && 'error' in result) {
      throw new Error(result.error);
    }

    return result; // Return the result (success or structured error)
  }

  // Placeholder for webhook triggering logic
  private triggerWebhook(
    url: string,
    data: ScraperResult | { error: string },
  ): void {
    this.logger.log(
      `Triggering webhook to ${url} with data: ${JSON.stringify(data).substring(0, 100)}...`,
    );
    // TODO: Implement actual webhook POST request logic here
    // Consider using an HTTP client like Axios or NestJS HttpModule
    // Handle potential errors during the webhook call (e.g., network issues, non-2xx responses)
  }
}
