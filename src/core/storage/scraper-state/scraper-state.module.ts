// src/core/storage/scraper-state/scraper-state.module.ts

import { Module } from '@nestjs/common';
import { RedisModule } from '@core/storage/redis/redis.module';
import { RedisScraperStateStorage } from './redis-scraper-state-storage';
import { SCRAPER_STATE_STORAGE } from './scraper-state-storage.token';

@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: SCRAPER_STATE_STORAGE,
      useClass: RedisScraperStateStorage,
    },
  ],
  exports: [SCRAPER_STATE_STORAGE],
})
export class ScraperStateModule {}
