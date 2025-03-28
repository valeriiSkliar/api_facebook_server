import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestController } from '../controllers/request-controller';
import { RequestManagerService } from '../services/request-manager-service';
import { BrowserPoolService } from '../services/browser-pool-service';
import { CacheService } from '../services/cache-service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RequestScheduler } from '../schedulers/request-scheduler';
import { QueueService } from '../services/queue-service';
import { ScraperRegistry } from '../services/ScraperRegistry';
import { StepFactory } from '../implementations/factories/StepFactory';
import { ScraperFactory } from '../implementations/factories/ScraperFactory';
import { WorkerService } from '../services/worker-service';
import { RequestProcessorScheduler } from '../schedulers/request-processor-scheduler';
import { RequestProcessorService } from '../services/request-processor-service';
import { FacebookAdScraperService } from '../services/FacebookAdScraperService';

@Module({
  imports: [PrismaModule, RedisModule, ScheduleModule.forRoot()],
  controllers: [RequestController],
  providers: [
    RequestManagerService,
    BrowserPoolService,
    CacheService,
    RequestScheduler,
    QueueService,
    WorkerService,
    RequestProcessorService,
    RequestProcessorScheduler,
    ScraperRegistry,
    StepFactory,
    ScraperFactory,
    FacebookAdScraperService,
    {
      provide: Logger,
      useValue: new Logger('RequestModule'),
    },
  ],
  exports: [RequestManagerService, BrowserPoolService, CacheService],
})
export class RequestModule {}
