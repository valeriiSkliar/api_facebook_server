import { Module } from '@nestjs/common';
import { BrowserPoolModule } from './browser/browser-pool';
import { QueueModule } from './queue/queue.module';
import { CacheModule } from './cache/cache.module';
import { WorkerModule } from './worker/worker.module';
import { FileStorageModule } from './storage/file-storage/file-storage.module';

@Module({
  imports: [
    BrowserPoolModule,
    QueueModule,
    CacheModule,
    WorkerModule,
    FileStorageModule,
  ],
  exports: [
    BrowserPoolModule,
    QueueModule,
    CacheModule,
    WorkerModule,
    FileStorageModule,
  ],
})
export class CoreModule {}
