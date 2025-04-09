import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { TiktokScraperStep } from './tiktok-scraper-step';
import {
  TiktokScraperContext,
  TikTokApiResponse,
} from '../tiktok-scraper-types';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class ApiRequestStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {
    super(name, logger);
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

    try {
      // Generate a unique request ID
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

      // Make the API request
      const response = await axios.get<TikTokApiResponse>(
        apiEndpoint.toString(),
        {
          headers: headersWithAuth,
        },
      );

      // Handle the response
      if (response.status !== 200) {
        throw new Error(`API request failed with status: ${response.status}`);
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
      // Check for specific Axios error with code 40101
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ code?: number; msg?: string }>; // Type assertion for better access
        if (axiosError.response?.data?.code === 40101) {
          this.logger.warn(
            `API permission error (40101): ${axiosError.response.data.msg}. Setting permissionError flag.`,
          );
          context.state.permissionError = true; // Set flag for the calling service
          context.state.errors.push(
            new Error(
              `API Permission Error: ${axiosError.response.data.msg} (Code: 40101)`,
            ),
          );
          return false; // Indicate step failure due to permission error
        }
      }

      // Handle other errors
      this.logger.error(`Error in ${this.name}:`, error);
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      context.state.errors.push(errorMessage);
      return false; // Indicate general step failure
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
