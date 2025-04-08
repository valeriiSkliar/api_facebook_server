import { Module, Logger } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { QueueModule } from '@core/queue/queue.module';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { RequestManagerModule } from '@src/api/requests/requests.module';
import { ScraperRegistry } from '@src/services/ScraperRegistry';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { StepFactory } from '@src/scrapers/common/factories/step-factory';
import { FacebookApiModule } from '@src/api/facebook/facebook.module';
import { TiktokAdScraperService } from '@src/scrapers/tiktok/tik-tok-ad-scraper-service';
@Module({
  imports: [
    QueueModule,
    BrowserPoolModule,
    RequestManagerModule,
    FacebookApiModule,
  ],
  providers: [
    Logger,
    WorkerService,
    ScraperRegistry,
    ScraperFactory,
    StepFactory,
    TiktokAdScraperService,
  ],
  exports: [WorkerService],
})
export class WorkerModule {}
