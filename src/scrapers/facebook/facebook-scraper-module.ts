// src/scrapers/facebook/facebook-scraper.module.ts

import { Module, Logger, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CoreModule } from '@src/core/core.module';
import { FacebookBrowserScraper } from './facebook-browser.scraper';
import { ResponseCacheService } from '@src/services/ResponseCacheService';
import { ScraperStateModule } from '@src/core/storage/scraper-state/scraper-state.module';
import { FacebookScraperFactory } from './factories/facebook-scraper-factory';
import { FacebookStepFactory } from './factories/facebook-step-factory';
import { RequestCaptureService } from '@src/services';
import { FacebookAdScraperService } from '@src/services/facebook-ad-scraper-service';
import { FacebookCreativeModule } from './services/facebook-creative-module';

@Module({
  imports: [
    forwardRef(() => CoreModule),
    HttpModule,
    ScraperStateModule,
    FacebookCreativeModule,
  ],
  providers: [
    Logger,
    FacebookBrowserScraper,
    FacebookScraperFactory,
    FacebookStepFactory,
    ResponseCacheService,
    RequestCaptureService,
    {
      provide: FacebookAdScraperService,
      useClass: FacebookAdScraperService,
    },
  ],
  exports: [
    FacebookBrowserScraper,
    FacebookScraperFactory,
    FacebookAdScraperService,
  ],
})
export class FacebookScraperModule {}
