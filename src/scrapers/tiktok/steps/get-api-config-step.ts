/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { ApiConfiguration } from '@src/scrapers/tiktok/models/tiktok-scraper-context';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';
interface ApiConfigParameters {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
}

@Injectable()
export class GetApiConfigStep extends TiktokScraperStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    const dbApiConfig = await this.prisma.apiConfiguration.findFirst({
      where: {
        is_active: true,
      },
    });

    if (!dbApiConfig) {
      throw new Error('Failed to get valid API configuration');
    }

    const parameters = dbApiConfig.parameters as unknown as ApiConfigParameters;
    this.logger.log('parameters', parameters);
    const apiConfig: ApiConfiguration = {
      accessToken: parameters.headers?.['Authorization'] || '',
      apiEndpoint: parameters.url || '',
    };

    this.logger.log(`API Config: ${JSON.stringify(apiConfig)}`);
    context.state.apiConfig = apiConfig;
    this.logger.log(`${this.name} completed successfully`, {
      context,
    });

    return true;
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
