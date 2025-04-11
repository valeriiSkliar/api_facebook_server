/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DetailApiResponse,
  DetailMaterial,
} from '../models/detail-api-response';
import { FailedMaterial } from '../tiktok-scraper-types';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';
import { AxiosError } from 'axios';
import { ActionRecommendation } from '@src/core/api/models/action-recommendation';

class RetryHandler {
  private readonly maxRetries = 3;
  private readonly logger: Logger;
  private readonly apiAnalyzer: ApiResponseAnalyzer;

  constructor(logger: Logger, apiAnalyzer: ApiResponseAnalyzer) {
    this.logger = logger;
    this.apiAnalyzer = apiAnalyzer;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    materialId: string,
    endpoint: string,
    errorHandler?: (
      error: Error,
      attempt: number,
      recommendation: ActionRecommendation,
    ) => void,
  ): Promise<T | null> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      try {
        const requestTimestamp = new Date();

        if (attempt > 0) {
          // Use analyzer to calculate the optimal delay based on error pattern
          if (lastError instanceof AxiosError) {
            // Analyze the error
            const analysis = this.apiAnalyzer.analyzeResponse(
              materialId,
              lastError,
              endpoint,
              requestTimestamp,
            );

            // Get recommendation for next steps
            const recommendation =
              this.apiAnalyzer.generateActionRecommendation(
                analysis,
                attempt,
                this.maxRetries,
              );

            // Apply delay as recommended
            const delay =
              recommendation.delayMs || Math.pow(2, attempt - 1) * 1000;
            this.logger.debug(
              `Retry attempt ${attempt}/${this.maxRetries} for material ${materialId}. Waiting ${delay}ms before retry based on error analysis.`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));

            // If recommendation suggests we abort, stop trying
            if (recommendation.action === 'abort') {
              this.logger.warn(
                `Aborting retries for ${materialId}: ${recommendation.message}`,
              );
              throw new Error(`Aborted: ${recommendation.message}`);
            }
          } else {
            // Default exponential backoff if not an Axios error
            const delay = Math.pow(2, attempt - 1) * 1000;
            this.logger.debug(
              `Retry attempt ${attempt}/${this.maxRetries} for material ${materialId}. Waiting ${delay}ms before retry...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Analyze error and get recommendation
        let recommendation: ActionRecommendation = {
          action: 'retry',
          message: 'Default retry recommendation',
        };

        if (error instanceof AxiosError) {
          const analysis = this.apiAnalyzer.analyzeResponse(
            materialId,
            error,
            endpoint,
            new Date(),
          );
          recommendation = this.apiAnalyzer.generateActionRecommendation(
            analysis,
            attempt,
            this.maxRetries,
          );
        }

        if (errorHandler) {
          errorHandler(lastError, attempt, recommendation);
        }

        if (attempt > this.maxRetries || recommendation.action === 'abort') {
          this.logger.error(
            `Failed to process material ${materialId} after ${attempt} attempts. Last error: ${lastError.message}`,
          );
          return null;
        }

        this.logger.warn(
          `Error processing material ${materialId} (attempt ${attempt}/${this.maxRetries}): ${lastError.message}`,
        );
      }
    }

    return null;
  }
}

@Injectable()
export class ProcessMaterialsStep extends TiktokScraperStep {
  private retryHandler: RetryHandler;
  private readonly errorStorage: ErrorStorage;
  private readonly apiAnalyzer: ApiResponseAnalyzer;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    super(name, logger);
    this.errorStorage = ErrorStorage.getInstance();
    this.apiAnalyzer = new ApiResponseAnalyzer(this.errorStorage);
    this.retryHandler = new RetryHandler(logger, this.apiAnalyzer);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (
      !context.state.materialsIds ||
      context.state.materialsIds.length === 0
    ) {
      this.logger.log('No material IDs to process');
      return true;
    }

    try {
      // Use the API config from previous step
      if (!context.state.apiConfig) {
        throw new Error('API configuration is missing');
      }

      const { headers } = context.state.apiConfig;
      const baseDetailUrl =
        'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/detail';

      this.logger.log(
        `Processing ${context.state.materialsIds.length} materials in parallel`,
      );

      // Check for rate limiting before processing
      const isRateLimited = this.errorStorage.isRateLimitingLikely();

      // Set batch size to control concurrency - reduce if rate limiting is detected
      let batchSize = 5; // Default: Process 5 materials at a time
      if (isRateLimited) {
        batchSize = 2; // Reduce batch size if rate limiting is detected
        this.logger.warn(
          `Reducing batch size to ${batchSize} due to detected rate limiting`,
        );
      }

      const materialIds = [...context.state.materialsIds];
      const results: DetailMaterial[] = [];

      // Initialize failed materials tracking if it doesn't exist
      if (!context.state.failedMaterials) {
        context.state.failedMaterials = [];
      }

      // Initialize current page for dynamic delay calculation
      let currentPage = 0;

      // Process materials in batches
      while (materialIds.length > 0) {
        const batch = materialIds.splice(0, batchSize);
        currentPage++;

        // Calculate dynamic delay with rate limit awareness
        let dynamicDelay = Math.min(500 + (currentPage - 1) * 100, 2000);
        if (isRateLimited) {
          // Increase delay when rate limiting is detected
          dynamicDelay = Math.min(1000 + (currentPage - 1) * 300, 5000);
        }
        this.logger.debug(
          `Using dynamic delay of ${dynamicDelay}ms for page ${currentPage}${isRateLimited ? ' (rate limit mode)' : ''}`,
        );

        // Process batch in parallel
        const batchPromises = batch.map((materialId) =>
          this.processMaterial(
            materialId,
            baseDetailUrl,
            headers,
            currentPage,
            context,
          ),
        );
        const batchResults = await Promise.all(batchPromises);

        // Filter out failures and add successful results
        const validResults = batchResults.filter(
          (result) => result !== null,
        ) as DetailMaterial[];
        const failedCount = batch.length - validResults.length;

        if (failedCount > 0) {
          this.logger.warn(
            `Failed to process ${failedCount} materials in batch ${currentPage} after retries`,
          );
        }

        results.push(...validResults);

        // Add a dynamic delay between batches to prevent rate limiting
        if (materialIds.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
        }
      }

      // Add processed materials to collected ads
      context.state.adsCollected.push(...results);

      const totalAttempted = context.state.materialsIds.length;
      const successCount = results.length;
      const successRate = (successCount / totalAttempted) * 100;

      this.logger.log(`Materials processing statistics:`, {
        totalAttempted,
        successfullyProcessed: successCount,
        failedAfterRetries: totalAttempted - successCount,
        successRate: `${successRate.toFixed(2)}%`,
        failedMaterialsCount: context.state.failedMaterials.length,
      });

      // Log common failure reasons if there are any failures
      if (context.state.failedMaterials.length > 0) {
        const failureReasons = this.analyzeFailureReasons(
          context.state.failedMaterials,
        );
        this.logger.warn('Common failure reasons:', failureReasons);

        // Report error frequency from the analyzer
        const errorFrequency = this.apiAnalyzer.getErrorFrequencyAnalysis();
        this.logger.warn('API error frequency:', errorFrequency);

        // Check and report error trends
        const trends = this.apiAnalyzer.getErrorRateTrend(10);
        this.logger.warn('Error rate trends:', trends);
      }

      this.logger.log(
        `Successfully processed ${successCount} materials out of ${totalAttempted} (${successRate.toFixed(2)}%)`,
      );
      context.state.materialsIds = [];

      // Check if max ads limit is reached
      const maxAds = context.options.behavior?.maxAdsToCollect || 200;
      if (context.state.adsCollected.length >= maxAds) {
        this.logger.log(`Reached maximum of ${maxAds} ads to collect`);
        context.state.hasMoreResults = false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Analyze failure reasons to find patterns
   */
  private analyzeFailureReasons(
    failedMaterials: FailedMaterial[],
  ): Record<string, number> {
    const reasonCounts: Record<string, number> = {};

    for (const failed of failedMaterials) {
      // Extract the main error message without specific details
      const baseError = this.categorizeError(failed.lastError);

      if (!reasonCounts[baseError]) {
        reasonCounts[baseError] = 0;
      }
      reasonCounts[baseError]++;
    }

    return reasonCounts;
  }

  /**
   * Categorize errors to find patterns
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('timeout')) {
      return 'Request timeout';
    } else if (errorMessage.includes('429')) {
      return 'Rate limiting (429)';
    } else if (errorMessage.includes('403')) {
      return 'Access denied (403)';
    } else if (errorMessage.includes('404')) {
      return 'Resource not found (404)';
    } else if (errorMessage.includes('500')) {
      return 'Server error (500)';
    } else if (errorMessage.includes('network')) {
      return 'Network error';
    } else {
      return 'Other error';
    }
  }

  /**
   * Process a single material by making an API request with improved error handling
   */
  private async processMaterial(
    materialId: string,
    baseUrl: string,
    headers: Record<string, string>,
    pageNumber: number = 1,
    context?: TiktokScraperContext,
  ): Promise<DetailMaterial | null> {
    this.logger.debug(
      `Processing material: ${materialId} on page ${pageNumber}`,
    );

    let lastError: string = '';
    let attempts = 0;

    // Create URL with material_id parameter
    const url = new URL(baseUrl);
    url.searchParams.set('material_id', materialId);

    const result = await this.retryHandler.executeWithRetry(
      async () => {
        // Apply dynamic delay based on page number to prevent rate limiting
        const requestDelay = Math.min(500 + (pageNumber - 1) * 100, 2000);
        await new Promise((resolve) => setTimeout(resolve, requestDelay));

        // Track request time for performance monitoring
        const requestTimestamp = new Date();

        // Make the request for material details
        const response = await firstValueFrom(
          this.httpService.get<DetailApiResponse>(url.toString(), { headers }),
        );

        // Analyze response for issues even if status code is 200
        const analysis = this.apiAnalyzer.analyzeResponse(
          materialId,
          null,
          url.toString(),
          requestTimestamp,
          response,
        );

        // Log response time for monitoring
        this.logger.debug(
          `Material ${materialId} API response time: ${analysis.responseTime}ms`,
        );

        // Check if the request was successful and data exists
        if (response.status === 200 && response.data?.data) {
          return this.mapResponseToAdData(materialId, response.data.data);
        } else {
          throw new Error(
            `Invalid response for material ${materialId}: ${response.status}`,
          );
        }
      },
      materialId,
      url.toString(),
      (error, attempt, recommendation) => {
        attempts = attempt;
        lastError = String(error.message);
        this.logger.warn(
          `Attempt ${attempt}: Failed to process material ${materialId} - ${error.message}. Recommendation: ${recommendation.message}`,
          { materialId, attempt, error: error.message, stack: error.stack },
        );
      },
    );

    // Track failed materials if context is provided
    if (!result && context && context.state.failedMaterials) {
      context.state.failedMaterials.push({
        materialId,
        attempts,
        lastError,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Map the TikTok API response to our AdData format
   */
  private mapResponseToAdData(
    materialId: string,
    data: DetailMaterial,
  ): DetailMaterial {
    return {
      id: materialId,
      ad_title: data.ad_title || '',
      brand_name: data.brand_name || '',
      comment: data.comment || 0,
      cost: data.cost || 0,
      country_code: data.country_code || [],
      ctr: data.ctr || 0,
      favorite: data.favorite || false,
      has_summary: data.has_summary || false,
      highlight_text: data.highlight_text || '',
      industry_key: data.industry_key || '',
      is_search: data.is_search || false,
      keyword_list: data.keyword_list || [],
      landing_page: data.landing_page || '',
      like: data.like || 0,
      objective_key: data.objective_key || '',
      objectives: data.objectives || [],
      pattern_label: data.pattern_label || [],
      share: data.share || 0,
      source: data.source || '',
      source_key: data.source_key || 0,
      tag: data.tag || 0,
      video_info: {
        vid: data.video_info?.vid || '',
        duration: data.video_info?.duration || 0,
        cover: data.video_info?.cover || '',
        video_url: data.video_info?.video_url || {},
        width: data.video_info?.width || 0,
        height: data.video_info?.height || 0,
      },
      voice_over: data.voice_over || false,
    };
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    return Promise.resolve(
      !!context.state.materialsIds && context.state.materialsIds.length > 0,
    );
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}
