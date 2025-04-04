import { Module, Logger } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { QueueModule } from '@core/queue/queue.module';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/database';
import { ScraperRegistry } from '@src/services/ScraperRegistry';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { StepFactory } from '@src/scrapers/common/factories/step-factory';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
import { SearchParameterService } from '@src/services/SearchParameterService';
import { TabManager } from '@core/browser/browser-pool/tab-manager';
import { RedisModule } from '@core/storage/redis/redis.module';
import { RequestManagerModule } from '@src/services/request-manager';

@Module({
  imports: [
    QueueModule,
    BrowserPoolModule,
    PrismaModule,
    RedisModule,
    RequestManagerModule,
  ],
  providers: [
    WorkerService,
    ScraperRegistry,
    ScraperFactory,
    StepFactory,
    FacebookAdScraperService,
    SearchParameterService,
    TabManager,
    {
      provide: Logger,
      useValue: new Logger('WorkerModule'),
    },
  ],
  exports: [WorkerService],
})
export class WorkerModule {}
