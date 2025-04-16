import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { ApiConfig, ApiConfigData } from '../interfaces/api-config.interface';

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
  ): Promise<number> {}

  /**
   * Получает активную конфигурацию для аккаунта
   * @param accountId ID аккаунта TikTok
   * @returns Активная конфигурация или null
   */
  async getActiveConfigurationForAccount(
    accountId: number,
  ): Promise<ApiConfig | null> {}

  /**
   * Получает все истекшие конфигурации
   * @returns Массив истекших конфигураций
   */
  async getExpiredConfigurations(): Promise<ApiConfig[]> {}

  /**
   * Удаляет конфигурацию из базы данных
   * @param configId ID конфигурации
   * @returns true если удаление успешно, false в противном случае
   */
  async deleteConfiguration(configId: number): Promise<boolean> {}
}
