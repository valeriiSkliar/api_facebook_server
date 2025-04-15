import { Module, Logger, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '@core/core.module';
import { ScraperRegistry } from '@src/scrapers/common/scraper.registry';
import { FacebookScraperFactory } from '@src/scrapers/common/factories/facabook-scraper-factory';
import { FacebookAdScraperService } from '@src/services/facebook-ad-scraper-service';
import { FacebookBrowserScraper } from './facebook/facebook-browser.scraper';
import { FacebookStepFactory } from './common/factories/facebook-step-factory';
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
  providers: [
    Logger,
    ScraperRegistry,
    FacebookScraperFactory,
    FacebookStepFactory,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    TiktokQueryTransformer,

    // TiktokApiScraper,
    // Добавьте другие реализации IScraper здесь
  ],
  exports: [
    ScraperRegistry,
    FacebookScraperFactory,
    TiktokScraperModule,
    FacebookScraperModule,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    // TiktokApiScraper,
    // Removed HttpModule export
    // Экспортируйте другие реализации IScraper здесь
    // FacebookScraperModule,
  ],
})
export class ScraperModule {}
