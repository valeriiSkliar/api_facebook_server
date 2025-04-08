import { Module, Logger, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '@core/core.module';
import { ScraperRegistry } from '@src/scrapers/common/scraper.registry';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
import { FacebookBrowserScraper } from './facebook/facebook-browser.scraper';
import { TiktokApiScraper } from './tiktok/tiktok-api.scraper';
import { StepFactory } from './common/factories/step-factory';
// Импортируйте другие реализации IScraper по мере необходимости

@Module({
  imports: [
    forwardRef(() => CoreModule), // Используем forwardRef для CoreModule
    HttpModule,
  ],
  providers: [
    Logger,
    ScraperRegistry,
    ScraperFactory,
    StepFactory,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    TiktokApiScraper,
    // Добавьте другие реализации IScraper здесь
  ],
  exports: [
    ScraperRegistry,
    ScraperFactory,
    FacebookAdScraperService,
    FacebookBrowserScraper,
    TiktokApiScraper,
    // Removed HttpModule export
    // Экспортируйте другие реализации IScraper здесь
  ],
})
export class ScraperModule {}
