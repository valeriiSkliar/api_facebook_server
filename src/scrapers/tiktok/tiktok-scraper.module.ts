import { Module, Logger } from '@nestjs/common';
import { TiktokApiScraper } from './tiktok-api.scraper';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { TiktokStepFactory } from './factories/tiktok-step.factory';
import { InitializationStep as TiktokInitializationStep } from './steps/initialization-step';
import { PrismaModule } from '@src/database';
@Module({
  imports: [PrismaModule],
  providers: [
    Logger,
    TiktokApiScraper,
    TiktokQueryTransformer,
    TiktokStepFactory,
    TikTokScraperFactory,
    TiktokInitializationStep,
  ],
  exports: [TiktokApiScraper, TiktokStepFactory, TikTokScraperFactory],
})
export class TiktokScraperModule {}
