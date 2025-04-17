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
import { GenericScraperPipeline } from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import { TiktokApiConfigStepFactory } from './tiktok-api-config-step.scraper.factory';
import { ApiConfig } from '../pipelines/api-config/api-config.interface';

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
      query,
      options: options || {},
      state: {
        adsCollected: [],
        errors: [],
        forceStop: false,
        accountsWithValidSessions: [],
        browserContexts: [],
        currentAccountIndex: 0,
        processingAccounts: new Set(),
        hasMoreResults: true,
        currentPage: 0,
      },
    };
  }

  getSteps(): TiktokApiConfigStep[] {
    return [
      this.stepFactory.createInitAccountsStep(),
      this.stepFactory.createOpenTabsStep(),
      this.stepFactory.createNavigationAndRestoreStep(),
      this.stepFactory.createSessionRestoreStep(),
      this.stepFactory.createCleanupStep(),
      // this.stepFactory.createApiConfigCollectionStep(),
    ];
  }

  /**
   * Merges the provided options with the default options.
   * @param options The options to merge with the default options.
   * @returns The merged options.
   */
  protected mergeWithDefaultOptions(
    options?: Partial<TiktokApiConfigOptions>,
  ): TiktokApiConfigOptions {
    const defaultOptions: TiktokApiConfigOptions = {
      behavior: {
        applyFilters: false,
        maxPages: 10,
        waitForResults: true,
        waitTimeout: 30000,
      },
    };

    return {
      ...defaultOptions,
      ...options,
    };
  }
  constructor(
    protected readonly logger: Logger,
    private readonly stepFactory: TiktokApiConfigStepFactory,
  ) {
    super(logger);
  }
}
