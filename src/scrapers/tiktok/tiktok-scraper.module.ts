import { Module } from '@nestjs/common';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { TiktokStepFactory } from './factories/tiktok-step.factory';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { TiktokApiScraper } from './tiktok-api.scraper';
import { InitializationStep as TiktokInitializationStep } from './steps/initialization-step';
import { ProcessMaterialsStep as TiktokProcessMaterialsStep } from './steps/process-materials-step';
import { FilterMaterialsStep as TiktokFilterMaterialsStep } from './steps/filter-materials.step';
import { ApiRequestStep as TiktokApiRequestStep } from './steps/api-request-step';
import { GetMatirialsIdStep as TiktokGetMatirialsIdStep } from './steps/get-matirials-id';
import { GetApiConfigStep as TiktokGetApiConfigStep } from './steps/get-api-config-step';
import { SaveCreativesStep } from './steps/save-creatives.step';
import { TiktokCreativeService } from './services/tiktok-creative.service';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { PaginationStep as TiktokPaginationStep } from './steps/pagination-step';
import { ReportingModule } from '@src/core/reporting/reporting.module';
import { CoreModule } from '@src/core/core.module';
import { ScraperStateModule } from '@src/core/storage/scraper-state/scraper-state.module';
import { IScraperStateStorage } from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get('HTTP_TIMEOUT', 5000),
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
    ReportingModule,
    CoreModule,
    ScraperStateModule,
  ],
  providers: [
    TikTokScraperFactory,
    TiktokStepFactory,
    Logger,
    PrismaService,
    TiktokApiScraper,
    TiktokCreativeService,
    TiktokQueryTransformer,
    {
      provide: TiktokInitializationStep,
      useFactory: (logger: Logger, stateStorage: IScraperStateStorage) => {
        return new TiktokInitializationStep(
          'InitializationStep',
          logger,
          stateStorage,
        );
      },
      inject: [Logger, SCRAPER_STATE_STORAGE],
    },
    {
      provide: TiktokProcessMaterialsStep,
      useFactory: (
        logger: Logger,
        httpService: HttpService,
        stateStorage: IScraperStateStorage,
      ) => {
        return new TiktokProcessMaterialsStep(
          'ProcessMaterialsStep',
          logger,
          httpService,
          stateStorage,
        );
      },
      inject: [Logger, HttpService, SCRAPER_STATE_STORAGE],
    },
    {
      provide: TiktokFilterMaterialsStep,
      useFactory: (logger: Logger, prisma: PrismaService) => {
        return new TiktokFilterMaterialsStep(
          'FilterMaterialsStep',
          logger,
          prisma,
        );
      },
      inject: [Logger, PrismaService],
    },
    {
      provide: TiktokApiRequestStep,
      useFactory: (logger: Logger, httpService: HttpService) => {
        return new TiktokApiRequestStep('ApiRequestStep', logger, httpService);
      },
      inject: [Logger, HttpService],
    },
    {
      provide: TiktokPaginationStep,
      useFactory: (logger: Logger) => {
        return new TiktokPaginationStep('PaginationStep', logger);
      },
      inject: [Logger],
    },
    {
      provide: TiktokGetMatirialsIdStep,
      useFactory: (logger: Logger) => {
        return new TiktokGetMatirialsIdStep('GetMatirialsIdStep', logger);
      },
      inject: [Logger],
    },
    {
      provide: TiktokGetApiConfigStep,
      useFactory: (logger: Logger, prisma: PrismaService) => {
        return new TiktokGetApiConfigStep('GetApiConfigStep', logger, prisma);
      },
      inject: [Logger, PrismaService],
    },
    {
      provide: SaveCreativesStep,
      useClass: SaveCreativesStep,
    },
  ],
  exports: [TiktokApiScraper, TiktokStepFactory, TikTokScraperFactory],
})
export class TiktokScraperModule {}
