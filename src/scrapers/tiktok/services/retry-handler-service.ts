/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ActionRecommendation } from '@src/core/api/models/action-recommendation';
import { AxiosError } from 'axios';
import { ApiErrorType } from '@src/core/api/models/api-error-type';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { TikTokApiConfigAdapter } from './api-config.scraper/tiktok-api-config-adapter';

// Queue class to manage request distribution and rate limiting
class RequestQueue {
  private queue: Array<{
    id: string;
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private isProcessing = false;
  private logger: Logger;
  private errorStorage: ErrorStorage | undefined;
  private lastRequestTime = 0;

  // Base delay between requests in ms
  private baseDelay = 1000;

  // Dynamic delay calculated based on error patterns
  private dynamicDelay = 1000;

  // Maximum concurrent requests (start conservatively)
  private maxConcurrent = 1;

  // Counts for tracking rate limiting
  private recentErrors = 0;
  private recentRateLimits = 0;
  private totalProcessed = 0;

  constructor(logger: Logger, errorStorage?: ErrorStorage) {
    this.logger = logger;
    this.errorStorage = errorStorage;

    // Start the queue processor
    this.processQueue();

    // Monitor queue health periodically and adjust parameters
    setInterval(() => this.adjustParameters(), 60000);
  }

  // Add a request to the queue
  async enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        task,
        resolve,
        reject,
      });

      this.logger.debug(
        `Added request for ${id} to queue. Queue size: ${this.queue.length}`,
      );

      // Ensure queue processing is active
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  // Process items in the queue with rate limiting
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Process up to maxConcurrent items at once
        const batch = this.queue.splice(0, this.maxConcurrent);
        const batchPromises = batch.map((item) => this.processItem(item));

        await Promise.all(batchPromises);

        // Wait between batches to prevent rate limiting
        if (this.queue.length > 0) {
          await this.applyDynamicDelay();
        }
      }
    } catch (error) {
      this.logger.error('Error in queue processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single queue item with error tracking
  private async processItem(item: any) {
    try {
      // Apply time spacing between individual requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.baseDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.baseDelay - timeSinceLastRequest),
        );
      }

      this.lastRequestTime = Date.now();
      this.logger.debug(`Processing queued request for ${item.id}`);

      const result = await item.task();
      this.totalProcessed++;
      item.resolve(result);

      // Success decreases error count
      this.recentErrors = Math.max(0, this.recentErrors - 0.5);
    } catch (error) {
      this.recentErrors++;

      // Track rate limit errors specifically
      if (
        error instanceof AxiosError &&
        (error.response?.status === 429 ||
          error.message.includes('too many requests'))
      ) {
        this.recentRateLimits++;

        // Increase dynamic delay on rate limit
        this.dynamicDelay = Math.min(30000, this.dynamicDelay * 1.5);
        this.logger.warn(
          `Rate limit detected. Increasing dynamic delay to ${this.dynamicDelay}ms`,
        );
      }

      item.reject(error);
    }
  }

  // Apply an adaptive delay based on error patterns
  private async applyDynamicDelay() {
    // Calculate dynamic delay based on error rate
    const currentDelay = Math.max(
      this.baseDelay,
      this.dynamicDelay * Math.min(3, 1 + this.recentErrors / 10),
    );

    // Add jitter to prevent synchronized retries
    const jitter = Math.random() * 500;
    const delayToApply = Math.round(currentDelay + jitter);

    this.logger.debug(
      `Applying dynamic delay of ${delayToApply}ms between batches. Error count: ${this.recentErrors}`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayToApply));
  }

  // Adjust queue parameters based on recent performance
  private adjustParameters() {
    // If we've had multiple rate limits, increase base delay and reduce concurrency
    if (this.recentRateLimits > 1) {
      this.baseDelay = Math.min(30000, this.baseDelay * 1.5);
      this.maxConcurrent = Math.max(1, this.maxConcurrent - 1);
      this.logger.warn(
        `Adjusting queue parameters due to rate limits. New baseDelay: ${this.baseDelay}ms, maxConcurrent: ${this.maxConcurrent}`,
      );

      // Reset counter after adjustment
      this.recentRateLimits = 0;
    }
    // If very few errors and we've processed enough requests, we can try optimizing
    else if (this.recentErrors < 2 && this.totalProcessed > 20) {
      // Cautiously increase concurrency if it's low
      if (this.maxConcurrent < 2) {
        this.maxConcurrent++;
        this.logger.log(
          `Cautiously increasing concurrency to ${this.maxConcurrent} due to good performance`,
        );
      }
      // Or decrease base delay if concurrency is already good
      else if (this.baseDelay > 2000) {
        this.baseDelay = Math.max(1000, this.baseDelay * 0.8);
        this.logger.log(
          `Decreasing base delay to ${this.baseDelay}ms due to good performance`,
        );
      }

      this.totalProcessed = 0; // Reset counter after adjustment
    }
  }

  // Get current queue stats
  getStats() {
    return {
      queueLength: this.queue.length,
      baseDelay: this.baseDelay,
      dynamicDelay: this.dynamicDelay,
      maxConcurrent: this.maxConcurrent,
      recentErrors: this.recentErrors,
      recentRateLimits: this.recentRateLimits,
    };
  }
}

// Global request queue for the application
let globalRequestQueue: RequestQueue | null = null;

export class RetryHandler {
  private readonly maxRetries = 4; // Increased from 3 to 4
  private readonly logger: Logger;
  private readonly apiAnalyzer: ApiResponseAnalyzer;
  private readonly context: TiktokScraperContext | undefined;
  private requestQueue: RequestQueue;
  private readonly apiConfigAdapter: TikTokApiConfigAdapter | undefined;

  private static queueInitialized = false;

  constructor(
    logger: Logger,
    apiAnalyzer: ApiResponseAnalyzer,
    context?: TiktokScraperContext,
    apiConfigAdapter?: TikTokApiConfigAdapter,
  ) {
    this.logger = logger;
    this.apiAnalyzer = apiAnalyzer;
    this.context = context;
    this.apiConfigAdapter = apiConfigAdapter;

    // Initialize or reuse the global request queue
    if (!globalRequestQueue) {
      logger.log('Initializing global request queue for rate limiting');
      globalRequestQueue = new RequestQueue(logger);
      RetryHandler.queueInitialized = true;
    }
    this.requestQueue = globalRequestQueue;
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

    // Only log queue stats occasionally to avoid spam
    if (Math.random() < 0.1) {
      this.logger.debug(
        `Request queue stats: ${JSON.stringify(this.requestQueue.getStats())}`,
      );
    }

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

            // Apply more aggressive exponential backoff
            let delay =
              recommendation.delayMs || Math.pow(2, attempt + 1) * 1000; // +1 increased base backoff

            // For rate limiting errors, use much longer delays
            if (
              analysis.errorType === ApiErrorType.RATE_LIMIT ||
              (lastError.message &&
                lastError.message.toLowerCase().includes('too many requests'))
            ) {
              // More aggressive backoff for rate limits: 5s, 10s, 20s, 40s
              delay = Math.max(delay, 5000 * Math.pow(2, attempt - 1));
              this.logger.warn(
                `Rate limit detected for ${materialId}. Using aggressive backoff: ${delay}ms`,
              );
            }
            // Try to get a fallback configuration if available
            if (this.apiConfigAdapter && this.context?.state.apiConfig) {
              try {
                const fallbackConfig =
                  await this.apiConfigAdapter.getFallbackConfig(
                    this.context.state.apiConfig.url,
                  );

                if (
                  fallbackConfig &&
                  fallbackConfig.id !== this.context.state.apiConfig.id
                ) {
                  this.logger.log(
                    `Switching to fallback configuration (ID: ${fallbackConfig.id}) for material ${materialId}`,
                  );
                  this.context.state.apiConfig = fallbackConfig;
                }
              } catch (configError) {
                this.logger.warn(
                  `Failed to get fallback configuration: ${configError instanceof Error ? configError.message : String(configError)}`,
                );
              }
            }

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
            // Default exponential backoff if not an Axios error, more aggressive
            const delay = Math.pow(2, attempt + 1) * 1000; // +1 increased base backoff
            this.logger.debug(
              `Retry attempt ${attempt}/${this.maxRetries} for material ${materialId}. Waiting ${delay}ms before retry...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        // Queue the operation instead of executing directly
        return await this.requestQueue.enqueue(materialId, operation);
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

          // Report error to ApiConfigManager if available
          if (this.apiConfigAdapter && this.context?.state.apiConfig) {
            await this.apiConfigAdapter.reportError(
              this.context.state.apiConfig,
              error,
              endpoint,
            );
          }

          // Ensure error is tracked in context when this handler is used
          if (
            this.context &&
            this.context.state &&
            Array.isArray(this.context.state.apiErrors)
          ) {
            // Only add if materialId and endpoint exist to ensure valid entries
            if (materialId && endpoint) {
              this.context.state.apiErrors.push({
                materialId,
                error,
                endpoint,
                timestamp: new Date(),
              });

              // Log that we've added an error to the context
              this.logger.debug(
                `Added error to context.state.apiErrors: ${error.message} for ${materialId}`,
              );
            }
          }
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
