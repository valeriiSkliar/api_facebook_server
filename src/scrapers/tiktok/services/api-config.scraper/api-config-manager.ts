/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { ApiConfiguration } from '@prisma/client';
import { AxiosError } from 'axios';

// Enum for API configuration statuses
export enum ApiConfigStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  COOLING_DOWN = 'COOLING_DOWN',
}

// Interface for API configuration with parsed parameters
export interface ApiConfigWithParams extends ApiConfiguration {
  parsedHeaders?: Record<string, string>;
  parsedParameters?: Record<string, any>;
}

// Interface for error tracking
export interface ApiConfigError {
  configId: number;
  endpoint: string;
  statusCode?: number;
  errorMessage: string;
  timestamp: Date;
}

@Injectable()
export class ApiConfigManager {
  // Cache for quick access to configurations
  private configCache: Map<string, ApiConfigWithParams[]> = new Map();

  // Cache for tracking errors by configuration
  private configErrors: Map<number, ApiConfigError[]> = new Map();

  // Cooling down period in milliseconds (default: 30 minutes)
  private readonly coolingDownPeriod = 30 * 60 * 1000;

  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    // Initialize the service
    this.init();
  }

  /**
   * Initialize the service by loading active configurations into cache
   */
  private async init(): Promise<void> {
    try {
      this.logger.log('Initializing ApiConfigManager...');
      await this.refreshConfigCache();

      // Set up periodic cache refresh (every 5 minutes)
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setInterval(() => this.refreshConfigCache(), 5 * 60 * 1000);

      this.logger.log('ApiConfigManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ApiConfigManager', error);
    }
  }

  /**
   * Refresh the configuration cache from the database
   */
  public async refreshConfigCache(): Promise<void> {
    try {
      const configs = await this.prisma.apiConfiguration.findMany({
        where: {
          status: ApiConfigStatus.ACTIVE,
          expiresAt: {
            gt: new Date(), // Only non-expired configs
          },
        },
        orderBy: {
          usageCount: 'asc', // Prioritize less used configs
        },
      });

      // Group configurations by endpoint for faster access
      const endpointMap = new Map<string, ApiConfigWithParams[]>();

      for (const config of configs) {
        const parsedConfig = this.parseConfig(config);

        // Group by endpoint
        const endpoint = config.endpoint;
        if (!endpointMap.has(endpoint)) {
          endpointMap.set(endpoint, []);
        }
        endpointMap.get(endpoint)?.push(parsedConfig);
      }

      // Update the cache
      this.configCache = endpointMap;

      this.logger.log(
        `Refreshed config cache with ${configs.length} active configurations`,
      );
    } catch (error) {
      this.logger.error('Error refreshing config cache', error);
    }
  }

  /**
   * Parse the configuration from database format to usable format
   */
  private parseConfig(config: ApiConfiguration): ApiConfigWithParams {
    try {
      // Parse JSON fields
      const parsedHeaders = config.headers as Record<string, string>;
      const parsedParameters = config.parameters as Record<string, any>;

      return {
        ...config,
        parsedHeaders,
        parsedParameters,
      };
    } catch (error) {
      this.logger.error(`Error parsing config ${config.id}`, error);
      return config;
    }
  }

  /**
   * Get a valid API configuration for the specified endpoint
   * @param endpoint The API endpoint
   * @returns A valid API configuration or null if none found
   */
  async getConfig(endpoint: string): Promise<ApiConfigWithParams | null> {
    // Check cache first
    const cachedConfigs = this.configCache.get(endpoint);

    if (cachedConfigs && cachedConfigs.length > 0) {
      // Get the least used config from cache
      const config = cachedConfigs[0];

      // Check if it's still valid
      if (config.expiresAt > new Date()) {
        // Update usage count in database asynchronously
        this.updateConfigUsage(config.id).catch((err) =>
          this.logger.error(
            `Failed to update config usage for ${config.id}`,
            err,
          ),
        );

        return config;
      }
    }

    // If not in cache or invalid, fetch from database
    try {
      const freshConfig = await this.prisma.apiConfiguration.findFirst({
        where: {
          status: ApiConfigStatus.ACTIVE,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          usageCount: 'asc', // Get least used config
        },
      });

      if (freshConfig) {
        const parsedConfig = this.parseConfig(freshConfig);

        // Update cache asynchronously
        this.refreshConfigCache().catch((err) =>
          this.logger.error('Failed to refresh config cache', err),
        );

        // Update usage count
        this.updateConfigUsage(freshConfig.id).catch((err) =>
          this.logger.error(
            `Failed to update config usage for ${freshConfig.id}`,
            err,
          ),
        );

        return parsedConfig;
      }

      // No valid config found
      this.logger.warn(
        `No valid API configuration found for endpoint: ${endpoint}`,
      );
      return null;
    } catch (error) {
      this.logger.error(`Error getting config for endpoint ${endpoint}`, error);
      return null;
    }
  }

  /**
   * Update the usage count for a configuration
   * @param configId The configuration ID
   */
  private async updateConfigUsage(configId: number): Promise<void> {
    try {
      await this.prisma.apiConfiguration.update({
        where: { id: configId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update usage for config ${configId}`, error);
    }
  }

  /**
   * Report an error with a configuration
   * @param configId The configuration ID
   * @param error The error that occurred
   * @param endpoint The endpoint that was accessed
   */
  async reportError(
    configId: number,
    error: Error | AxiosError,
    endpoint: string,
  ): Promise<void> {
    try {
      // Track the error in memory
      if (!this.configErrors.has(configId)) {
        this.configErrors.set(configId, []);
      }

      const statusCode = (error as AxiosError).response?.status;

      const configError: ApiConfigError = {
        configId,
        endpoint,
        statusCode,
        errorMessage: error.message,
        timestamp: new Date(),
      };

      this.configErrors.get(configId)?.push(configError);

      // Log the error
      this.logger.warn(
        `API error reported for config ${configId}: ${error.message}`,
      );

      // Check if we should mark the config as invalid
      await this.checkConfigStatus(configId);

      // Save error to database via ApiErrorRecord
      await this.saveErrorRecord(configId, error, endpoint);
    } catch (reportError) {
      this.logger.error(
        `Failed to report error for config ${configId}`,
        reportError,
      );
    }
  }

  /**
   * Check if a configuration should be marked as invalid based on error history
   * @param configId The configuration ID
   */
  private async checkConfigStatus(configId: number): Promise<void> {
    const errors = this.configErrors.get(configId) || [];

    // If we have multiple errors in a short time period, mark as cooling down
    const recentErrors = errors.filter(
      (e) => new Date().getTime() - e.timestamp.getTime() < 5 * 60 * 1000, // Last 5 minutes
    );

    if (recentErrors.length >= 3) {
      // Too many recent errors, mark as cooling down
      await this.markConfigAsCoolingDown(configId);
      return;
    }

    // Check for specific error types that would indicate a permanent issue
    const fatalErrors = errors.filter(
      (e) =>
        e.statusCode === 401 || // Unauthorized
        e.statusCode === 403 || // Forbidden
        e.errorMessage.toLowerCase().includes('permission') ||
        e.errorMessage.toLowerCase().includes('expired') ||
        e.errorMessage.toLowerCase().includes('invalid token'),
    );

    if (fatalErrors.length > 0) {
      // Fatal error, mark as expired
      await this.markConfigAsExpired(configId);
      return;
    }
  }

  /**
   * Mark a configuration as cooling down
   * @param configId The configuration ID
   */
  private async markConfigAsCoolingDown(configId: number): Promise<void> {
    try {
      // Update in database
      await this.prisma.apiConfiguration.update({
        where: { id: configId },
        data: {
          status: ApiConfigStatus.COOLING_DOWN,
          updated_at: new Date(),
        },
      });

      // Update local cache
      this.refreshConfigCache().catch((err) =>
        this.logger.error('Failed to refresh config cache', err),
      );

      this.logger.log(
        `Marked config ${configId} as COOLING_DOWN due to multiple errors`,
      );

      // Schedule reactivation after cooling down period
      setTimeout(() => this.reactivateConfig(configId), this.coolingDownPeriod);
    } catch (error) {
      this.logger.error(
        `Failed to mark config ${configId} as cooling down`,
        error,
      );
    }
  }

  /**
   * Mark a configuration as expired (permanently invalid)
   * @param configId The configuration ID
   */
  private async markConfigAsExpired(configId: number): Promise<void> {
    try {
      // Update in database
      await this.prisma.apiConfiguration.update({
        where: { id: configId },
        data: {
          status: ApiConfigStatus.EXPIRED,
          expiresAt: new Date(), // Set to now to mark as expired
          updated_at: new Date(),
        },
      });

      // Update local cache
      this.refreshConfigCache().catch((err) =>
        this.logger.error('Failed to refresh config cache', err),
      );

      this.logger.log(
        `Marked config ${configId} as EXPIRED due to fatal errors`,
      );
    } catch (error) {
      this.logger.error(`Failed to mark config ${configId} as expired`, error);
    }
  }

  /**
   * Attempt to reactivate a cooling down configuration
   * @param configId The configuration ID
   */
  private async reactivateConfig(configId: number): Promise<void> {
    try {
      // Check if there were any new errors during cooling down
      const errors = this.configErrors.get(configId) || [];
      const recentErrors = errors.filter(
        (e) =>
          new Date().getTime() - e.timestamp.getTime() < this.coolingDownPeriod,
      );

      if (recentErrors.length === 0) {
        // No new errors, safe to reactivate
        await this.prisma.apiConfiguration.update({
          where: {
            id: configId,
            status: ApiConfigStatus.COOLING_DOWN, // Only update if still cooling down
          },
          data: {
            status: ApiConfigStatus.ACTIVE,
            updated_at: new Date(),
          },
        });

        // Clear error history for this config
        this.configErrors.delete(configId);

        // Update local cache
        this.refreshConfigCache().catch((err) =>
          this.logger.error('Failed to refresh config cache', err),
        );

        this.logger.log(
          `Reactivated config ${configId} after cooling down period`,
        );
      } else {
        // Still experiencing errors, extend cooling down period
        this.logger.log(
          `Config ${configId} still has errors, extending cooling down period`,
        );
        setTimeout(
          () => this.reactivateConfig(configId),
          this.coolingDownPeriod,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to reactivate config ${configId}`, error);
    }
  }

  /**
   * Save an error record to the database
   * @param configId The configuration ID
   * @param error The error that occurred
   * @param endpoint The endpoint that was accessed
   */
  private async saveErrorRecord(
    configId: number,
    error: Error | AxiosError,
    endpoint: string,
  ): Promise<void> {
    try {
      const isAxiosError = (error as AxiosError).isAxiosError;
      const statusCode = isAxiosError
        ? (error as AxiosError).response?.status || 0
        : 0;
      const errorType = isAxiosError
        ? statusCode === 429
          ? 'RATE_LIMIT'
          : 'API_ERROR'
        : 'GENERIC_ERROR';

      // Create error record in database
      await this.prisma.apiErrorRecord.create({
        data: {
          apiConfigId: configId,
          timestamp: new Date(),
          endpoint: endpoint.substring(0, 500), // Truncate if too long
          requestUrl: endpoint,
          statusCode,
          errorType,
          errorMessage: error.message,
          retryCount: 0,
          wasResolved: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (saveError) {
      this.logger.error(
        `Failed to save error record for config ${configId}`,
        saveError,
      );
    }
  }

  /**
   * Register a new API configuration
   * @param config The configuration to register
   * @returns The ID of the newly created configuration
   */
  async registerConfig(config: {
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    parameters?: Record<string, any>;
    accountId: number;
    api_version: string;
  }): Promise<number> {
    try {
      // Calculate expiration time (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Create in database
      const newConfig = await this.prisma.apiConfiguration.create({
        data: {
          endpoint: config.endpoint,
          method: config.method,
          headers: config.headers as any,
          parameters: config.parameters || ({} as any),
          accountId: config.accountId,
          api_version: config.api_version,
          status: ApiConfigStatus.ACTIVE,
          is_active: true,
          expiresAt,
          usageCount: 0,
          update_frequency: 60, // 60 minutes
          createdAt: new Date(),
          updated_at: new Date(),
        },
      });

      // Update local cache
      this.refreshConfigCache().catch((err) =>
        this.logger.error('Failed to refresh config cache', err),
      );

      this.logger.log(
        `Registered new API configuration with ID ${newConfig.id}`,
      );

      return newConfig.id;
    } catch (error) {
      this.logger.error('Failed to register API configuration', error);
      throw error;
    }
  }

  /**
   * Get statistics about current API configurations
   */
  async getConfigStats(): Promise<{
    totalConfigs: number;
    activeConfigs: number;
    coolingDownConfigs: number;
    expiredConfigs: number;
    averageUsageCount: number;
    configsPerEndpoint: Record<string, number>;
    errorRateLastHour: number;
  }> {
    try {
      // Get counts by status
      const counts = await this.prisma.apiConfiguration.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      // Calculate stats
      const statusCounts = counts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Get average usage count
      const avgUsage = await this.prisma.apiConfiguration.aggregate({
        _avg: {
          usageCount: true,
        },
      });

      // Get configs per endpoint
      const endpointCounts = await this.prisma.apiConfiguration.groupBy({
        by: ['endpoint'],
        _count: {
          id: true,
        },
      });

      const configsPerEndpoint = endpointCounts.reduce(
        (acc, item) => {
          acc[item.endpoint] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Get error rate in the last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const [totalRequests, errorRequests] = await Promise.all([
        this.prisma.apiConfiguration.count({
          where: {
            lastUsedAt: {
              gte: oneHourAgo,
            },
          },
        }),
        this.prisma.apiErrorRecord.count({
          where: {
            timestamp: {
              gte: oneHourAgo,
            },
          },
        }),
      ]);

      const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;

      return {
        totalConfigs:
          statusCounts[ApiConfigStatus.ACTIVE] +
            statusCounts[ApiConfigStatus.COOLING_DOWN] +
            statusCounts[ApiConfigStatus.EXPIRED] || 0,
        activeConfigs: statusCounts[ApiConfigStatus.ACTIVE] || 0,
        coolingDownConfigs: statusCounts[ApiConfigStatus.COOLING_DOWN] || 0,
        expiredConfigs: statusCounts[ApiConfigStatus.EXPIRED] || 0,
        averageUsageCount: avgUsage._avg.usageCount || 0,
        configsPerEndpoint,
        errorRateLastHour: errorRate,
      };
    } catch (error) {
      this.logger.error('Failed to get config stats', error);

      // Return empty stats on error
      return {
        totalConfigs: 0,
        activeConfigs: 0,
        coolingDownConfigs: 0,
        expiredConfigs: 0,
        averageUsageCount: 0,
        configsPerEndpoint: {},
        errorRateLastHour: 0,
      };
    }
  }

  /**
   * Clean up expired configurations that are older than the specified period
   * @param daysOld Number of days old to consider for cleanup (default: 7)
   */
  async cleanupExpiredConfigs(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Delete expired configs older than cutoff date
      const result = await this.prisma.apiConfiguration.deleteMany({
        where: {
          status: ApiConfigStatus.EXPIRED,
          updated_at: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} expired configurations older than ${daysOld} days`,
      );

      return result.count;
    } catch (error) {
      this.logger.error('Failed to clean up expired configurations', error);
      return 0;
    }
  }
}
