import { AxiosError, AxiosResponse } from 'axios';
import { ApiResponseAnalysis } from '../models/api-response-analysis';
import { ActionRecommendation } from '../models/action-recommendation';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';
import { ApiErrorType } from '../models/api-error-type';
import { AbstractApiResponseAnalyzer } from './abstract-api-response-analyzer copy';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ApiResponseAnalyzer extends AbstractApiResponseAnalyzer {
  private readonly logger = new Logger(ApiResponseAnalyzer.name);

  constructor(private readonly errorStorage: ErrorStorage) {
    super();
  }

  /**
   * Analyzes API response (or Axios error) and classifies the error type.
   * @param materialId - Material ID (if applicable, e.g. in ProcessMaterialsStep).
   * @param error - Axios error (if request failed).
   * @param endpoint - Requested URL endpoint.
   * @param requestTimestamp - Request start time.
   * @param response - Optional Axios response (may be null for network errors or timeouts).
   * @returns ApiResponseAnalysis object with analysis results.
   */
  analyzeResponse(
    materialId: string | null,
    error: AxiosError | null,
    endpoint: string,
    requestTimestamp: Date,
    response?: AxiosResponse | null,
  ): ApiResponseAnalysis {
    let errorType: ApiErrorType = ApiErrorType.NONE;
    let errorMessage: string = '';
    let statusCode: number = response?.status ?? 0;
    let isSuccess: boolean = false;
    const responseTime = Date.now() - requestTimestamp.getTime();

    if (error) {
      statusCode =
        error.response?.status ?? (error.code === 'ECONNABORTED' ? 408 : 0); // 408 Request Timeout
      errorMessage = error.message;
      if (error.response) {
        // Error with server response (4xx, 5xx)
        const responseData = error.response.data as {
          code?: number;
          msg?: string;
        };
        errorMessage = responseData?.msg || error.message;
        if (statusCode === 429 || responseData?.code === 429 || 
            (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('too many requests'))) {
          errorType = ApiErrorType.RATE_LIMIT;
        } else if (
          statusCode === 403 ||
          statusCode === 401 ||
          responseData?.code === 40101 ||
          (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('no permission'))
        ) {
          errorType = ApiErrorType.ACCESS_DENIED;
        } else if (statusCode === 404) {
          errorType = ApiErrorType.NOT_FOUND;
        } else if (statusCode >= 500) {
          errorType = ApiErrorType.OTHER_SERVER_ERROR;
        } else {
          errorType = ApiErrorType.OTHER;
        }
      } else if (error.request) {
        // Request was made but no response (network, timeout)
        if (error.code === 'ECONNABORTED') {
          errorType = ApiErrorType.TIMEOUT;
        } else {
          errorType = ApiErrorType.NETWORK;
        }
      } else {
        // Request setup error
        errorType = ApiErrorType.OTHER;
        errorMessage = `Request setup error: ${error.message}`;
      }
    } else if (response) {
      // Successful response (2xx), but may have logical API error
      const responseData = response.data as {
        code?: number;
        msg?: string;
        data?: any;
      };
      statusCode = response.status;
      if (responseData.code !== 0 && responseData.code !== 200) {
        // Check TikTok success codes
        isSuccess = false;
        errorType = ApiErrorType.LOGICAL_ERROR;
        errorMessage =
          responseData.msg ||
          `API returned non-zero code: ${responseData.code}`;
      } else if (
        !responseData.data &&
        response.config.method?.toUpperCase() !== 'HEAD'
      ) {
        // Check for expected data if not HEAD request
        isSuccess = false;
        errorType = ApiErrorType.EMPTY_RESPONSE;
        errorMessage = 'API response data is empty or missing.';
      } else {
        isSuccess = true;
        errorType = ApiErrorType.NONE;
      }

      // Check for malformed response (could use zod/yup validation)
      try {
        // Basic structure validation
        if (responseData && typeof responseData !== 'object') {
          throw new Error('Response is not an object');
        }
      } catch (e) {
        isSuccess = false;
        errorType = ApiErrorType.MALFORMED_RESPONSE;
        errorMessage = e instanceof Error ? e.message : String(e);
      }
    } else {
      // Should not happen, but for completeness
      errorType = ApiErrorType.UNKNOWN;
      errorMessage = 'Unknown state: No response and no error.';
    }

    const analysis: ApiResponseAnalysis = {
      materialId: materialId ?? 'N/A',
      timestamp: new Date(),
      endpoint: endpoint,
      requestUrl: error?.config?.url || response?.config?.url || endpoint,
      isSuccess: isSuccess,
      statusCode: statusCode,
      errorType: errorType,
      errorMessage: errorMessage.substring(0, 1000), // Limit length
      responseHeaders: response?.headers as Record<string, string>,
      responseSize: response?.headers['content-length']
        ? parseInt(response.headers['content-length'], 10)
        : undefined,
      responseTime: responseTime,
      responseSnippet: response?.data
        ? JSON.stringify(response.data).substring(0, 500)
        : '', // Truncated JSON
    };

    // Save non-critical errors for analysis
    if (
      !analysis.isSuccess &&
      errorType !== ApiErrorType.ACCESS_DENIED &&
      errorType !== ApiErrorType.NOT_FOUND
    ) {
      this.errorStorage.addError(analysis);
      this.logger.debug(
        `Logged API error of type ${errorType}: ${errorMessage.substring(0, 100)}`,
      );
    }

    return analysis;
  }

  /**
   * Generates recommendations for adjusting request strategy
   * based on current analysis and recent error history from ErrorStorage.
   * @param analysis - Current response/error analysis result.
   * @param currentAttempt - Current attempt number (starting from 1).
   * @param maxAttempts - Maximum allowed attempts.
   * @returns Action recommendation.
   */
  generateActionRecommendation(
    analysis: ApiResponseAnalysis,
    currentAttempt: number,
    maxAttempts: number,
  ): ActionRecommendation {
    if (!this.shouldRetry(analysis)) {
      return {
        action: 'abort',
        message: `Aborting: Unretryable error type ${analysis.errorType}.`,
      };
    }

    if (currentAttempt >= maxAttempts) {
      return {
        action: 'abort',
        message: `Aborting: Max attempts (${maxAttempts}) reached for ${analysis.materialId ?? analysis.requestUrl}. Last error: ${analysis.errorType}`,
      };
    }

    // Analyze recent errors
    const recentErrors = this.errorStorage.getErrors().slice(-5); // Get last 5 errors
    const recentRateLimits = recentErrors.filter(
      (e) => e.errorType === ApiErrorType.RATE_LIMIT,
    ).length;
    const recentTimeouts = recentErrors.filter(
      (e) => e.errorType === ApiErrorType.TIMEOUT,
    ).length;

    let delayMs = this.calculateBackoffTime(analysis, currentAttempt);
    let action: ActionRecommendation['action'] = 'retry';
    let message = `Recommendation: Retry attempt ${currentAttempt + 1}/${maxAttempts} after ${delayMs}ms. Error: ${analysis.errorType}`;

    // Enhanced logic for rate limit handling
    if (
      analysis.errorType === ApiErrorType.RATE_LIMIT ||
      recentRateLimits >= 2
    ) {
      // If current error is rate limit OR there were >= 2 recent rate limits
      delayMs = Math.max(delayMs, 5000); // Increase minimum delay for rate limits

      if (recentRateLimits >= 3) {
        action = 'reduce_batch';
        message = `Recommendation: Reduce batch size and retry. Multiple rate limits detected (${recentRateLimits} in last 5 requests)`;
      } else {
        action = 'delay';
        message = `Recommendation: Delaying and Retrying attempt ${currentAttempt + 1}/${maxAttempts} after ${delayMs}ms due to rate limiting.`;
      }
    }

    // If experiencing multiple timeouts, change strategy
    else if (recentTimeouts >= 3) {
      action = 'delay';
      delayMs = Math.max(delayMs, 3000);
      message = `Recommendation: Delay longer due to multiple timeouts (${recentTimeouts} in last 5 requests)`;
    }

    return {
      action: action,
      delayMs: delayMs,
      message: message,
      maxAttempts: maxAttempts,
      context: {
        recentErrors: {
          rateLimits: recentRateLimits,
          timeouts: recentTimeouts,
          total: recentErrors.length,
        },
      },
    };
  }

  /**
   * Determines if request should be retried based on error type.
   * @param analysis - Error analysis result.
   * @returns true if the error should be retried.
   */
  shouldRetry(analysis: ApiResponseAnalysis): boolean {
    switch (analysis.errorType) {
      case ApiErrorType.RATE_LIMIT:
      case ApiErrorType.TIMEOUT:
      case ApiErrorType.NETWORK:
      case ApiErrorType.OTHER_SERVER_ERROR: // e.g., 500, 503
      case ApiErrorType.EMPTY_RESPONSE: // Sometimes worth retrying if data was expected
      case ApiErrorType.MALFORMED_RESPONSE: // Sometimes response might be temporary garbage
      case ApiErrorType.OTHER: // Unknown errors worth retrying
      case ApiErrorType.UNKNOWN:
        return true;
      case ApiErrorType.NONE: // Successful response doesn't need retry
      case ApiErrorType.ACCESS_DENIED: // Pointless to retry without changing credentials/headers
      case ApiErrorType.NOT_FOUND: // Resource not found, retry won't help
      case ApiErrorType.LOGICAL_ERROR: // API logic error, retry unlikely to fix
        return false;
      default:
        return false; // By default, don't retry unknown types
    }
  }

  /**
   * Calculates optimal wait time before next retry.
   * Uses exponential backoff with jitter.
   * @param analysis - Error analysis result (may affect base delay).
   * @param attempt - Attempt number (starting from 1).
   * @returns Wait time in milliseconds.
   */
  calculateBackoffTime(analysis: ApiResponseAnalysis, attempt: number): number {
    const baseDelay = 2000; // Increased base delay to 2 sec (was 0.5)
    const maxDelay = 60000; // Increased maximum delay to 60 sec (was 30)
    
    // More aggressive exponential growth: 2s, 4s, 8s, 16s, 32s, 60s, 60s...
    const exponentialDelay = Math.min(
      maxDelay,
      baseDelay * Math.pow(2, attempt - 1),
    );
    
    // Add larger jitter (random delay up to 2000ms) to prevent "thundering herd"
    const jitter = Math.random() * 2000;
    let calculatedDelay = Math.round(exponentialDelay + jitter);

    // Special cases with significantly more aggressive backoff
    if (analysis.errorType === ApiErrorType.RATE_LIMIT) {
      // For Rate Limit, use much larger minimum delay
      const rateLimitBaseDelay = 5000; // 5 seconds base
      const rateLimitDelay = Math.min(
        maxDelay,
        rateLimitBaseDelay * Math.pow(2, attempt)
      );
      calculatedDelay = Math.max(calculatedDelay, rateLimitDelay); // Minimum 5s, 10s, 20s, 40s, 60s for Rate Limit
    } else if (analysis.errorType === ApiErrorType.TIMEOUT) {
      // For timeouts, also increase backoff but less aggressively
      calculatedDelay = Math.max(calculatedDelay, 3000 * attempt); // 3s, 6s, 9s, 12s minimum for timeouts
    } else if (analysis.errorType === ApiErrorType.NETWORK) {
      // For network errors, increase backoff
      calculatedDelay = Math.max(calculatedDelay, 2500 * attempt); // 2.5s, 5s, 7.5s, 10s minimum for network errors
    }

    return calculatedDelay;
  }

  /**
   * Analyzes error frequency by type over the last N requests
   * @returns Object with error types as keys and counts as values
   */
  getErrorFrequencyAnalysis(): Record<string, number> {
    const errors = this.errorStorage.getErrors();
    const result: Record<string, number> = {};

    for (const error of errors) {
      if (!result[error.errorType]) {
        result[error.errorType] = 0;
      }
      result[error.errorType]++;
    }

    return result;
  }

  /**
   * Analyzes trends in error rates over time
   * @param timeWindowMinutes - Time window in minutes for trend analysis
   */
  getErrorRateTrend(timeWindowMinutes: number = 10): Record<string, any> {
    const errors = this.errorStorage.getErrors();
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);

    const recentErrors = errors.filter((e) => e.timestamp >= windowStart);
    const olderErrors = errors.filter((e) => e.timestamp < windowStart);

    // Calculate error rates for recent and older errors
    const recentErrorTypes: Record<string, number> = {};
    const olderErrorTypes: Record<string, number> = {};

    for (const error of recentErrors) {
      if (!recentErrorTypes[error.errorType]) {
        recentErrorTypes[error.errorType] = 0;
      }
      recentErrorTypes[error.errorType]++;
    }

    for (const error of olderErrors) {
      if (!olderErrorTypes[error.errorType]) {
        olderErrorTypes[error.errorType] = 0;
      }
      olderErrorTypes[error.errorType]++;
    }

    // Calculate trend (increase/decrease) for each error type
    const trends: Record<string, any> = {};
    const allErrorTypes = [
      ...new Set([
        ...Object.keys(recentErrorTypes),
        ...Object.keys(olderErrorTypes),
      ]),
    ];

    for (const errorType of allErrorTypes) {
      const recentCount = recentErrorTypes[errorType] || 0;
      const olderCount = olderErrorTypes[errorType] || 0;

      // Calculate relative change if older period had errors
      let trend = 0;
      if (olderCount > 0) {
        trend = ((recentCount - olderCount) / olderCount) * 100;
      } else if (recentCount > 0) {
        trend = 100; // 100% increase if there were no errors before
      }

      trends[errorType] = {
        recent: recentCount,
        older: olderCount,
        trend: trend,
        increasing: trend > 10, // Consider >10% increase as significant
      };
    }

    return {
      timeWindowMinutes,
      recentTotal: recentErrors.length,
      olderTotal: olderErrors.length,
      errorTypes: trends,
    };
  }
}
