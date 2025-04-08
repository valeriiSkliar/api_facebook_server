import { Injectable, Logger } from '@nestjs/common';
import { ScraperPipeline } from '../../common/pipeline';
import { TikTokScraperContext } from '../types/tiktok-scraper-context';
import { TikTokQuery } from '../types/tiktok-query';
import { TiktokStepFactory } from './tiktok-step.factory';
import { TiktokScraperOptionsDto } from '../dto/tiktok-scraper-options.dto';
@Injectable()
export class TikTokScraperFactory {
  constructor(
    private readonly logger: Logger,
    private readonly stepFactory: TiktokStepFactory,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createScraper(options?: Partial<TiktokScraperOptionsDto>): ScraperPipeline {
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
    query: TikTokQuery,
    options: Partial<TiktokScraperOptionsDto>,
  ): TikTokScraperContext {
    return {
      query,
      options,
      state: {
        adsCollected: [],
        hasMoreResults: true,
        currentPage: 0,
        errors: [],
        forceStop: false,
      },
    };
  }

  private mergeWithDefaultOptions(
    options?: Partial<TiktokScraperOptionsDto>,
  ): TiktokScraperOptionsDto {
    const defaultOptions: TiktokScraperOptionsDto = {
      behavior: {
        applyFilters: false,
        maxPages: 10,
        waitForResults: true,
        waitTimeout: 30000,
      },
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './data/tiktok',
      },
    };

    return {
      ...defaultOptions,
      ...options,
    };
  }
}
