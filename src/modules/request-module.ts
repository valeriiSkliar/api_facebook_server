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
@Module({
  imports: [PrismaModule, RedisModule, ScheduleModule.forRoot()],
  controllers: [RequestController],
  providers: [
    RequestManagerService,
    BrowserPoolService,
    CacheService,
    RequestScheduler,
    QueueService,
    {
      provide: Logger,
      useValue: new Logger('RequestModule'),
    },
  ],
  exports: [RequestManagerService, BrowserPoolService, CacheService],
})
export class RequestModule {}
