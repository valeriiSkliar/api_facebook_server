import { Module, Logger } from '@nestjs/common';
import { ScraperController } from '../scraper/scraper-controller';
import { SearchParameterService } from '../../services/SearchParameterService';
import { CoreModule } from '../../core/core.module';
import { ScraperModule } from '../../scrapers/scraper.module';

@Module({
  imports: [CoreModule, ScraperModule],
  controllers: [ScraperController],
  providers: [
    SearchParameterService,
    {
      provide: Logger,
      useValue: new Logger('FacebookApiModule'),
    },
  ],
  exports: [],
})
export class FacebookApiModule {}
