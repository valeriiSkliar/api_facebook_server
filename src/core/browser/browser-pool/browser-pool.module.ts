// src/services/browser-pool/browser-pool.module.ts

import { Module, Global } from '@nestjs/common';
import { BrowserPoolService } from './browser-pool-service';
import { BrowserLifecycleManager } from '../lifecycle/browser-lifecycle-manager';
import { BrowserStorageService } from './browser-storage-service';
import { BrowserMetricsService } from './browser-metrics-service';
import { RedisModule } from '@core/storage/redis/redis.module';
import { TabManager } from '../tab-manager/tab-manager';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    BrowserPoolService,
    BrowserLifecycleManager,
    BrowserStorageService,
    BrowserMetricsService,
    TabManager,
  ],
  exports: [
    BrowserPoolService,
    BrowserLifecycleManager,
    BrowserStorageService,
    BrowserMetricsService,
    TabManager,
  ],
})
export class BrowserPoolModule {}
