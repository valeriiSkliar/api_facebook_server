import { Logger, Injectable } from '@nestjs/common';
import { GenericScraperFactory } from '@src/scrapers/common/factories/generic-scraper-factory';
import {
  TiktokApiConfigContext,
  TiktokApiConfigOptions,
  TiktokApiConfigQuery,
  TiktokApiConfigResult,
  TiktokApiConfigState,
  TiktokApiConfigStep,
} from '../pipelines/api-config/tiktok-api-config-types';
import { ApiConfig } from '@src/modules/api-config'; // Assuming ApiConfig interface exists
import { GenericScraperPipeline } from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import { TiktokApiConfigStepFactory } from './tiktok-api-config-step.scraper.factory';

@Injectable()
export class TikTokApiConfigScraperFactory extends GenericScraperFactory<
  TiktokApiConfigQuery,
  TiktokApiConfigOptions,
  TiktokApiConfigState,
  TiktokApiConfigContext,
  TiktokApiConfigStep,
  TiktokApiConfigResult,
  ApiConfig
> {
  createScraper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: Partial<TiktokApiConfigOptions>,
  ): GenericScraperPipeline<
    TiktokApiConfigStep,
    TiktokApiConfigContext,
    TiktokApiConfigResult,
    ApiConfig
  > {
    const pipeline = new GenericScraperPipeline<
      TiktokApiConfigStep,
      TiktokApiConfigContext,
      TiktokApiConfigResult,
      ApiConfig
    >(this.logger);

    // Add steps to the pipeline
    const steps = this.getSteps();
    for (const step of steps) {
      pipeline.addStep(step);
    }

    return pipeline;
  }
  createContext(
    query: TiktokApiConfigQuery,
    options?: Partial<TiktokApiConfigOptions>,
  ): TiktokApiConfigContext {
    return {
      someProperty: '',
      query,
      options: this.mergeWithDefaultOptions(options),
      state: {
        accountId: query.accountId,
        adsCollected: [],
        configsCollected: [],
        errors: [],
        forceStop: false,
        hasMoreResults: true,
        currentPage: 0,
      },
    };
  }
  getSteps(): TiktokApiConfigStep[] {
    return [
      //   this.stepFactory.createInitializationStep(),
      //   this.stepFactory.createGetApiConfigStep(),
      //   this.stepFactory.createApiRequestStep(),
      //   this.stepFactory.createPaginationStep(),
    ];
  }
  constructor(
    protected readonly logger: Logger,
    private readonly stepFactory: TiktokApiConfigStepFactory,
  ) {
    super(logger);
  }
}
