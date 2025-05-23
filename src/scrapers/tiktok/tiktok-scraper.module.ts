import { Module } from '@nestjs/common';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { TiktokStepFactory } from './factories/tiktok-step.factory';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { TiktokApiScraper } from './tiktok-api.scraper';
import { InitializationStep as TiktokInitializationStep } from './steps/tik-tok-scraper/initialization-step';
import { ProcessMaterialsStep as TiktokProcessMaterialsStep } from './steps/tik-tok-scraper/process-materials-step';
import { FilterMaterialsStep as TiktokFilterMaterialsStep } from './steps/tik-tok-scraper/filter-materials.step';
import { ApiRequestStep as TiktokApiRequestStep } from './steps/tik-tok-scraper/api-request-step';
import { GetMatirialsIdStep as TiktokGetMatirialsIdStep } from './steps/tik-tok-scraper/get-matirials-id';
import { GetApiConfigStep as TiktokGetApiConfigStep } from './steps/tik-tok-scraper/get-api-config-step';
import { SaveCreativesStep } from './steps/tik-tok-scraper/save-creatives.step';
import { TiktokCreativeService } from './services/tiktok-creative.service';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { PaginationStep as TiktokPaginationStep } from './steps/tik-tok-scraper/pagination-step';
import { ReportingModule } from '@src/core/reporting/reporting.module';
import { CoreModule } from '@src/core/core.module';
import { ScraperStateModule } from '@src/core/storage/scraper-state/scraper-state.module';
import { IScraperStateStorage } from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';
import { ErrorDiagnosticStep } from './steps/tik-tok-scraper/error-diagnostic-step';
import { ErrorReportingService } from '@src/core/reporting/services/error-reporting-service';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ErrorAnalysisStep } from './steps/tik-tok-scraper/error-analysis-step';
import { TikTokApiConfigAdapter } from './services/api-config.scraper/tiktok-api-config-adapter';
import { ApiConfigManager } from './services/api-config.scraper/api-config-manager';
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
    ApiConfigManager,

    TikTokApiConfigAdapter,
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
        apiConfigAdapter: TikTokApiConfigAdapter,
      ) => {
        return new TiktokProcessMaterialsStep(
          'ProcessMaterialsStep',
          logger,
          httpService,
          stateStorage,
          apiConfigAdapter,
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
      useFactory: (
        logger: Logger,
        httpService: HttpService,
        apiConfigAdapter: TikTokApiConfigAdapter,
      ) => {
        return new TiktokApiRequestStep(
          'ApiRequestStep',
          logger,
          httpService,
          apiConfigAdapter,
        );
      },
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
      useFactory: (
        logger: Logger,
        apiConfigAdapter: TikTokApiConfigAdapter,
      ) => {
        return new TiktokGetApiConfigStep(
          'GetApiConfigStep',
          logger,
          apiConfigAdapter,
        );
      },
      inject: [Logger, PrismaService],
    },
    {
      provide: 'ErrorAnalysisStep',
      useFactory: (
        logger: Logger,
        errorReportingService: ErrorReportingService,
        apiResponseAnalyzer: ApiResponseAnalyzer,
      ) => {
        return new ErrorAnalysisStep(
          'ErrorAnalysisStep',
          logger,
          errorReportingService,
          apiResponseAnalyzer,
        );
      },
      inject: [Logger, ErrorReportingService, ApiResponseAnalyzer],
    },
    {
      provide: ErrorDiagnosticStep,
      useFactory: (logger: Logger, prisma: PrismaService) => {
        return new ErrorDiagnosticStep('ErrorDiagnosticStep', logger, prisma);
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
