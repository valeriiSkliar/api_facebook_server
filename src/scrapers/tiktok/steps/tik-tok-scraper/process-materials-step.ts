import { Inject, Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DetailApiResponse,
  DetailMaterial,
} from '../../models/detail-api-response';
import { FailedMaterial } from '../../tiktok-scraper-types';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';
import { RetryHandler } from '../../services/retry-handler-service';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';
import { IScraperStateStorage } from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { AxiosError } from 'axios';

@Injectable()
export class ProcessMaterialsStep extends TiktokScraperStep {
  private retryHandler: RetryHandler;
  private readonly errorStorage: ErrorStorage;
  private readonly apiAnalyzer: ApiResponseAnalyzer;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
    @Inject(SCRAPER_STATE_STORAGE)
    private readonly stateStorage: IScraperStateStorage,
  ) {
    super(name, logger);
    this.errorStorage = ErrorStorage.getInstance();
    this.apiAnalyzer = new ApiResponseAnalyzer(this.errorStorage);
    // RetryHandler will be initialized in execute() with context
  }

  private checkRateLimiting(): boolean {
    return this.errorStorage.isRateLimitingLikely();
  }

  private getErrorFrequency(): Record<string, number> {
    return this.apiAnalyzer.getErrorFrequencyAnalysis();
  }

  private getErrorTrends(minutes: number = 10): Record<string, any> {
    return this.apiAnalyzer.getErrorRateTrend(minutes);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    // Initialize the retry handler with context for each execution
    this.retryHandler = new RetryHandler(
      this.logger,
      this.apiAnalyzer,
      context,
    );

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

      // Initialize tracking arrays if they don't exist
      if (!context.state.processedMaterialIds) {
        context.state.processedMaterialIds = [];
      }

      if (!context.state.failedMaterialIds) {
        context.state.failedMaterialIds = [];
      }

      // Initialize API errors tracking array if it doesn't exist
      if (!context.state.apiErrors) {
        context.state.apiErrors = [];
      }

      // Filter out materials that have already been processed
      const materialsToProcess = context.state.materialsIds.filter(
        (id) =>
          !context.state.processedMaterialIds.includes(id) &&
          !context.state.failedMaterialIds.includes(id),
      );

      this.logger.log(
        `Processing ${materialsToProcess.length} out of ${context.state.materialsIds.length} materials (${context.state.processedMaterialIds.length} already processed, ${context.state.failedMaterialIds.length} previously failed)`,
      );

      // Check for rate limiting before processing
      const isRateLimited = this.checkRateLimiting();

      // Set batch size to control concurrency - significantly reduce to address rate limiting issues
      let batchSize = 2; // Reduced default batch size from 5 to 2

      // Check error frequency to determine if we should be even more conservative
      const errorFrequency = this.getErrorFrequency();
      const tooManyRequestsCount = errorFrequency['RATE_LIMIT'] || 0;

      if (isRateLimited || tooManyRequestsCount > 10) {
        batchSize = 1; // Process only 1 material at a time when rate limited
        this.logger.warn(
          `Using minimal batch size of ${batchSize} due to detected rate limiting (${tooManyRequestsCount} rate limit errors)`,
        );
      }

      const results: DetailMaterial[] = [];

      // Initialize failed materials tracking if it doesn't exist
      if (!context.state.failedMaterials) {
        context.state.failedMaterials = [];
      }

      // Initialize current page for dynamic delay calculation
      let currentPage = 0;

      // Process materials in batches
      while (materialsToProcess.length > 0) {
        const batch = materialsToProcess.splice(0, batchSize);
        currentPage++;

        // Calculate much more aggressive dynamic delay with rate limit awareness
        // Base delay starts higher and grows more quickly between pages
        let dynamicDelay = Math.min(2000 + (currentPage - 1) * 500, 10000);

        // Check error statistics to adjust delay dynamically based on recent performance
        const errorTrends = this.getErrorTrends(5); // Last 5 minutes of errors
        const recentErrors = (errorTrends.recentTotal as number) || 0;

        // If we're experiencing a high error rate, increase delay further
        if (isRateLimited || recentErrors > 5 || tooManyRequestsCount > 10) {
          // Much more aggressive backoff when rate limiting is detected
          dynamicDelay = Math.min(5000 + (currentPage - 1) * 1000, 30000);

          // Add additional delay proportional to the error rate
          const errorFactor = Math.min(3, 1 + recentErrors / 10);
          dynamicDelay = Math.min(
            30000,
            Math.round(dynamicDelay * errorFactor),
          );
        }

        // Add jitter to prevent synchronized retries
        const jitter = Math.floor(Math.random() * 1000);
        dynamicDelay += jitter;

        this.logger.debug(
          `Using dynamic delay of ${dynamicDelay}ms for page ${currentPage}${
            isRateLimited ? ' (rate limit mode)' : ''
          } with ${recentErrors} recent errors`,
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
        this.logger.log(`Batch ${currentPage} results:`, batchResults);
        // Filter out failures and add successful results
        const validResults = batchResults.filter((result) => result !== null);

        // Track successfully processed materials
        for (const result of validResults) {
          context.state.processedMaterialIds.push(result.id);
        }

        // Update the state storage with newly processed materials
        if (validResults.length > 0) {
          await this.updateStateStorage(context);
        }

        results.push(...validResults);

        // Add a dynamic delay between batches to prevent rate limiting
        if (materialsToProcess.length > 0) {
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
        const errorFrequency = this.getErrorFrequency();
        this.logger.warn('API error frequency:', errorFrequency);

        // Check and report error trends
        const trends = this.getErrorTrends(10);
        this.logger.warn('Error rate trends:', trends);
      }

      this.logger.log(
        `Successfully processed ${successCount} materials out of ${totalAttempted} (${successRate.toFixed(2)}%)`,
      );
      context.state.materialsIds = [];

      // Check if max ads limit is reached
      const maxAds = context.options.behavior?.maxAdsToCollect || 200;
      if (context.state.adsCollected.length >= maxAds) {
        this.logger.log(
          `[ProcessMaterialsStep] Reached maximum of ${maxAds} ads to collect`,
        );
        context.state.hasMoreResults = false;
      }

      // Final state update
      await this.updateStateStorage(context);

      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );

      // Update state storage with error status
      if (context.state.taskId) {
        await this.stateStorage.markAsFailed(
          context.state.taskId,
          error instanceof Error ? error.message : String(error),
        );
      }

      return false;
    }
  }

  /**
   * Update the state storage with current context state
   */
  private async updateStateStorage(
    context: TiktokScraperContext,
  ): Promise<void> {
    if (!context.state.taskId) {
      this.logger.warn('Cannot update state storage: No taskId in context');
      return;
    }

    try {
      await this.stateStorage.updateState(context.state.taskId, {
        currentPage: context.state.currentPage,
        hasMoreResults: context.state.hasMoreResults,
        processedMaterialIds: context.state.processedMaterialIds,
        failedMaterialIds: context.state.failedMaterialIds,
        lastUpdated: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error updating state storage:`, error);
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
    const errorLower = errorMessage.toLowerCase();

    if (errorLower.includes('timeout')) {
      return 'Request timeout';
    } else if (
      errorLower.includes('429') ||
      errorLower.includes('too many requests')
    ) {
      return 'Rate limiting (429)';
    } else if (errorLower.includes('403') || errorLower.includes('forbidden')) {
      return 'Access denied (403)';
    } else if (errorLower.includes('404') || errorLower.includes('not found')) {
      return 'Resource not found (404)';
    } else if (
      errorLower.includes('500') ||
      errorLower.includes('server error')
    ) {
      return 'Server error (500)';
    } else if (
      errorLower.includes('network') ||
      errorLower.includes('socket') ||
      errorLower.includes('connect')
    ) {
      return 'Network error';
    } else if (
      errorLower.includes('permission') ||
      errorLower.includes('no permission')
    ) {
      return 'Permission denied';
    } else if (errorLower.match(/empty|invalid|malformed|response/)) {
      return 'Invalid response';
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
        // Apply more aggressive dynamic delay based on page number to prevent rate limiting
        // Start with a higher base delay that increases more rapidly with page number
        const baseDelay = Math.min(1000 + (pageNumber - 1) * 500, 5000);

        // Apply jitter to prevent synchronized requests
        const jitter = Math.floor(Math.random() * 500);
        const requestDelay = baseDelay + jitter;

        this.logger.debug(
          `Applying pre-request delay of ${requestDelay}ms for material ${materialId} on page ${pageNumber}`,
        );
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

        // Explicitly track any API error in context.state.apiErrors, even for 200 responses with logical errors
        if (!analysis.isSuccess && context) {
          // Create Axios error with proper structure
          const axiosError = new AxiosError(
            analysis.errorMessage,
            'EREQUEST',
            undefined,
            undefined,
            response,
          );

          context.state.apiErrors.push({
            materialId,
            error: axiosError,
            endpoint: url.toString(),
            timestamp: new Date(),
          });
        }

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
    if (!result && context) {
      // Add to failed materials list for analysis
      if (context.state.failedMaterials) {
        context.state.failedMaterials.push({
          materialId,
          attempts,
          lastError,
          timestamp: new Date(),
        });
      }

      // Add to failed material IDs for state tracking
      if (
        context.state.failedMaterialIds &&
        !context.state.failedMaterialIds.includes(materialId)
      ) {
        context.state.failedMaterialIds.push(materialId);

        // Update the state storage
        if (context.state.taskId) {
          await this.updateStateStorage(context);
        }
      }
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
