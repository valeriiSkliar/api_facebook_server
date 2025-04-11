// src/scrapers/common/services/scraper-recovery.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperRecoveryService } from './scraper-recovery.service';
import { ScraperStateModule } from '@src/core/storage/scraper-state/scraper-state.module';
import { ScraperModule } from '@src/scrapers/scraper.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // For @Cron decorators
    ScraperStateModule, // For state storage
    ScraperModule, // For scraper factories
  ],
  providers: [ScraperRecoveryService],
  exports: [ScraperRecoveryService],
})
export class ScraperRecoveryModule {}
