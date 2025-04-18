import { Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiConfigurationSchedulerService } from '../services/api-config.scraper/api-configuration-scheduler.service';
import { PrismaModule } from '@src/database/prisma.module';
import { BrowserPoolModule } from '@src/core/browser/browser-pool';
import { TikTokApiConfigScraperFactory } from '../factories/tiktok-api-config.scraper.factory';
import { TiktokApiConfigStepFactory } from '../factories/tiktok-api-config-step.scraper.factory';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionManagerModule } from '@src/services/session-manager/session-manager.module';
import { ApiConfigManager } from '../services/api-config.scraper/api-config-manager';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    BrowserPoolModule,
    ScheduleModule.forRoot(),
    SessionManagerModule,
    ScheduleModule.forRoot(), // For scheduled tasks
  ],
  providers: [
    ApiConfigManager,

    Logger,
    ApiConfigurationSchedulerService,
    TikTokApiConfigScraperFactory,
    TiktokApiConfigStepFactory,
  ],
  exports: [ApiConfigurationSchedulerService, ApiConfigManager],
})
export class ApiConfigModule {}
