import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@src/database/prisma.service';
import {
  TiktokApiConfigOptions,
  TiktokApiConfigQuery,
} from '../../pipelines/api-config/tiktok-api-config-types';
import { TikTokApiConfigScraperFactory } from '../../factories/tiktok-api-config.scraper.factory';
import { ApiConfigStatus } from '@src/modules/api-config/interfaces/api-config.interface';

@Injectable()
export class ApiConfigurationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ApiConfigurationSchedulerService.name);
  private processingAccounts: Set<number> = new Set();
  private isProcessing = false;
  private isDeletingExpired = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiConfigScraperFactory: TikTokApiConfigScraperFactory,
  ) {}

  onModuleInit() {
    this.logger.log('ApiConfigurationSchedulerService initialized');
  }

  /**
   * Запускается каждые 30 минут для обработки аккаунтов
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAccountsForApiConfig() {
    this.logger.log(
      'Starting scheduled processing of accounts for API configuration',
    );

    // Prevent concurrent execution of the same job
    if (this.isProcessing) {
      this.logger.log(
        'Previous job is still running. Skipping this execution.',
      );
      return;
    }

    this.isProcessing = true;

    try {
      await this.processAccountsApiConfig();
    } catch (error) {
      this.logger.error(
        'Error during scheduled processing of accounts for API configuration',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isProcessing = false;
    }
  }

  // /**
  //  * Gets the list of accounts that require API configuration updates
  //  */
  // private async getAccountsForConfigUpdate(): Promise<{ id: number }[]> {
  //   // Get the list of active accounts that:
  //   // 1. Are not currently being processed
  //   // 2. Do not have an active configuration or the last active configuration has expired
  //   const now = new Date();

  //   const accounts = await this.prisma.tikTokAccount.findMany({
  //     where: {
  //       isActive: true,
  //       id: {
  //         notIn: Array.from(this.processingAccounts),
  //       },
  //       OR: [
  //         // No configurations
  //         {
  //           apiConfigs: {
  //             none: {},
  //           },
  //         },
  //         // No active configurations, or the last active configuration will expire soon
  //         {
  //           apiConfigs: {
  //             every: {
  //               OR: [
  //                 { status: { not: ApiConfigStatus.ACTIVE } },
  //                 {
  //                   status: ApiConfigStatus.ACTIVE,
  //                   expiresAt: {
  //                     lte: new Date(now.getTime() + 60 * 60 * 1000),
  //                   }, // Expires within an hour
  //                 },
  //               ],
  //             },
  //           },
  //         },
  //       ],
  //     },
  //     select: {
  //       id: true,
  //     },
  //     take: 5, // Process no more than 5 accounts at a time
  //   });

  //   return accounts;
  // }

  /**
   * Processes one account to fetch API configuration
   */
  private async processAccountsApiConfig(): Promise<void> {
    try {
      // Create a query for the pipeline
      const query: TiktokApiConfigQuery = {
        queryString: '',
      };

      // Create options for the pipeline
      const options: Partial<TiktokApiConfigOptions> = {
        forceRefresh: false,
      };

      // Create context
      const context = this.apiConfigScraperFactory.createContext(
        query,
        options,
      );

      // Create scraper
      const pipeline = this.apiConfigScraperFactory.createScraper(options);

      // Execute scraper
      await pipeline.execute(context);
    } catch (error) {
      this.logger.error(
        `Error processing API config`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Handles the result of the pipeline execution
   */
  // private handlePipelineResult(
  //   accountId: number,
  //   result: TiktokApiConfigResult,
  // ): void {
  //   if (result.success) {
  //     const configCount = result.configs?.length || 0;
  //     this.logger.log(
  //       `Successfully processed account ${accountId}. Retrieved ${configCount} API configurations.`,
  //     );
  //   } else {
  //     this.logger.warn(
  //       `Failed to process account ${accountId}. Errors: ${result.errors?.map((e) => e.message).join(', ')}`,
  //     );
  //   }
  // }

  /**
   * Marks expired configurations and deletes them after one hour
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async markAndDeleteExpiredConfigurations(): Promise<void> {
    this.logger.log(
      'Starting scheduled marking and deletion of expired configurations',
    );

    // Prevent concurrent execution
    if (this.isDeletingExpired) {
      this.logger.log(
        'Previous expiration job is still running. Skipping this execution.',
      );
      return;
    }

    this.isDeletingExpired = true;

    try {
      // Step 1: Mark configurations as expired if they're older than 1 hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Mark configs as expired after 1 hour
      const markResult = await this.prisma.$executeRaw`
        UPDATE "ApiConfig"
        SET "status" = ${ApiConfigStatus.EXPIRED}
        WHERE "status" = ${ApiConfigStatus.ACTIVE} 
        AND "createdAt" < ${oneHourAgo}
      `;

      this.logger.log(
        `Marked ${markResult} configurations as expired (older than 1 hour)`,
      );

      // Step 2: Delete all expired configurations
      const deleteResult = await this.prisma.$executeRaw`
        DELETE FROM "ApiConfig"
        WHERE "status" = ${ApiConfigStatus.EXPIRED}
      `;

      this.logger.log(`Deleted ${deleteResult} expired API configurations`);
    } catch (error) {
      this.logger.error(
        'Error during marking and deletion of expired configurations',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isDeletingExpired = false;
    }
  }

  // /**
  //  * Activates cooled down configurations
  //  */
  // @Cron(CronExpression.EVERY_3_HOURS)
  // async activateCooledDownConfigurations() {
  //   this.logger.log(
  //     'Starting scheduled activation of cooled down configurations',
  //   );

  //   try {
  //     // Find and activate configurations that were in COOLING_DOWN state
  //     // for at least 24 hours (cooling period)
  //     const cooldownPeriod = new Date();
  //     cooldownPeriod.setHours(cooldownPeriod.getHours() - 24);

  //     const result = await this.prisma.apiConfig.updateMany({
  //       where: {
  //         status: ApiConfigStatus.COOLING_DOWN,
  //         lastUsedAt: { lt: cooldownPeriod },
  //       },
  //       data: {
  //         status: ApiConfigStatus.ACTIVE,
  //       },
  //     });

  //     this.logger.log(
  //       `Activated ${result.count} cooled down API configurations`,
  //     );
  //   } catch (error) {
  //     this.logger.error(
  //       'Error during activation of cooled down configurations',
  //       error instanceof Error ? error.stack : String(error),
  //     );
  //   }
  // }

  // /**
  //  * Runs daily at 2:00 to clean up expired configurations
  //  */
  // @Cron(CronExpression.EVERY_DAY_AT_2AM)
  // async cleanupExpiredConfigurations() {
  //   this.logger.log('Starting scheduled cleanup of expired configurations');

  //   try {
  //     // Find and delete configurations that were in EXPIRED state
  //     // for more than 7 days
  //     const expirationCutoff = new Date();
  //     expirationCutoff.setDate(expirationCutoff.getDate() - 7);

  //     const result = await this.prisma.apiConfig.deleteMany({
  //       where: {
  //         status: ApiConfigStatus.EXPIRED,
  //         expiresAt: { lt: expirationCutoff },
  //       },
  //     });

  //     this.logger.log(`Deleted ${result.count} old expired API configurations`);
  //   } catch (error) {
  //     this.logger.error(
  //       'Error during cleanup of expired configurations',
  //       error instanceof Error ? error.stack : String(error),
  //     );
  //   }
  // }
}
