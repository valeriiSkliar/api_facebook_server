import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '@core/queue/queue.service';
import { RequestProcessorService } from '../workers/request-processor-service';
import { RequestManagerService } from '@src/api/requests/request-manager-service';

@Injectable()
export class RequestProcessorScheduler {
  private readonly logger = new Logger(RequestProcessorScheduler.name);
  private readonly MAX_CONCURRENT_REQUESTS = 5;
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

        // Process the request asynchronously
        this.processRequest(requestId).finally(
          () => this.currentProcessingCount--,
        );
      }
    } catch (error) {
      this.logger.error('Error processing queued requests', error);
    }
  }

  private async processRequest(requestId: string) {
    try {
      await this.requestProcessor.processRequest(requestId);
      this.logger.log(`Request ${requestId} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing request ${requestId}`, error);
    }
  }
}
