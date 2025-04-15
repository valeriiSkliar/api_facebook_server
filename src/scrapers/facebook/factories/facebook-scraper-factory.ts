// src/scrapers/facebook/factories/facebook-scraper.factory.ts

import { Injectable, Logger } from '@nestjs/common';
import { GenericScraperPipeline } from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import { GenericScraperFactory } from '@src/scrapers/common/factories/generic-scraper-factory';
import {
  FacebookScraperContext,
  FacebookScraperOptions,
  FacebookScraperResult,
  FacebookScraperState,
} from '../facebook-scraper-types';
import { AdLibraryQuery } from '../models/facebook-ad-lib-query';
import { AdData } from '../models/facebook-ad-data';
import { FacebookScraperStep } from '../steps/facebook-scraper-step';
import { FacebookStepFactory } from './facebook-step-factory';

@Injectable()
export class FacebookScraperFactory extends GenericScraperFactory<
  AdLibraryQuery,
  FacebookScraperOptions,
  FacebookScraperState,
  FacebookScraperContext,
  FacebookScraperStep,
  FacebookScraperResult,
  AdData
> {
  constructor(
    protected readonly logger: Logger,
    private readonly stepFactory: FacebookStepFactory,
  ) {
    super(logger);
  }

  /**
   * Create a Facebook scraper pipeline
   * @param options Optional options for the scraper
   */
  createScraper(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options?: Partial<FacebookScraperOptions>,
  ): GenericScraperPipeline<
    FacebookScraperStep,
    FacebookScraperContext,
    FacebookScraperResult,
    AdData
  > {
    const pipeline = new GenericScraperPipeline<
      FacebookScraperStep,
      FacebookScraperContext,
      FacebookScraperResult,
      AdData
    >(this.logger);

    // Add steps to the pipeline
    const steps = this.getSteps();
    for (const step of steps) {
      pipeline.addStep(step);
    }

    return pipeline;
  }

  /**
   * Create a Facebook scraper context
   * @param query The query for the scraper
   * @param options Optional options for the scraper
   */
  createContext(
    query: AdLibraryQuery,
    options?: Partial<FacebookScraperOptions>,
  ): FacebookScraperContext {
    return {
      query,
      options: this.mergeWithDefaultOptions(options),
      state: {
        adsCollected: [],
        hasMoreResults: true,
        currentPage: 0,
        errors: [],
        forceStop: false,
        externalBrowser: options?.useExternalBrowser || false,
        browserId: undefined,
        startTime: new Date(),
      },
    };
  }

  /**
   * Get the steps for the Facebook scraper
   */
  getSteps(): FacebookScraperStep[] {
    return [
      // this.stepFactory.createInitializationStep(),
      // this.stepFactory.createNavigationStep(),
      // this.stepFactory.createInterceptionSetupStep(),
      // this.stepFactory.createPaginationStep(),
      // this.stepFactory.createStorageStep(),
    ];
  }

  /**
   * Merge provided options with default options
   * @param options Optional options to merge with defaults
   */
  protected mergeWithDefaultOptions(
    options?: Partial<FacebookScraperOptions>,
  ): FacebookScraperOptions {
    const defaultOptions: FacebookScraperOptions = {
      retryAttempts: 3,
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './data/facebook',
      },
      includeAdsInResponse: false,
      behavior: {
        applyFilters: false,
        maxPages: 10,
        maxAdsToCollect: 200,
        waitForResults: true,
        waitTimeout: 30000,
        cleanUpTimeout: 5000,
        scrollDelay: 2000,
      },
      browser: {
        headless: true,
        viewport: {
          width: 1280,
          height: 800,
        },
      },
    };

    return {
      ...defaultOptions,
      ...options,
      behavior: {
        ...defaultOptions.behavior,
        ...options?.behavior,
      },
      browser: {
        ...defaultOptions.browser,
        ...options?.browser,
      },
      storage: {
        ...defaultOptions.storage,
        ...options?.storage,
      },
    };
  }
}
