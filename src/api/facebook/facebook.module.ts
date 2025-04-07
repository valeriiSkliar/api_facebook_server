import { Module, Logger } from '@nestjs/common';
import { ScraperController } from '../scraper/scraper-controller';
import { FacebookAdScraperService } from '../../services/FacebookAdScraperService';
import { SearchParameterService } from '../../services/SearchParameterService';
import { ScraperFactory } from '../../scrapers/common/factories/scraper-factory';
import { StepFactory } from '../../scrapers/common/factories/step-factory';
import { CoreModule } from '../../core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [ScraperController],
  providers: [
    FacebookAdScraperService,
    SearchParameterService,
    ScraperFactory,
    StepFactory,
    {
      provide: Logger,
      useValue: new Logger('FacebookApiModule'),
    },
  ],
  exports: [FacebookAdScraperService],
})
export class FacebookApiModule {}
