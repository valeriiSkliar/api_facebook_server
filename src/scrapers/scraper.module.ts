import { Module } from '@nestjs/common';
import { CoreModule } from '@core/core.module';
import { ScraperRegistry } from '@src/services/scraper.registry';
import { ScraperFactory } from '@src/scrapers/common/factories/scraper-factory';
import { FacebookAdScraperService } from '@src/services/FacebookAdScraperService';
// Импортируйте другие реализации IScraper по мере необходимости

@Module({
  imports: [
    CoreModule, // Импортируем CoreModule для доступа к BrowserPoolService и другим сервисам
  ],
  providers: [
    ScraperRegistry,
    ScraperFactory,
    FacebookAdScraperService,
    // Добавьте другие реализации IScraper здесь
  ],
  exports: [
    ScraperRegistry,
    ScraperFactory,
    FacebookAdScraperService,
    // Экспортируйте другие реализации IScraper здесь
  ],
})
export class ScraperModule {}
