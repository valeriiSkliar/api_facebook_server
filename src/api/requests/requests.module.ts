import { Module } from '@nestjs/common';
import { RequestManagerService } from './request-manager-service';
import { RedisModule } from '@core/storage/redis/redis.module';
import { PrismaModule } from '@src/database';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { QueueModule } from '@core/queue/queue.module';
import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
import { RequestController } from './request-controller';

@Module({
  imports: [RedisModule, PrismaModule, BrowserPoolModule, QueueModule],
  providers: [RequestManagerService, TabManager],
  controllers: [RequestController],
  exports: [RequestManagerService],
})
export class RequestManagerModule {}
