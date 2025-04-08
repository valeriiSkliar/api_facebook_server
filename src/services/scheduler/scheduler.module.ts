import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestScheduler } from './request-scheduler';

import { QueueModule } from '@core/queue/queue.module';
import { WorkerModule } from '@src/core/worker/worker.module';
import { RequestManagerModule } from '@src/api/requests/requests.module';
import { BrowserPoolModule } from '@src/core/browser/browser-pool/browser-pool.module';
import { CacheModule } from '@core/cache/cache.module';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => WorkerModule),
    QueueModule,
    RequestManagerModule,
    BrowserPoolModule,
    CacheModule,
  ],
  providers: [RequestScheduler],
})
export class SchedulerModule {}
