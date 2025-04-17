/* eslint-disable @typescript-eslint/require-await */
import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { AbstractGenericScraperStep } from '@src/scrapers/common/interfaces/abstract-generic-scraper-step';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';

export abstract class TiktokApiConfigStep extends AbstractGenericScraperStep<TiktokApiConfigContext> {
  // Base class for all TikTok API Config steps
  constructor(name: string, logger: Logger) {
    super(name, logger);
  }
}

/**
 * Step to capture and store API configurations from TikTok's network requests.
 * Intercepts network requests on the open tabs and extracts API configurations.
 */
export class ApiConfigCollectionStep extends TiktokApiConfigStep {
  constructor(
    name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    super(name, logger);
  }

  override shouldExecute(context: TiktokApiConfigContext): boolean {
    return (
      Array.isArray(context.state.browserContexts) &&
      context.state.browserContexts.length > 0
    );
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    this.logger.log(
      `[${this.getName()}] Executing API config collection for ${context.state.browserContexts?.length} tabs`,
    );

    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cleanup(context: TiktokApiConfigContext): Promise<void> {
    // Cleanup is handled by the OpenTabsStep
    this.logger.log(
      `[${this.getName()}] Cleaning up API config collection step`,
    );
  }
}
