import { ApiResponseAnalysis } from '@src/core/api/models/api-response-analysis';
import { Injectable, Logger } from '@nestjs/common';
import { ApiErrorType } from '@src/core/api/models/api-error-type';

@Injectable()
export class ErrorStorage {
  private static instance: ErrorStorage;
  private errors: ApiResponseAnalysis[] = [];
  private readonly maxStoredErrors: number = 100;
  private readonly logger = new Logger(ErrorStorage.name);

  private constructor() {}

  public static getInstance(): ErrorStorage {
    if (!ErrorStorage.instance) {
      ErrorStorage.instance = new ErrorStorage();
    }
    return ErrorStorage.instance;
  }

  /**
   * Add an error to the storage for analysis
   * @param analysis API response analysis containing error details
   */
  addError(analysis: ApiResponseAnalysis): void {
    // Implement circular buffer behavior - remove oldest error if at capacity
    if (this.errors.length >= this.maxStoredErrors) {
      this.errors.shift();
    }
    this.errors.push(analysis);
    
    // Log error frequency every 10 errors
    if (this.errors.length % 10 === 0) {
      this.logErrorFrequency();
    }
  }

  /**
   * Get all stored errors
   */
  getErrors(): ApiResponseAnalysis[] {
    return this.errors;
  }
  
  /**
   * Get the most recent errors up to a specified limit
   * @param limit Maximum number of recent errors to return
   */
  getRecentErrors(limit: number): ApiResponseAnalysis[] {
    return this.errors.slice(-Math.min(limit, this.errors.length));
  }
  
  /**
   * Get errors of a specific type
   * @param errorType The type of errors to filter for
   */
  getErrorsByType(errorType: ApiErrorType): ApiResponseAnalysis[] {
    return this.errors.filter(error => error.errorType === errorType);
  }
  
  /**
   * Get errors that occurred within a specified time window
   * @param minutesAgo Get errors from the last N minutes
   */
  getErrorsFromLastMinutes(minutesAgo: number): ApiResponseAnalysis[] {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return this.errors.filter(error => error.timestamp >= cutoffTime);
  }
  
  /**
   * Calculate and log the frequency of each error type
   */
  logErrorFrequency(): void {
    const errorCounts: Record<string, number> = {};
    
    for (const error of this.errors) {
      if (!errorCounts[error.errorType]) {
        errorCounts[error.errorType] = 0;
      }
      errorCounts[error.errorType]++;
    }
    
    this.logger.log(`Error frequency in the last ${this.errors.length} requests:`, errorCounts);
  }
  
  /**
   * Check if rate limiting might be occurring based on error patterns
   * @returns boolean indicating if rate limiting is likely occurring
   */
  isRateLimitingLikely(): boolean {
    const recentErrors = this.getErrorsFromLastMinutes(5);
    const rateLimitErrors = recentErrors.filter(
      error => error.errorType === ApiErrorType.RATE_LIMIT
    );
    
    // Rate limiting is likely if >20% of recent errors are rate limits
    return rateLimitErrors.length > 0 && 
           (rateLimitErrors.length / recentErrors.length) > 0.2;
  }
  
  /**
   * Get statistics about rate-limited endpoints
   * @returns Record mapping endpoints to their rate limit count
   */
  getRateLimitedEndpoints(): Record<string, number> {
    const rateLimitErrors = this.errors.filter(
      error => error.errorType === ApiErrorType.RATE_LIMIT
    );
    
    const endpointCounts: Record<string, number> = {};
    for (const error of rateLimitErrors) {
      const endpoint = error.endpoint;
      if (!endpointCounts[endpoint]) {
        endpointCounts[endpoint] = 0;
      }
      endpointCounts[endpoint]++;
    }
    
    return endpointCounts;
  }

  /**
   * Clear all stored errors
   */
  clear(): void {
    this.errors = [];
  }
}