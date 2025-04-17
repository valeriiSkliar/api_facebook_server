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
    // private readonly processor: ApiConfigProcessor,
    // private readonly lifecycleManager: ApiConfigLifecycleManager,
    // private readonly storageService: ApiConfigStorageService,
  ) {}

  onModuleInit() {
    this.logger.log('ApiConfigurationSchedulerService initialized');
  }

  /**
   * Запускается каждые 30 минут для обработки аккаунтов
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async processAccountsForApiConfig() {}

  /**
   * Асинхронно обрабатывает аккаунт
   * @param accountId ID аккаунта TikTok
   * @param session Данные сессии
   */
  private async processAccountAsync(
    accountId: number,
    session: any,
  ): Promise<void> {}

  /**
   * Запускается каждый час для пометки истекших конфигураций
   */
  @Cron(CronExpression.EVERY_HOUR)
  async markExpiredConfigurations() {
    this.logger.log('Starting scheduled marking of expired configurations');
  }

  /**
   * Запускается каждые 3 часа для активации конфигураций после периода охлаждения
   */
  @Cron(CronExpression.EVERY_3_HOURS)
  async activateCooledDownConfigurations() {
    this.logger.log(
      'Starting scheduled activation of cooled down configurations',
    );
  }

  /**
   * Запускается каждый день в 2:00 для очистки истекших конфигураций
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredConfigurations() {
    this.logger.log('Starting scheduled cleanup of expired configurations');
  }
}
