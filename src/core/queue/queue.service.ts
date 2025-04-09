import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@core/storage/redis/redis.service';

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

  /**
  //  * Получить текущий размер очереди.
  //  * @returns Количество элементов в очереди.
  //  */
  // async getQueueSize(): Promise<number> {
  //   try {
  //     return await this.redisService.zCard(this.QUEUE_KEY);
  //   } catch (error) {
  //     this.logger.error('Failed to get queue size', error);
  //     return 0;
  //   }
  // }

  // /**
  //  * Очистить всю очередь (использовать с осторожностью!).
  //  */
  // async clearQueue(): Promise<void> {
  //   try {
  //     await this.redisService.del(this.QUEUE_KEY);
  //     this.logger.log(`Queue ${this.QUEUE_KEY} cleared.`);
  //   } catch (error) {
  //     this.logger.error('Failed to clear queue', error);
  //   }
  // }

  // /**
  //  * Посмотреть элементы в очереди без извлечения.
  //  * @param start Начальный индекс (0 - первый элемент)
  //  * @param stop Конечный индекс (-1 - последний элемент)
  //  * @returns Массив ID запросов.
  //  */
  // async peekQueue(start: number = 0, stop: number = -1): Promise<string[]> {
  //   try {
  //     // Получаем элементы из отсортированного множества по рангу (индексу)
  //     return await this.redisService.zRange(this.QUEUE_KEY, start, stop);
  //   } catch (error) {
  //     this.logger.error('Failed to peek queue', error);
  //     return [];
  //   }
  // }
}
