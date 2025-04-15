import { Module, Logger, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '@core/core.module';
import { ScraperRegistry } from '@src/scrapers/common/scraper.registry';

import { TiktokScraperModule } from './tiktok/tiktok-scraper.module';
import { TiktokQueryTransformer } from './tiktok/transformers/tiktok-query.transformer';
import { FacebookScraperModule } from './facebook/facebook-scraper-module';
// import { FacebookScraperModule } from './facebook/facebook-scraper.module';
// Импортируйте другие реализации IScraper по мере необходимости

@Module({
  imports: [
    forwardRef(() => CoreModule), // Используем forwardRef для CoreModule
    HttpModule,
    TiktokScraperModule,
    FacebookScraperModule,
  ],
  providers: [Logger, ScraperRegistry, TiktokQueryTransformer],
  exports: [ScraperRegistry, TiktokScraperModule, FacebookScraperModule],
})
export class ScraperModule {}
