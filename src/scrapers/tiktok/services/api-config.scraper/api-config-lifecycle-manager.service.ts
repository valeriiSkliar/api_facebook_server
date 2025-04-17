import { Injectable, Logger } from '@nestjs/common';
import { ApiConfigStorageService } from './api-config-storage.service';
import {
  ApiConfig,
  ApiConfigStatus,
} from '../../../../modules/api-config/interfaces/api-config.interface';
import { ApiConfigMetricsService } from './api-config-metrics.service';

@Injectable()
export class ApiConfigLifecycleManager {
  private readonly logger = new Logger(ApiConfigLifecycleManager.name);
  private readonly MAX_USAGE_COUNT = 100; // Максимальное количество использований конфигурации
  private readonly COOLING_DOWN_HOURS = 3; // Количество часов для охлаждения

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
      await this.storageService.updateConfigurationStatus(
        configId,
        ApiConfigStatus.EXPIRED,
      );
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
  async markAsCoolingDown(configId: number): Promise<void> {
    try {
      await this.storageService.updateConfigurationStatus(
        configId,
        ApiConfigStatus.COOLING_DOWN,
      );
      this.logger.log(`Marked API configuration ${configId} as cooling down`);
    } catch (error) {
      this.logger.error(
        `Failed to mark configuration ${configId} as cooling down: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Активирует конфигурацию после периода охлаждения
   * @param configId ID конфигурации
   */
  async activateAfterCoolingDown(configId: number): Promise<void> {
    try {
      await this.storageService.updateConfigurationStatus(
        configId,
        ApiConfigStatus.ACTIVE,
      );
      this.logger.log(
        `Activated API configuration ${configId} after cooling down`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to activate configuration ${configId} after cooling down: ${error instanceof Error ? error.message : String(error)}`,
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
      const config = await this.storageService.getConfigurationById(configId);
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
        await this.markAsCoolingDown(configId);
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
      // Увеличиваем счетчик использований
      const usageCount =
        await this.storageService.incrementUsageCount(configId);

      // Записываем использование в метрики
      this.metricsService.recordUsage(configId);

      // Проверяем, не превышен ли лимит использований
      if (usageCount >= this.MAX_USAGE_COUNT) {
        await this.markAsCoolingDown(configId);
      }

      this.logger.log(
        `Recorded usage of API configuration ${configId}, current count: ${usageCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record usage of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Получает активную конфигурацию для аккаунта
   * @param accountId ID аккаунта TikTok
   * @returns Активная конфигурация или null
   */
  async getActiveConfigurationForAccount(
    accountId: number,
  ): Promise<ApiConfig | null> {
    try {
      return await this.storageService.getActiveConfigurationForAccount(
        accountId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get active configuration for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Активирует конфигурации, которые закончили период охлаждения
   */
  async activateCooledDownConfigurations(): Promise<void> {
    try {
      const coolingDownConfigs =
        await this.storageService.getCoolingDownConfigurations();
      this.logger.log(
        `Found ${coolingDownConfigs.length} configurations ready to be activated`,
      );

      for (const config of coolingDownConfigs) {
        await this.activateAfterCoolingDown(config.id);
      }
    } catch (error) {
      this.logger.error(
        `Failed to activate cooled down configurations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Получает конфигурацию по ID
   * @param configId ID конфигурации
   * @returns Конфигурация или null
   */
  async getConfigurationById(configId: number): Promise<ApiConfig | null> {
    return this.storageService.getConfigurationById(configId);
  }
}
