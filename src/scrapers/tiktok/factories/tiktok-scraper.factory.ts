import { Injectable, Logger } from '@nestjs/common';
import { ScraperPipeline } from '../../common/pipeline';
import { TiktokStepFactory } from './tiktok-step.factory';
import {
  BaseScraperOptions,
  ScraperOptions,
} from '@src/scrapers/common/interfaces/scraper-options.interface';
import { TiktokLibraryQuery } from '../models/tiktok-library-query';
import { IScraperContext } from '@src/scrapers/common/interfaces/scraper-context.interface';
import { TikTokScraperOptions } from '../types/tiktok-scraper-options';
@Injectable()
export class TikTokScraperFactory {
  constructor(
    private readonly logger: Logger,
    private readonly stepFactory: TiktokStepFactory,
  ) {}

  createScraper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: Partial<ScraperOptions<TiktokLibraryQuery>>,
  ): ScraperPipeline {
    const pipeline = new ScraperPipeline(this.logger);

    // Add core steps
    pipeline.addStep(this.stepFactory.createInitializationStep());
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
  ): IScraperContext<TiktokLibraryQuery, TikTokScraperOptions, unknown> {
    return {
      query,
      options: {
        ...options,
        query,
      },
      state: {},
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
