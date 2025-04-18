import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../../tiktok-scraper-types';
import { TikTokApiConfigAdapter } from '../../services/api-config.scraper/tiktok-api-config-adapter';

@Injectable()
export class GetApiConfigStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly apiConfigAdapter: TikTokApiConfigAdapter,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    try {
      const apiConfig = await this.apiConfigAdapter.getCreativeCenterConfig();
      if (!apiConfig) {
        this.logger.error('Failed to get valid API configuration');
        context.state.errors.push(
          new Error('No valid API configuration available'),
        );
        return false;
      }
      context.state.apiConfig = apiConfig;

      this.logger.log(
        `Successfully obtained API configuration (ID: ${apiConfig.id})`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      context.state.errors.push(
        error instanceof Error
          ? error
          : new Error('Unknown error getting API configuration'),
      );
      return false;
    }

    //   const configurations = await prisma.apiConfiguration.findMany({
    //     include: {
    //       errorRecords: true,
    //     },
    //   });
    //   console.log('Найденные конфигурации:', configurations);

    //   if (configurations.length === 0) {
    //     throw new Error('Failed to get valid API configuration');
    //   }

    //   const dbApiConfig = configurations[0];
    //   const parameters =
    //     dbApiConfig.parameters as unknown as ApiConfigParameters;
    //   const apiConfig: TikTokApiConfig = {
    //     url: parameters.url,
    //     method: parameters.method,
    //     headers: parameters.headers,
    //     postData: parameters.postData,
    //     timestamp: parameters.timestamp,
    //   };

    //   context.state.apiConfig = apiConfig;

    //   return true;
    // } catch (error) {
    //   console.error('Ошибка при получении конфигураций API:', error);
    //   throw error;
    // } finally {
    //   await prisma.$disconnect();
    // }
  }

  async shouldExecute(context: TiktokScraperContext): Promise<boolean> {
    return await Promise.resolve(!context.state.apiConfig);
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }

  getName(): string {
    return this.name;
  }
}
