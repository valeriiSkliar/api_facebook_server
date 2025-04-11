import { Module } from '@nestjs/common';
import { BrowserPoolModule } from './browser/browser-pool';
import { QueueModule } from './queue/queue.module';
import { CacheModule } from './cache/cache.module';
// import { WorkerModule } from './worker/worker.module';
import { FileStorageModule } from './storage/file-storage/file-storage.module';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from './storage/redis/redis.module';
import { ApiAnalyzerModule } from './api/analyzer/api-analyzer.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BrowserPoolModule,
    QueueModule,
    CacheModule,
    // WorkerModule,
    FileStorageModule,
    ApiAnalyzerModule,
  ],
  exports: [
    PrismaModule,
    RedisModule,
    BrowserPoolModule,
    QueueModule,
    CacheModule,
    // WorkerModule,
    FileStorageModule,
    ApiAnalyzerModule,
  ],
})
export class CoreModule {}
