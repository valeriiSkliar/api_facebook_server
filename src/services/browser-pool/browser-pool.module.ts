// src/services/browser-pool/browser-pool.module.ts

import { Module } from '@nestjs/common';
import { BrowserPoolService } from './browser-pool-service';
import { BrowserLifecycleManager } from './browser-lifecycle-manager';
import { BrowserStorageService } from './browser-storage-service';
import { BrowserMetricsService } from './browser-metrics-service';
import { RedisModule } from '../../redis/redis.module';
import { TabManager } from './tab-manager';

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
