import { Injectable, Logger } from '@nestjs/common';
import { ApiConfigStorageService } from './api-config-storage.service';
import { ApiConfig, ApiConfigStatus } from '../interfaces/api-config.interface';
import { ApiConfigMetricsService } from './api-config-metrics.service';

@Injectable()
export class ApiConfigLifecycleManager {
  private readonly logger = new Logger(ApiConfigLifecycleManager.name);
  private readonly MAX_USAGE_COUNT = 100; // Максимальное количество использований конфигурации

  constructor(
    private readonly storageService: ApiConfigStorageService,
    private readonly metricsService: ApiConfigMetricsService,
  ) {}

  /**
   * Создает новую конфигурацию
   * @param accountId ID аккаунта TikTok
   * @param configData Данные конфигурации
   * @returns ID созданной конфигурации
   */
  async createConfiguration(
    accountId: number,
    configData: any,
  ): Promise<number> {
    try {
      const configId = await this.storageService.saveConfiguration(
        accountId,
        configData,
      );
      this.metricsService.recordCreation(accountId, configId);
      this.logger.log(
        `Created new API configuration with ID: ${configId} for account: ${accountId}`,
      );
      return configId;
    } catch (error) {
      this.logger.error(
        `Failed to create configuration for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Помечает конфигурацию как истекшую
   * @param configId ID конфигурации
   */
  async markAsExpired(configId: number): Promise<void> {
    try {
      // В текущей схеме нет прямого способа пометить конфигурацию как истекшую
      // Вместо этого мы можем обновить сессию, чтобы она не использовала эту конфигурацию
      await this.storageService.deleteConfiguration(configId);
      this.metricsService.recordExpiration(configId);
      this.logger.log(`Marked API configuration ${configId} as expired`);
    } catch (error) {
      this.logger.error(
        `Failed to mark configuration ${configId} as expired: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Помечает конфигурацию как перегретую (использована слишком много раз)
   * @param configId ID конфигурации
   */
  async markAsOverheated(configId: number): Promise<void> {
    try {
      // В текущей схеме нет прямого способа пометить конфигурацию как перегретую
      // Вместо этого мы можем удалить конфигурацию, чтобы создать новую
      await this.storageService.deleteConfiguration(configId);
      this.logger.log(`Marked API configuration ${configId} as overheated`);
    } catch (error) {
      this.logger.error(
        `Failed to mark configuration ${configId} as overheated: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Проверяет, можно ли использовать конфигурацию
   * @param configId ID конфигурации
   * @returns true если конфигурация пригодна к использованию, false в противном случае
   */
  async isConfigurationUsable(configId: number): Promise<boolean> {
    try {
      // Получаем конфигурацию
      const config = await this.getConfigurationById(configId);
      if (!config) {
        return false;
      }

      // Проверяем статус
      if (config.status !== ApiConfigStatus.ACTIVE) {
        return false;
      }

      // Проверяем срок действия
      const now = new Date();
      if (now > config.expiresAt) {
        await this.markAsExpired(configId);
        return false;
      }

      // Проверяем количество использований
      if (config.usageCount >= this.MAX_USAGE_COUNT) {
        await this.markAsOverheated(configId);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to check if configuration ${configId} is usable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Записывает использование конфигурации
   * @param configId ID конфигурации
   */
  async recordUsage(configId: number): Promise<void> {
    try {
      this.metricsService.recordUsage(configId);
      this.logger.log(`Recorded usage of API configuration ${configId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record usage of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Получает конфигурацию по ID
   * @param configId ID конфигурации
   * @returns Конфигурация или null
   */
  private async getConfigurationById(
    configId: number,
  ): Promise<ApiConfig | null> {
    // Этот метод нужно реализовать в ApiConfigStorageService
    // Временно возвращаем null
    return null;
  }
}
