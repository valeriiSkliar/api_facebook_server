import { Module, Logger, forwardRef } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { QueueModule } from '@core/queue/queue.module';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/prisma/prisma.module';
import { ScraperRegistry } from '@src/services/ScraperRegistry';
import { ScraperFactory } from '@src/implementations/factories/ScraperFactory';
import { StepFactory } from '@src/implementations/factories/StepFactory';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
import { SearchParameterService } from '@src/services/SearchParameterService';
import { TabManager } from '@core/browser/browser-pool/tab-manager';
import { RedisModule } from '@core/storage/redis/redis.module';
import { CommonApiModule } from '@src/api/common/common-api.module';

@Module({
  imports: [
    QueueModule,
    BrowserPoolModule,
    PrismaModule,
    RedisModule,
    forwardRef(() => CommonApiModule),
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
