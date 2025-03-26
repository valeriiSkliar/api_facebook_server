import { Module, Logger } from '@nestjs/common';
import { ScraperController } from '../controllers/ScraperController';
import { FacebookAdScraperService } from '../services/FacebookAdScraperService';
import { SearchParameterService } from '../services/SearchParameterService';
import { ScraperFactory } from '../implementations/factories/ScraperFactory';
import { StepFactory } from '../implementations/factories/StepFactory';

@Module({
  controllers: [ScraperController],
  providers: [
    FacebookAdScraperService,
    SearchParameterService,
    ScraperFactory,
    StepFactory,
    {
      provide: Logger,
      useValue: new Logger('ScraperModule'),
    },
  ],
  exports: [FacebookAdScraperService],
})
export class ScraperModule {}
