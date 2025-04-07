import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '@core/queue/queue.service';
import { RequestProcessorService } from '@src/services/workers/request-processor-service';
import {
  RequestManagerService,
  RequestStatus,
} from '@src/api/requests/request-manager-service';

@Injectable()
export class RequestProcessorScheduler {
  private readonly logger = new Logger(RequestProcessorScheduler.name);
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000; // 2 seconds delay
  private currentProcessingCount = 0;

  constructor(
    private readonly queueService: QueueService,
    private readonly requestProcessor: RequestProcessorService,
    private readonly requestManager: RequestManagerService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processQueuedRequests() {
    try {
      // If already at max capacity, skip
      if (this.currentProcessingCount >= this.MAX_CONCURRENT_REQUESTS) {
        return;
      }

      // Calculate how many new requests we can process
      const availableSlots =
        this.MAX_CONCURRENT_REQUESTS - this.currentProcessingCount;

      // Dequeue and process requests
      for (let i = 0; i < availableSlots; i++) {
        const requestId = await this.queueService.dequeueRequest();
        if (!requestId) break; // No more requests in queue

        this.currentProcessingCount++;

        // Process the request asynchronously with retry logic
        // Pass initial retry attempt as 0
        this.processRequest(requestId, 0).finally(
          () => this.currentProcessingCount--,
        );
      }
    } catch (error) {
      this.logger.error('Error processing queued requests', error);
    }
  }

  private async processRequest(requestId: string, retryAttempt = 0) {
    try {
      await this.requestProcessor.processRequest(requestId);
      this.logger.log(`Request ${requestId} processed successfully`);
    } catch (error: unknown) {
      // Determine the error message safely
      let errorMessage = 'Unknown error during request processing';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error(
        `Error processing request ${requestId} (Attempt ${retryAttempt + 1}/${this.MAX_RETRIES + 1})`,
        errorMessage,
        // error instanceof Error ? error.stack : undefined, // Optionally log stack for Error instances
      );

      // Check for specific retryable error based on the determined message
      if (
        errorMessage.includes('Page not found or closed for tab') &&
        retryAttempt < this.MAX_RETRIES
      ) {
        this.logger.warn(
          `[RequestProcessorScheduler] Page not found for request ${requestId}, attempt ${retryAttempt + 1}/${this.MAX_RETRIES + 1}. Re-enqueueing with delay.`,
        );
        // Wait before re-enqueueing
        await new Promise((resolve) =>
          setTimeout(resolve, this.RETRY_DELAY_MS),
        );

        // Get original priority to potentially adjust it
        const originalRequest = await this.requestManager.getRequest(requestId);
        const priority = originalRequest
          ? originalRequest.priorityLevel + 1
          : 10; // Increase priority level (lower number = higher prio, so we increase number)

        await this.queueService.enqueueRequest(requestId, priority);
        this.logger.log(
          `Re-enqueued request ${requestId} with priority ${priority} after page not found error.`,
        );
        // Do NOT mark as FAILED here, let it retry
      } else if (errorMessage.includes('Tab not found for request')) {
        this.logger.error(
          `[RequestProcessorScheduler] Critical: Tab mapping lost for request ${requestId}. Marking as FAILED.`,
        );
        await this.requestManager.updateRequestStatus(
          requestId,
          RequestStatus.FAILED,
          { error: `Tab mapping lost: ${errorMessage}` }, // Use safe message
        );
      } else {
        // Other errors or max retries exceeded - mark as FAILED
        const reason =
          retryAttempt >= this.MAX_RETRIES &&
          errorMessage.includes('Page not found or closed for tab') // Check if max retries reached specifically for page not found
            ? `Max retries (${this.MAX_RETRIES}) reached for page not found error.`
            : `Non-retryable or final error: ${errorMessage}`; // Use safe message
        this.logger.error(
          `[RequestProcessorScheduler] Final error processing request ${requestId}. Marking as FAILED. Reason: ${reason}`,
        );
        await this.requestManager.updateRequestStatus(
          requestId,
          RequestStatus.FAILED,
          { error: reason }, // Use the constructed reason
        );
      }
      // No need to decrement currentProcessingCount here, it's handled in finally() in processQueuedRequests
    }
  }
}
