import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import {
  ApiConfig,
  ApiConfigData,
  ApiConfigStatus,
} from '../../../../modules/api-config/interfaces/api-config.interface';

@Injectable()
export class ApiConfigStorageService {
  private readonly logger = new Logger(ApiConfigStorageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Сохраняет новую API-конфигурацию в базу данных
   * @param accountId ID аккаунта TikTok
   * @param data Данные API-конфигурации
   * @returns ID созданной конфигурации
   */
  async saveConfiguration(
    accountId: number,
    data: ApiConfigData,
  ): Promise<number> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Конфигурация действительна 24 часа

      const config = await this.prisma.apiConfig.create({
        data: {
          accountId,
          endpoint: data.endpoint,
          method: data.method,
          headers: data.headers,
          params: data.params || {},
          status: ApiConfigStatus.ACTIVE,
          usageCount: 0,
          expiresAt,
          responseData: data.responseData || null,
        },
      });

      this.logger.log(
        `Saved new API configuration with ID: ${config.id} for account: ${accountId}`,
      );
      return config.id;
    } catch (error) {
      this.logger.error(
        `Failed to save configuration for account ${accountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
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
      const config = await this.prisma.apiConfig.findFirst({
        where: {
          accountId,
          status: ApiConfigStatus.ACTIVE,
          expiresAt: {
            gt: new Date(), // Не истекла
          },
        },
        orderBy: {
          usageCount: 'asc', // Сначала наименее используемые
        },
      });

      return config as ApiConfig | null;
    } catch (error) {
      this.logger.error(
        `Failed to get active configuration for account ${accountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Получает конфигурацию по ID
   * @param configId ID конфигурации
   * @returns Конфигурация или null
   */
  async getConfigurationById(configId: number): Promise<ApiConfig | null> {
    try {
      const config = await this.prisma.apiConfig.findUnique({
        where: {
          id: configId,
        },
      });

      return config as ApiConfig | null;
    } catch (error) {
      this.logger.error(
        `Failed to get configuration with ID ${configId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Обновляет статус конфигурации
   * @param configId ID конфигурации
   * @param status Новый статус
   * @returns true если обновление успешно, false в противном случае
   */
  async updateConfigurationStatus(
    configId: number,
    status: ApiConfigStatus,
  ): Promise<boolean> {
    try {
      await this.prisma.apiConfig.update({
        where: {
          id: configId,
        },
        data: {
          status,
        },
      });

      this.logger.log(`Updated configuration ${configId} status to ${status}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update configuration ${configId} status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /**
   * Увеличивает счетчик использований конфигурации
   * @param configId ID конфигурации
   * @returns Обновленное количество использований или -1 в случае ошибки
   */
  async incrementUsageCount(configId: number): Promise<number> {
    try {
      const config = await this.prisma.apiConfig.update({
        where: {
          id: configId,
        },
        data: {
          usageCount: {
            increment: 1,
          },
          lastUsedAt: new Date(),
        },
      });

      return config.usageCount;
    } catch (error) {
      this.logger.error(
        `Failed to increment usage count for configuration ${configId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return -1;
    }
  }

  /**
   * Получает все истекшие конфигурации
   * @returns Массив истекших конфигураций
   */
  async getExpiredConfigurations(): Promise<ApiConfig[]> {
    try {
      const now = new Date();
      const configs = await this.prisma.apiConfig.findMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: now, // Истекшие по времени
              },
            },
            {
              status: ApiConfigStatus.EXPIRED,
            },
          ],
        },
      });

      return configs as ApiConfig[];
    } catch (error) {
      this.logger.error(
        `Failed to get expired configurations: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  /**
   * Получает конфигурации в состоянии охлаждения, которые готовы к активации
   * @returns Массив конфигураций
   */
  async getCoolingDownConfigurations(): Promise<ApiConfig[]> {
    try {
      const threeHoursAgo = new Date();
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

      const configs = await this.prisma.apiConfig.findMany({
        where: {
          status: ApiConfigStatus.COOLING_DOWN,
          lastUsedAt: {
            lt: threeHoursAgo, // В охлаждении более 3 часов
          },
          expiresAt: {
            gt: new Date(), // Не истекли
          },
        },
      });

      return configs as ApiConfig[];
    } catch (error) {
      this.logger.error(
        `Failed to get cooling down configurations: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  /**
   * Удаляет конфигурацию из базы данных
   * @param configId ID конфигурации
   * @returns true если удаление успешно, false в противном случае
   */
  async deleteConfiguration(configId: number): Promise<boolean> {
    try {
      await this.prisma.apiConfig.delete({
        where: {
          id: configId,
        },
      });

      this.logger.log(`Deleted API configuration with ID: ${configId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete configuration ${configId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
