/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
// import { ScraperPipeline } from '../../common/pipeline';
import { TiktokStepFactory } from './tiktok-step.factory';
import { GenericScraperPipeline } from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import {
  TiktokMaterial,
  TiktokScraperContext,
  TiktokScraperQuery,
} from '../tiktok-scraper-types';
import { TiktokScraperOptions } from '../tiktok-scraper-types';
import { TiktokScraperResult } from '../tiktok-scraper-types';
import { TiktokScraperState } from '../tiktok-scraper-types';
import { GenericScraperFactory } from '@src/scrapers/common/factories/generic-scraper-factory';
import { TiktokScraperStep } from '../steps/tiktok-scraper-step';
import { TikTokAdData } from '../models/tiktok-ad-data';
@Injectable()
export class TikTokScraperFactory extends GenericScraperFactory<
  TiktokScraperQuery,
  TiktokScraperOptions,
  TiktokScraperState,
  TiktokScraperContext,
  TiktokScraperStep,
  TiktokScraperResult,
  TiktokMaterial
> {
  createScraper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: Partial<TiktokScraperOptions>,
  ): GenericScraperPipeline<
    TiktokScraperStep,
    TiktokScraperContext,
    TiktokScraperResult,
    TikTokAdData
  > {
    const pipeline = new GenericScraperPipeline<
      TiktokScraperStep,
      TiktokScraperContext,
      TiktokScraperResult,
      TikTokAdData
    >(this.logger);

    // Add steps to the pipeline
    const steps = this.getSteps();
    for (const step of steps) {
      pipeline.addStep(step);
    }

    return pipeline;
  }
  createContext(
    query: TiktokScraperQuery,
    options?: Partial<TiktokScraperOptions>,
  ): TiktokScraperContext {
    return {
      query,
      options: this.mergeWithDefaultOptions(options),
      state: {
        adsCollected: [],
        errors: [],
        forceStop: false,
        hasMoreResults: true,
        currentPage: 0,
        // Tiktok-specific state initialization
      },
    };
  }
  getSteps(): TiktokScraperStep[] {
    return [
      this.stepFactory.createInitializationStep(),
      this.stepFactory.createGetApiConfigStep(),
    ];
  }

  protected mergeWithDefaultOptions(
    options?: Partial<TiktokScraperOptions>,
  ): TiktokScraperOptions {
    const defaultOptions: TiktokScraperOptions = {
      retryAttempts: 3,
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './data/tiktok',
      },
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
    private readonly stepFactory: TiktokStepFactory,
  ) {
    super(logger);
  }

  // createScraper(
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   options?: Partial<ScraperOptions<TiktokLibraryQuery>>,
  // ): GenericScraperPipeline<
  //   IGenericScraperStep<IBaseScraperContext>,
  //   IBaseScraperContext,
  //   IPipelineResult
  // > {
  //   const pipeline = new GenericScraperPipeline(this.logger);

  //   // Add core steps
  //   // pipeline.addStep(this.stepFactory.createInitializationStep());
  //   // pipeline.addStep(this.stepFactory.createGetApiConfigStep());
  //   // pipeline.addStep(this.stepFactory.createNavigationStep());
  //   // pipeline.addStep(this.stepFactory.createInterceptionSetupStep());

  //   // // Add pagination and storage steps
  //   // pipeline.addStep(this.stepFactory.createPaginationStep());
  //   // pipeline.addStep(this.stepFactory.createStorageStep());

  //   return pipeline;
  // }

  // createContext(
  //   query: TiktokLibraryQuery,
  //   options: Partial<BaseScraperOptions>,
  // ): BaseScraperContextInterface<TiktokLibraryQuery, BaseScraperOptions> {
  //   return {
  //     query,
  //     options: {
  //       ...options,
  //     },
  //     state: {
  //       adsCollected: [],
  //       errors: [],
  //       forceStop: false,
  //       hasMoreResults: true,
  //       currentPage: 0,
  //     },
  //   };
  // }
  // private mergeWithDefaultOptions(
  //   options?: Partial<TiktokScraperOptionsDto>,
  // ): TiktokScraperOptionsDto {
  //   const defaultOptions: TiktokScraperOptionsDto = {
  //     behavior: {
  //       applyFilters: false,
  //       maxPages: 10,
  //       waitForResults: true,
  //       waitTimeout: 30000,
  //     },
  //     storage: {
  //       enabled: true,
  //       format: 'json',
  //       outputPath: './data/tiktok',
  //     },
  //   };

  //   return {
  //     ...defaultOptions,
  //     ...options,
  //   };
  // }
}
