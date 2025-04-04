import { Module, Logger } from '@nestjs/common';
import { ScraperController } from '../controllers/scraper-controller';
import { FacebookAdScraperService } from '../../services/FacebookAdScraperService';
import { SearchParameterService } from '../../services/SearchParameterService';
import { ScraperFactory } from '../../implementations/factories/ScraperFactory';
import { StepFactory } from '../../implementations/factories/StepFactory';
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
