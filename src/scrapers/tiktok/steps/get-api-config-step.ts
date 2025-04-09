import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';
import { TikTokApiConfig } from '../models/api-config';
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
    const apiConfig: TikTokApiConfig = {
      url: parameters.url,
      method: parameters.method,
      headers: parameters.headers,
      postData: parameters.postData,
      timestamp: parameters.timestamp,
    };

    context.state.apiConfig = apiConfig;

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
