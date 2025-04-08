import { Module } from '@nestjs/common';
import { TiktokApiScraper } from './tiktok-api.scraper';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';

@Module({
  providers: [TiktokApiScraper, TiktokQueryTransformer],
  exports: [TiktokApiScraper],
})
export class TiktokScraperModule {}
