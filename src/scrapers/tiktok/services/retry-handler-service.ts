import { Logger } from '@nestjs/common';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ActionRecommendation } from '@src/core/api/models/action-recommendation';
import { AxiosError } from 'axios';

export class RetryHandler {
  private readonly maxRetries = 3;
  private readonly logger: Logger;
  private readonly apiAnalyzer: ApiResponseAnalyzer;
  private readonly context: any;

  constructor(logger: Logger, apiAnalyzer: ApiResponseAnalyzer, context?: any) {
    this.logger = logger;
    this.apiAnalyzer = apiAnalyzer;
    this.context = context;
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
          
          // Ensure error is tracked in context when this handler is used
          if (this.context && this.context.state && Array.isArray(this.context.state.apiErrors)) {
            // Only add if materialId and endpoint exist to ensure valid entries
            if (materialId && endpoint) {
              this.context.state.apiErrors.push({
                materialId,
                error,
                endpoint,
                timestamp: new Date(),
              });
              
              // Log that we've added an error to the context
              this.logger.debug(`Added error to context.state.apiErrors: ${error.message} for ${materialId}`);
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
