import { Injectable, Logger } from '@nestjs/common';
// import { ScraperPipeline } from '../../common/pipeline';
import { TiktokStepFactory } from './tiktok-step.factory';
import {
  BaseScraperOptions,
  ScraperOptions,
} from '@src/scrapers/common/interfaces/scraper-options.interface';
import { TiktokLibraryQuery } from '../models/tiktok-library-query';
import { BaseScraperContext } from '@src/scrapers/common/interfaces/base-scraper-context';
import {
  GenericScraperPipeline,
  IBaseScraperContext,
  IGenericScraperStep,
} from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import { IPipelineResult } from '@src/core/interfaces';
@Injectable()
export class TikTokScraperFactory {
  constructor(
    private readonly logger: Logger,
    private readonly stepFactory: TiktokStepFactory,
  ) {}

  createScraper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: Partial<ScraperOptions<TiktokLibraryQuery>>,
  ): GenericScraperPipeline<
    IGenericScraperStep<IBaseScraperContext>,
    IBaseScraperContext,
    IPipelineResult
  > {
    const pipeline = new GenericScraperPipeline(this.logger);

    // Add core steps
    pipeline.addStep(this.stepFactory.createInitializationStep());
    pipeline.addStep(this.stepFactory.createGetApiConfigStep());
    // pipeline.addStep(this.stepFactory.createNavigationStep());
    // pipeline.addStep(this.stepFactory.createInterceptionSetupStep());

    // // Add pagination and storage steps
    // pipeline.addStep(this.stepFactory.createPaginationStep());
    // pipeline.addStep(this.stepFactory.createStorageStep());

    return pipeline;
  }

  createContext(
    query: TiktokLibraryQuery,
    options: Partial<BaseScraperOptions>,
  ): BaseScraperContext<TiktokLibraryQuery, BaseScraperOptions> {
    return {
      query,
      options: {
        ...options,
      },
      state: {
        adsCollected: [],
        errors: [],
        forceStop: false,
        hasMoreResults: true,
        currentPage: 0,
      },
    };
  }
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
