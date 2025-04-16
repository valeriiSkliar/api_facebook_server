import { Module } from '@nestjs/common';
import { ApiConfigStorageService } from './services/api-config-storage.service';
import { PrismaModule } from '@src/database/prisma.module';
import { BrowserPoolModule } from '@src/core';
import { ApiConfigurationSchedulerService } from './services/api-configuration-scheduler.service';
import { ApiConfigLifecycleManager } from './services/api-config-lifecycle-manager.service';
import { ApiConfigMetricsService } from './services/api-config-metrics.service';
import { ApiConfigProcessor } from './services/api-config-processor.service';

@Module({
  imports: [PrismaModule, BrowserPoolModule],
  providers: [
    ApiConfigurationSchedulerService,
    ApiConfigLifecycleManager,
    ApiConfigStorageService,
    ApiConfigMetricsService,
    ApiConfigProcessor,
  ],
  exports: [ApiConfigurationSchedulerService, ApiConfigStorageService],
})
export class ApiConfigModule {}
