import { Module } from '@nestjs/common';
import { ScraperRecoveryController } from './scraper-recovery.controller';
import { ScraperRecoveryModule as ScraperRecoveryServiceModule } from '@src/scrapers/common/services/scraper-recovery.module';

@Module({
  imports: [ScraperRecoveryServiceModule],
  controllers: [ScraperRecoveryController],
})
export class ScraperRecoveryApiModule {}
