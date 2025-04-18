/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { TikTokApiConfig } from '@src/scrapers/tiktok/models/api-config';
import { AxiosError } from 'axios';
import { ApiConfigManager } from './api-config-manager';

/**
 * Adapter service that integrates ApiConfigManager with the TikTok scraper
 * This provides specific functionality for TikTok API configurations
 */
@Injectable()
export class TikTokApiConfigAdapter {
  private readonly tiktokEndpoints = {
    creativeCenter:
      'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list?',
    detailApi: 'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/detail',
  };

  constructor(
    private readonly logger: Logger,
    private readonly apiConfigManager: ApiConfigManager,
  ) {}

  /**
   * Get a valid TikTok API configuration for the creative center endpoint
   * @returns A valid TikTok API configuration or null if none found
   */
  async getCreativeCenterConfig(): Promise<TikTokApiConfig | null> {
    return this.getTikTokApiConfig(this.tiktokEndpoints.creativeCenter);
  }

  /**
   * Get a valid TikTok API configuration for the detail API endpoint
   * @returns A valid TikTok API configuration or null if none found
   */
  async getDetailApiConfig(): Promise<TikTokApiConfig | null> {
    return this.getTikTokApiConfig(this.tiktokEndpoints.detailApi);
  }

  /**
   * Get a valid TikTok API configuration for the specified endpoint
   * @param endpoint The API endpoint
   * @returns A valid TikTok API configuration or null if none found
   */
  private async getTikTokApiConfig(
    endpoint: string,
  ): Promise<TikTokApiConfig | null> {
    try {
      const config = await this.apiConfigManager.getConfig(endpoint);

      if (!config) {
        this.logger.warn(
          `No valid API configuration found for TikTok endpoint: ${endpoint}`,
        );
        return null;
      }

      // Transform to TikTokApiConfig format
      return {
        ...config,
        parameters: config.parsedParameters || (config.parameters as any),
        headers: config.parsedHeaders || (config.headers as any),
        url: endpoint,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error getting TikTok API config for ${endpoint}`,
        error,
      );
      return null;
    }
  }

  /**
   * Report an error with a TikTok API configuration
   * @param config The configuration that had an error
   * @param error The error that occurred
   * @param endpoint The specific endpoint that was accessed
   */
  async reportError(
    config: TikTokApiConfig,
    error: Error | AxiosError,
    endpoint: string,
  ): Promise<void> {
    if (!config) {
      this.logger.warn('Cannot report error: No configuration provided');
      return;
    }

    try {
      await this.apiConfigManager.reportError(config.id, error, endpoint);

      // Log additional TikTok-specific error information
      if ((error as AxiosError).isAxiosError) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const responseData = axiosError.response?.data;

        if (statusCode === 429) {
          this.logger.warn('TikTok API rate limit exceeded', {
            configId: config.id,
            endpoint,
            headers: axiosError.config?.headers,
          });
        } else if (statusCode === 403 || statusCode === 401) {
          this.logger.warn('TikTok API authentication error', {
            configId: config.id,
            statusCode,
            responseData,
          });
        }
      }
    } catch (reportError) {
      this.logger.error('Failed to report TikTok API error', reportError);
    }
  }

  /**
   * Get a fallback config if the primary one fails
   * Useful during request retries
   * @param endpoint The API endpoint
   * @returns A different valid API configuration or null if none found
   */
  async getFallbackConfig(endpoint: string): Promise<TikTokApiConfig | null> {
    try {
      // Force refresh cache to get latest configs
      await this.apiConfigManager.refreshConfigCache();

      // Get a different config
      return this.getTikTokApiConfig(endpoint);
    } catch (error) {
      this.logger.error(
        `Error getting fallback TikTok API config for ${endpoint}`,
        error,
      );
      return null;
    }
  }
}
