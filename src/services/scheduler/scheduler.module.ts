import { Module } from '@nestjs/common';
import { RequestProcessorScheduler } from './request-processor-scheduler';
import { RequestManagerModule } from '@src/api/requests/requests.module';
import { QueueModule } from '@src/core/queue/queue.module';
import { BrowserPoolModule } from '@src/core/browser/browser-pool/browser-pool.module';
import { FacebookApiModule } from '@src/api/facebook/facebook.module';
import { RequestProcessorService } from '../workers/request-processor-service';
import { TabManager } from '@src/core/browser/tab-manager/tab-manager';
import { BrowserLifecycleManager } from '@src/core/browser/lifecycle/browser-lifecycle-manager';

@Module({
  imports: [
    RequestManagerModule,
    BrowserPoolModule,
    QueueModule,
    FacebookApiModule,
  ],
  providers: [
    RequestProcessorScheduler,
    RequestProcessorService,
    TabManager,
    BrowserLifecycleManager,
  ],
  exports: [RequestProcessorScheduler],
})
export class SchedulerModule {}
