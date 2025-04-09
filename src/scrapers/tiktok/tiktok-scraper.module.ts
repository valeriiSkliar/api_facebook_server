import { Module, Logger } from '@nestjs/common';
import { TiktokApiScraper } from './tiktok-api.scraper';
import { TiktokQueryTransformer } from './transformers/tiktok-query.transformer';
import { TikTokScraperFactory } from './factories/tiktok-scraper.factory';
import { TiktokStepFactory } from './factories/tiktok-step.factory';
import { InitializationStep as TiktokInitializationStep } from './steps/initialization-step';
import { PrismaModule, PrismaService } from '@src/database';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ProcessMaterialsStep as TiktokProcessMaterialsStep } from './steps/process-materials-step';
import { ApiRequestStep as TiktokApiRequestStep } from './steps/api-request-step';
import { GetMatirialsIdStep as TiktokGetMatirialsIdStep } from './steps/get-matirials-id';
import { GetApiConfigStep as TiktokGetApiConfigStep } from './steps/get-api-config-step';
@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    Logger,
    PrismaService,
    TiktokApiScraper,
    TiktokQueryTransformer,
    TiktokStepFactory,
    TikTokScraperFactory,
    {
      provide: TiktokInitializationStep,
      useFactory: (logger: Logger) => {
        return new TiktokInitializationStep('InitializationStep', logger);
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
      provide: TiktokApiRequestStep,
      useFactory: (logger: Logger, httpService: HttpService) => {
        return new TiktokApiRequestStep('ApiRequestStep', logger, httpService);
      },
      inject: [Logger, HttpService],
    },
    {
      provide: TiktokGetMatirialsIdStep,
      useFactory: (logger: Logger) => {
        return new TiktokGetMatirialsIdStep('GetMatirialsIdStep', logger);
      },
      inject: [Logger],
    },
    {
      provide: TiktokProcessMaterialsStep,
      useFactory: (logger: Logger, httpService: HttpService) => {
        return new TiktokProcessMaterialsStep(
          'ProcessMaterialsStep',
          logger,
          httpService,
        );
      },
      inject: [Logger, HttpService],
    },
  ],
  exports: [TiktokApiScraper, TiktokStepFactory, TikTokScraperFactory],
})
export class TiktokScraperModule {}
