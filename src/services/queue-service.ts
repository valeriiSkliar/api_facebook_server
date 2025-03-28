import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@src/redis/redis.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly QUEUE_KEY = 'queue:scraping-tasks';

  constructor(private readonly redisService: RedisService) {}

  async enqueueRequest(requestId: string, priority: number): Promise<boolean> {
    try {
      // Using Redis sorted set for priority queue
      // Score is current timestamp + priority (lower priority = higher in queue)
      const score = Date.now() - priority * 1000;
      await this.redisService.zAdd(this.QUEUE_KEY, score, requestId);
      this.logger.log(
        `Request ${requestId} enqueued with priority ${priority}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to enqueue request ${requestId}`, error);
      return false;
    }
  }

  async dequeueRequest(): Promise<string | null> {
    try {
      // Get the highest priority request (lowest score)
      const result = await this.redisService.zPopMin(this.QUEUE_KEY);
      // Проверяем, что результат существует и является массивом
      if (!result || !Array.isArray(result) || result.length === 0) {
        return null;
      }

      const [requestId] = result;
      // Проверяем, что requestId валидное значение
      if (requestId) {
        this.logger.log(`Request ${requestId} dequeued for processing`);
        return requestId;
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to dequeue request', error);
      return null;
    }
  }
}
