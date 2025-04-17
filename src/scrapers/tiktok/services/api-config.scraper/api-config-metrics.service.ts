import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import {
  ApiConfigMetrics,
  AccountApiConfigMetrics,
  ApiConfigStatus,
} from '../../../../modules/api-config/interfaces/api-config.interface';

@Injectable()
export class ApiConfigMetricsService {
  private readonly logger = new Logger(ApiConfigMetricsService.name);
  private metricsCache: Map<number, number> = new Map(); // configId -> usageCount
  private accountMetricsCache: Map<number, number> = new Map(); // accountId -> configCount
  private configStatusCache: Map<number, ApiConfigStatus> = new Map(); // configId -> status
  private accountConfigsCache: Map<number, Set<number>> = new Map(); // accountId -> Set<configId>

  constructor(private readonly prisma: PrismaService) {
    // Инициализация кэша при запуске сервиса
    this.initializeCache();
  }

  /**
   * Инициализирует кэш метрик из базы данных
   */
  private async initializeCache(): Promise<void> {
    try {
      // Получаем все конфигурации из базы данных
      const configs = await this.prisma.apiConfig.findMany();

      // Заполняем кэши
      for (const config of configs) {
        // Кэш использований
        this.metricsCache.set(config.id, config.usageCount);

        // Кэш статусов
        this.configStatusCache.set(config.id, config.status as ApiConfigStatus);

        // Кэш аккаунтов
        if (!this.accountConfigsCache.has(config.accountId)) {
          this.accountConfigsCache.set(config.accountId, new Set());
        }
        this.accountConfigsCache.get(config.accountId)?.add(config.id);

        // Кэш количества конфигураций для аккаунта
        const currentCount =
          this.accountMetricsCache.get(config.accountId) || 0;
        this.accountMetricsCache.set(config.accountId, currentCount + 1);
      }

      this.logger.log(
        `Metrics cache initialized with ${configs.length} configurations`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize metrics cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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

      // Устанавливаем статус ACTIVE для новой конфигурации
      this.configStatusCache.set(configId, ApiConfigStatus.ACTIVE);

      // Добавляем конфигурацию в список конфигураций аккаунта
      if (!this.accountConfigsCache.has(accountId)) {
        this.accountConfigsCache.set(accountId, new Set());
      }
      this.accountConfigsCache.get(accountId)?.add(configId);

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
   * Записывает изменение статуса конфигурации
   * @param configId ID конфигурации
   * @param status Новый статус
   */
  recordStatusChange(configId: number, status: ApiConfigStatus): void {
    try {
      // Обновляем статус в кэше
      this.configStatusCache.set(configId, status);

      this.logger.log(
        `Recorded status change of API configuration ${configId} to ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record status change of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Записывает истечение срока действия конфигурации
   * @param configId ID конфигурации
   */
  recordExpiration(configId: number): void {
    try {
      // Обновляем статус в кэше
      this.configStatusCache.set(configId, ApiConfigStatus.EXPIRED);

      this.logger.log(`Recorded expiration of API configuration ${configId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record expiration of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Записывает удаление конфигурации
   * @param configId ID конфигурации
   */
  recordDeletion(configId: number): void {
    try {
      // Находим аккаунт, которому принадлежит конфигурация
      let accountId: number | null = null;
      for (const [accId, configIds] of this.accountConfigsCache.entries()) {
        if (configIds.has(configId)) {
          accountId = accId;
          break;
        }
      }

      // Удаляем конфигурацию из кэшей
      this.metricsCache.delete(configId);
      this.configStatusCache.delete(configId);

      // Если нашли аккаунт, обновляем его кэши
      if (accountId !== null) {
        // Удаляем конфигурацию из списка конфигураций аккаунта
        this.accountConfigsCache.get(accountId)?.delete(configId);

        // Уменьшаем счетчик конфигураций для аккаунта
        const currentCount = this.accountMetricsCache.get(accountId) || 0;
        if (currentCount > 0) {
          this.accountMetricsCache.set(accountId, currentCount - 1);
        }
      }

      this.logger.log(`Recorded deletion of API configuration ${configId}`);
    } catch (error) {
      this.logger.error(
        `Failed to record deletion of configuration ${configId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Получает статистику использования конфигураций
   * @returns Статистика использования
   */
  getUsageStatistics(): ApiConfigMetrics {
    try {
      // Подсчитываем статистику по статусам
      let activeConfigs = 0;
      let expiredConfigs = 0;
      let coolingDownConfigs = 0;

      for (const status of this.configStatusCache.values()) {
        if (status === ApiConfigStatus.ACTIVE) {
          activeConfigs++;
        } else if (status === ApiConfigStatus.EXPIRED) {
          expiredConfigs++;
        } else if (status === ApiConfigStatus.COOLING_DOWN) {
          coolingDownConfigs++;
        }
      }

      // Подсчитываем общую статистику
      const totalConfigs = this.metricsCache.size;
      const totalUsageCount = Array.from(this.metricsCache.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      const averageUsageCount =
        totalConfigs > 0 ? totalUsageCount / totalConfigs : 0;

      return {
        totalConfigs,
        activeConfigs,
        expiredConfigs,
        coolingDownConfigs,
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
      // Получаем список конфигураций для аккаунта
      const configIds = this.accountConfigsCache.get(accountId) || new Set();

      // Подсчитываем статистику по статусам
      let activeConfigs = 0;
      let expiredConfigs = 0;
      let coolingDownConfigs = 0;
      let totalUsageCount = 0;

      for (const configId of configIds) {
        // Подсчитываем статусы
        const status = this.configStatusCache.get(configId);
        if (status === ApiConfigStatus.ACTIVE) {
          activeConfigs++;
        } else if (status === ApiConfigStatus.EXPIRED) {
          expiredConfigs++;
        } else if (status === ApiConfigStatus.COOLING_DOWN) {
          coolingDownConfigs++;
        }

        // Подсчитываем использования
        totalUsageCount += this.metricsCache.get(configId) || 0;
      }

      const totalConfigs = configIds.size;
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
