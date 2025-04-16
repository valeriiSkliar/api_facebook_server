import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@src/database/prisma.service';
import { ApiConfigProcessor } from './api-config-processor.service';
import { ApiConfigLifecycleManager } from './api-config-lifecycle-manager.service';
import { ApiConfigStorageService } from './api-config-storage.service';

@Injectable()
export class ApiConfigurationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ApiConfigurationSchedulerService.name);
  private processingAccounts: Set<number> = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: ApiConfigProcessor,
    private readonly lifecycleManager: ApiConfigLifecycleManager,
    private readonly storageService: ApiConfigStorageService,
  ) {}

  onModuleInit() {
    this.logger.log('ApiConfigurationSchedulerService initialized');
  }

  /**
   * Запускается каждые 30 минут для обработки аккаунтов
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async processAccountsForApiConfig() {
    this.logger.log('Starting scheduled API configuration processing');

    try {
      // Получаем активные аккаунты TikTok с валидными сессиями
      const accounts = await this.prisma.tikTokAccount.findMany({
        where: {
          is_active: true,
          email_account: {
            sessions: {
              some: {
                is_valid: true,
              },
            },
          },
        },
        include: {
          email_account: {
            include: {
              sessions: {
                where: {
                  is_valid: true,
                },
                take: 1,
              },
            },
          },
        },
      });

      this.logger.log(
        `Found ${accounts.length} active TikTok accounts with valid sessions`,
      );

      // Обрабатываем каждый аккаунт
      for (const account of accounts) {
        // Пропускаем аккаунты, которые уже обрабатываются
        if (this.processingAccounts.has(account.id)) {
          this.logger.log(
            `Account ${account.id} is already being processed, skipping`,
          );
          continue;
        }

        // Получаем сессию аккаунта
        const session = account.email_account.sessions[0];
        if (!session) {
          this.logger.warn(
            `No valid session found for account ${account.id}, skipping`,
          );
          continue;
        }

        // Добавляем аккаунт в список обрабатываемых
        this.processingAccounts.add(account.id);

        // Обрабатываем аккаунт асинхронно
        this.processAccountAsync(account.id, session).finally(() => {
          // Удаляем аккаунт из списка обрабатываемых
          this.processingAccounts.delete(account.id);
        });
      }
    } catch (error) {
      this.logger.error(
        `Error in processAccountsForApiConfig: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Асинхронно обрабатывает аккаунт
   * @param accountId ID аккаунта TikTok
   * @param session Данные сессии
   */
  private async processAccountAsync(
    accountId: number,
    session: any,
  ): Promise<void> {
    try {
      this.logger.log(`Processing account ${accountId} for API configuration`);
      await this.processor.processAccount(accountId, session);
    } catch (error) {
      this.logger.error(
        `Error processing account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Запускается каждый час для пометки истекших конфигураций
   */
  @Cron(CronExpression.EVERY_HOUR)
  async markExpiredConfigurations() {
    this.logger.log('Starting scheduled marking of expired configurations');

    try {
      // Получаем истекшие конфигурации
      const expiredConfigs =
        await this.storageService.getExpiredConfigurations();
      this.logger.log(`Found ${expiredConfigs.length} expired configurations`);

      // Помечаем каждую конфигурацию как истекшую
      for (const config of expiredConfigs) {
        await this.lifecycleManager.markAsExpired(config.id);
      }
    } catch (error) {
      this.logger.error(
        `Error in markExpiredConfigurations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Запускается каждые 3 часа для активации конфигураций после периода охлаждения
   */
  @Cron(CronExpression.EVERY_3_HOURS)
  async activateCooledDownConfigurations() {
    this.logger.log(
      'Starting scheduled activation of cooled down configurations',
    );

    try {
      // Активируем конфигурации, которые закончили период охлаждения
      await this.lifecycleManager.activateCooledDownConfigurations();
    } catch (error) {
      this.logger.error(
        `Error in activateCooledDownConfigurations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Запускается каждый день в 2:00 для очистки истекших конфигураций
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredConfigurations() {
    this.logger.log('Starting scheduled cleanup of expired configurations');

    try {
      // Получаем истекшие конфигурации
      const expiredConfigs =
        await this.storageService.getExpiredConfigurations();
      this.logger.log(
        `Found ${expiredConfigs.length} expired configurations to clean up`,
      );

      // Удаляем каждую конфигурацию
      for (const config of expiredConfigs) {
        await this.storageService.deleteConfiguration(config.id);
      }
    } catch (error) {
      this.logger.error(
        `Error in cleanupExpiredConfigurations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
