import { Module, Logger, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '@core/core.module';
import { ScraperRegistry } from '@src/scrapers/common/scraper.registry';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { FacebookAdScraperService } from '@src/services/facebook-ad-scraper-service';
import { FacebookBrowserScraper } from './facebook/facebook-browser.scraper';
import { StepFactory } from './common/factories/step-factory';
import { TiktokScraperModule } from './tiktok/tiktok-scraper.module';
import { TiktokQueryTransformer } from './tiktok/transformers/tiktok-query.transformer';
// import { FacebookScraperModule } from './facebook/facebook-scraper.module';
// Импортируйте другие реализации IScraper по мере необходимости

@Module({
  imports: [
    forwardRef(() => CoreModule), // Используем forwardRef для CoreModule
    HttpModule,
    TiktokScraperModule,
    // FacebookScraperModule,
  ],
  providers: [
    Logger,
    ScraperRegistry,
    ScraperFactory,
    StepFactory,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    TiktokQueryTransformer,

    // TiktokApiScraper,
    // Добавьте другие реализации IScraper здесь
  ],
  exports: [
    ScraperRegistry,
    ScraperFactory,
    TiktokScraperModule,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    // TiktokApiScraper,
    // Removed HttpModule export
    // Экспортируйте другие реализации IScraper здесь
    // FacebookScraperModule,
  ],
})
export class ScraperModule {}
