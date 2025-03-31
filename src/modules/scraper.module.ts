import { Module, Logger } from '@nestjs/common';
import { ScraperController } from '../controllers/ScraperController';
import { FacebookAdScraperService } from '../services/FacebookAdScraperService';
import { SearchParameterService } from '../services/SearchParameterService';
import { ScraperFactory } from '../implementations/factories/ScraperFactory';
import { StepFactory } from '../implementations/factories/StepFactory';
import { BrowserPoolService } from '../services/browser-pool-service';
@Module({
  controllers: [ScraperController],
  providers: [
    FacebookAdScraperService,
    SearchParameterService,
    ScraperFactory,
    StepFactory,
    BrowserPoolService,
    {
      provide: Logger,
      useValue: new Logger('ScraperModule'),
    },
  ],
  exports: [FacebookAdScraperService],
})
export class ScraperModule {}
