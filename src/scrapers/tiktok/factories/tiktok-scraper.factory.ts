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
        taskId: '',
        processedMaterialIds: [],
        failedMaterialIds: [],
        apiErrors: [],
        failedMaterials: [],
        startTime: new Date(),
        adsCollected: [],
        errors: [],
        forceStop: false,
        hasMoreResults: true,
        currentPage: 0,
        apiConfig: null,
        permissionError: false,
      },
    };
  }
  getSteps(): TiktokScraperStep[] {
    return [
      this.stepFactory.createInitializationStep(),
      this.stepFactory.createGetApiConfigStep(),
      this.stepFactory.createApiRequestStep(),
      this.stepFactory.createPaginationStep(),
      this.stepFactory.createGetMatirialsIdStep(),
      this.stepFactory.createFilterMaterialsStep(),
      this.stepFactory.createProcessMaterialsStep(),
      this.stepFactory.createErrorAnalysisStep(),
      this.stepFactory.createErrorDiagnosticStep(),
      this.stepFactory.createSaveCreativesStep(),
    ];
  }
  /**
   * Merges the provided options with the default options.
   * @param options The options to merge with the default options.
   * @returns The merged options.
   */
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
}
