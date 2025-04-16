import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import {
  ApiConfigMetrics,
  AccountApiConfigMetrics,
} from '../interfaces/api-config.interface';

@Injectable()
export class ApiConfigMetricsService {
  private readonly logger = new Logger(ApiConfigMetricsService.name);
  private metricsCache: Map<number, number> = new Map(); // configId -> usageCount
  private accountMetricsCache: Map<number, number> = new Map(); // accountId -> configCount

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записывает создание конфигурации
   * @param accountId ID аккаунта TikTok
   * @param configId ID конфигурации
   */
  recordCreation(accountId: number, configId: number): void {
    try {
      // Обновляем кэш метрик аккаунта
      const currentCount = this.accountMetricsCache.get(accountId) || 0;
      this.accountMetricsCache.set(accountId, currentCount + 1);

      // Инициализируем счетчик использований для новой конфигурации
      this.metricsCache.set(configId, 0);

      this.logger.log(
        `Recorded creation of API configuration ${configId} for account ${accountId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record creation of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Записывает использование конфигурации
   * @param configId ID конфигурации
   */
  recordUsage(configId: number): void {
    try {
      // Увеличиваем счетчик использований
      const currentCount = this.metricsCache.get(configId) || 0;
      this.metricsCache.set(configId, currentCount + 1);

      this.logger.log(`Recorded usage of API configuration ${configId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record usage of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Записывает истечение срока действия конфигурации
   * @param configId ID конфигурации
   */
  recordExpiration(configId: number): void {
    try {
      // Удаляем конфигурацию из кэша
      this.metricsCache.delete(configId);

      this.logger.log(`Recorded expiration of API configuration ${configId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record expiration of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Получает статистику использования конфигураций
   * @returns Статистика использования
   */
  getUsageStatistics(): ApiConfigMetrics {
    try {
      // Получаем все конфигурации из базы данных
      const configs = this.metricsCache;

      // Подсчитываем статистику
      const totalConfigs = configs.size;
      const totalUsageCount = Array.from(configs.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      const averageUsageCount =
        totalConfigs > 0 ? totalUsageCount / totalConfigs : 0;

      return {
        totalConfigs,
        activeConfigs: totalConfigs, // В текущей реализации все конфигурации активны
        expiredConfigs: 0, // В текущей реализации нет истекших конфигураций
        coolingDownConfigs: 0, // В текущей реализации нет перегретых конфигураций
        averageUsageCount,
        totalUsageCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get usage statistics: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        totalConfigs: 0,
        activeConfigs: 0,
        expiredConfigs: 0,
        coolingDownConfigs: 0,
        averageUsageCount: 0,
        totalUsageCount: 0,
      };
    }
  }

  /**
   * Получает статистику использования конфигураций для аккаунта
   * @param accountId ID аккаунта TikTok
   * @returns Статистика использования для аккаунта
   */
  getAccountStatistics(accountId: number): AccountApiConfigMetrics {
    try {
      // Получаем количество конфигураций для аккаунта
      const totalConfigs = this.accountMetricsCache.get(accountId) || 0;

      // В текущей реализации все конфигурации активны
      const activeConfigs = totalConfigs;
      const expiredConfigs = 0;
      const coolingDownConfigs = 0;

      // Подсчитываем общее количество использований
      const totalUsageCount = 0; // В текущей реализации нет данных о количестве использований
      const averageUsageCount =
        totalConfigs > 0 ? totalUsageCount / totalConfigs : 0;

      return {
        accountId,
        totalConfigs,
        activeConfigs,
        expiredConfigs,
        coolingDownConfigs,
        averageUsageCount,
        totalUsageCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get account statistics for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        accountId,
        totalConfigs: 0,
        activeConfigs: 0,
        expiredConfigs: 0,
        coolingDownConfigs: 0,
        averageUsageCount: 0,
        totalUsageCount: 0,
      };
    }
  }
}
