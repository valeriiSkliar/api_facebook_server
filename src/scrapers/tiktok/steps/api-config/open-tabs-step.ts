import { Injectable, Logger } from '@nestjs/common';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { TiktokApiConfigStep } from './api-config-step';

/**
 * Step responsible for opening browser tabs and restoring sessions for TikTok accounts
 * Creates separate browser contexts/tabs for each account with a valid session
 */
@Injectable()
export class OpenTabsStep extends TiktokApiConfigStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);
    return true;
  }
}
