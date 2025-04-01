// src/services/browser-pool/browser-pool.module.ts

import { Module } from '@nestjs/common';
import { BrowserPoolService } from './browser-pool-service';
import { BrowserLifecycleManager } from './browser-lifecycle-manager';
import { BrowserStorageService } from './browser-storage-service';
import { BrowserMetricsService } from './browser-metrics-service';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    BrowserPoolService,
    BrowserLifecycleManager,
    BrowserStorageService,
    BrowserMetricsService,
  ],
  exports: [
    BrowserPoolService,
    BrowserLifecycleManager,
    BrowserStorageService,
    BrowserMetricsService,
  ],
})
export class BrowserPoolModule {}
