import { Logger } from '@nestjs/common';
import { ScraperPipeline } from '@src/models/ScraperPipeline';
import { ScraperContext } from '@src/models/ScraperContext';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';
import { FilterRegistry } from '../filters/FilterRegistry';
import { StepFactory } from './StepFactory';
import { ScraperOptions } from '@src/models/ScraperOptions';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ScraperFactory {
  constructor(
    private readonly logger: Logger,
    private readonly stepFactory: StepFactory,
  ) {}

  createScraper(options?: Partial<ScraperOptions>): ScraperPipeline {
    const pipeline = new ScraperPipeline(this.logger);

    // Add core steps
    pipeline.addStep(this.stepFactory.createInitializationStep());
    pipeline.addStep(this.stepFactory.createNavigationStep());
    pipeline.addStep(this.stepFactory.createInterceptionSetupStep());

    // Add filter steps if options include filters
    if (options?.behavior?.applyFilters) {
      const filterRegistry = FilterRegistry.getInstance();
      for (const filterType of filterRegistry.getAvailableFilters()) {
        const filter = filterRegistry.getFilter(filterType, this.logger);
        if (filter) {
          pipeline.addStep(filter);
        }
      }
    }

    // Add pagination and storage steps
    pipeline.addStep(this.stepFactory.createPaginationStep());
    pipeline.addStep(this.stepFactory.createStorageStep());

    return pipeline;
  }

  createContext(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
  ): ScraperContext {
    return {
      query,
      options: this.mergeWithDefaultOptions(options),
      state: {
        adsCollected: [],
        hasMoreResults: true,
        currentPage: 0,
        errors: [],
      },
    };
  }

  private mergeWithDefaultOptions(
    options?: Partial<ScraperOptions>,
  ): ScraperOptions {
    const defaultOptions: ScraperOptions = {
      behavior: {
        applyFilters: false,
        maxPages: 10,
        waitForResults: true,
        waitTimeout: 30000,
      },
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './ads',
      },
    };

    return {
      ...defaultOptions,
      ...options,
    };
  }
}
