import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { TiktokScraperStep } from './tiktok-scraper-step';
import {
  TiktokScraperContext,
  TikTokApiResponse,
} from '../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';
import { ApiResponseAnalyzer } from '@src/core/api/analyzer/base-api-response-analyzer';
import { ErrorStorage } from '@src/core/error-handling/storage/error-storage';

@Injectable()
export class ApiRequestStep extends TiktokScraperStep {
  private readonly errorStorage: ErrorStorage;
  private readonly apiAnalyzer: ApiResponseAnalyzer;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    super(name, logger);
    // Use singleton instance for error storage
    this.errorStorage = ErrorStorage.getInstance();
    this.apiAnalyzer = new ApiResponseAnalyzer(this.errorStorage);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (!context.state.apiConfig) {
      throw new Error(
        'API configuration is missing. GetApiConfigStep must be executed first.',
      );
    }

    // Reset permission error flag at the start of execution
    context.state.permissionError = false;

    // Generate a unique request ID for tracking
    const requestId = uuidv4();
    this.logger.log(`Starting TikTok API request (ID: ${requestId})`);

    // Extract API configuration that was set in the previous step
    const { headers, url } = context.state.apiConfig;

    // Build the API URL with query parameters
    const apiEndpoint = new URL(url);

    // Map our context query to TikTok API parameters
    const { query } = context;

    // Add query parameters
    if (query.queryString) {
      apiEndpoint.searchParams.set('keyword', query.queryString);
    }

    // Add period/timeframe parameter if set
    if (query.period) {
      apiEndpoint.searchParams.set('period', query.period.toString());
    }

    // Get current page, start with 1 if not initialized
    const currentPage = context.state.currentPage || 0;

    // Add page number for pagination (API pages are 1-based)
    apiEndpoint.searchParams.set('page', (currentPage + 1).toString());
    this.logger.log(`Requesting page ${currentPage + 1}`);

    // Add sorting parameter
    if (query.orderBy) {
      apiEndpoint.searchParams.set('order_by', query.orderBy);
    }

    // Add country code filter
    if (query.countryCode && query.countryCode.length > 0) {
      apiEndpoint.searchParams.set('country_code', query.countryCode[0]);
    }

    // Add additional filters if available
    if (query.adFormat) {
      apiEndpoint.searchParams.set('ad_format', query.adFormat.toString());
    }

    if (query.like) {
      apiEndpoint.searchParams.set('like', query.like.toString());
    }

    if (query.adLanguages && query.adLanguages.length > 0) {
      apiEndpoint.searchParams.set(
        'ad_language',
        query.adLanguages.join(','),
      );
    }

    this.logger.log(`Making API request to: ${apiEndpoint.toString()}`);

    // Set up headers from API config
    const headersWithAuth = {
      ...headers,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
    };

    // Check if we need throttling based on previous errors
    await this.applyThrottling(context);

    // Track request timestamp for response time measurement
    const requestTimestamp = new Date();
    
    try {
      // Make the API request
      const response = await axios.get<TikTokApiResponse>(
        apiEndpoint.toString(),
        {
          headers: headersWithAuth,
        },
      );
      
      // Analyze the successful response
      const analysis = this.apiAnalyzer.analyzeResponse(
        '',
        null,
        apiEndpoint.toString(),
        requestTimestamp,
        response,
      );
      
      // Log success details
      this.logger.log(
        `API request (ID: ${requestId}) completed in ${analysis.responseTime}ms with status ${response.status}`,
      );

      // Handle the response
      if (!analysis.isSuccess) {
        this.logger.warn(`API request had logical error: ${analysis.errorMessage}`);
        throw new Error(`API request failed with logical error: ${analysis.errorMessage}`);
      }

      // Extract data from the response
      const searchData = response.data;

      // Save the raw API response in context for pagination and material processing
      context.state.rawApiResponse = searchData;

      // Process ad materials from the response
      if (
        searchData?.data?.materials &&
        Array.isArray(searchData.data.materials)
      ) {
        // Update pagination information
        if (searchData.data.pagination) {
          const { pagination } = searchData.data;

          // Update context with basic pagination info (detailed handling in PaginationStep)
          context.state.hasMoreResults = pagination.has_more;

          this.logger.log(
            `Retrieved page ${pagination.page} of results. Total count: ${pagination.total_count}, Has more: ${pagination.has_more}`,
          );
        }

        return true;
      } else {
        this.logger.warn(`No materials found in API response`);
        context.state.hasMoreResults = false;
        return true;
      }
    } catch (error) {
      // Use the analyzer to process the error
      const analysis = this.apiAnalyzer.analyzeResponse(
        '',
        error instanceof AxiosError ? error : null,
        apiEndpoint.toString(),
        requestTimestamp,
      );
      
      // Generate recommendation for action based on error analysis
      const recommendation = this.apiAnalyzer.generateActionRecommendation(
        analysis,
        1, // This is the first attempt in this step
        3, // Maximum attempts would be handled by RetryHandler
      );
      
      this.logger.error(
        `API request (ID: ${requestId}) failed: ${analysis.errorMessage}. Recommendation: ${recommendation.message}`,
      );
      
      // Check for specific Axios error with code 40101 (permission error)
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
        if (axiosError.response?.data?.code === 40101) {
          this.logger.warn(
            `API permission error (40101): ${axiosError.response.data.msg}. Setting permissionError flag.`,
          );
          context.state.permissionError = true; // Set flag for the calling service
        }
      }

      // Track the error in context for reporting
      context.state.apiErrors.push({
        materialId: '',
        timestamp: new Date(),
        endpoint: apiEndpoint.toString(),
        error:
          error instanceof AxiosError ? error : new AxiosError(String(error)),
      });
      
      return false; // Indicate general step failure
    }
  }
  
  /**
   * Apply throttling based on error patterns if needed
   */
  private async applyThrottling(context: TiktokScraperContext): Promise<void> {
    // If rate limiting is likely occurring, add additional delay
    if (this.errorStorage.isRateLimitingLikely()) {
      const currentPage = context.state.currentPage || 0;
      // Calculate dynamic delay based on both page number and rate limit detection
      const baseDelay = 1000; // Base 1 second delay 
      const pageMultiplier = Math.min(currentPage, 10); // Cap at page 10
      const dynamicDelay = baseDelay + (pageMultiplier * 200);
      
      this.logger.warn(
        `Rate limiting detected! Adding preventive delay of ${dynamicDelay}ms before request`,
      );
      
      await new Promise(resolve => setTimeout(resolve, dynamicDelay));
    }
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    // Execute if we have API config and either:
    // 1. We're on the initial page (currentPage is 0 or undefined)
    // 2. We have more results to fetch and haven't exceeded max pages
    const maxPages = context.options.behavior?.maxPages || 10;
    const currentPage = context.state.currentPage || 0;

    const shouldProceed =
      !!context.state.apiConfig &&
      (currentPage === 0 ||
        (context.state.hasMoreResults && currentPage < maxPages));

    if (!shouldProceed && currentPage > 0) {
      this.logger.log(
        `Skipping API request - either no more results or max pages (${maxPages}) reached`,
      );
    }

    return Promise.resolve(shouldProceed ?? false);
  }

  getName(): string {
    return this.name;
  }
}