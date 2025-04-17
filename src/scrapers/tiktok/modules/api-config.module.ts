import { Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiConfigurationSchedulerService } from '../services/api-config.scraper/api-configuration-scheduler.service';
import { PrismaModule } from '@src/database/prisma.module';
import { BrowserPoolModule } from '@src/core/browser/browser-pool';
import { TikTokApiConfigScraperFactory } from '../factories/tiktok-api-config.scraper.factory';
import { TiktokApiConfigStepFactory } from '../factories/tiktok-api-config-step.scraper.factory';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    BrowserPoolModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    Logger,
    ApiConfigurationSchedulerService,
    TikTokApiConfigScraperFactory,
    TiktokApiConfigStepFactory,
  ],
  exports: [ApiConfigurationSchedulerService],
})
export class ApiConfigModule {}
