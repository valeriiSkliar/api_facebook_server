import { Module, Logger, forwardRef } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { QueueModule } from '@core/queue/queue.module';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { RequestManagerModule } from '@src/api/requests/requests.module';
import { ScraperModule } from '@src/scrapers/scraper.module';

@Module({
  imports: [
    QueueModule,
    BrowserPoolModule,
    RequestManagerModule,
    forwardRef(() => ScraperModule),
  ],
  providers: [Logger, WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
