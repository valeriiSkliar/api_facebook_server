import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';
import { TiktokApiConfigStep } from './api-config-step';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CleanupStep extends TiktokApiConfigStep {
  constructor(name: string, logger: any) {
    super(name, logger);
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    try {
      this.logger.log('Starting cleanup step');

      if (context.state.browserContexts?.length) {
        for (const browserContext of context.state.browserContexts) {
          if (browserContext.page) {
            await browserContext.page.close();
          }
          if (browserContext.page?.context()) {
            await browserContext.page.context().close();
          }
        }
        context.state.browserContexts = [];
        this.logger.log('Browser contexts and pages closed successfully');
      }

      return true;
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      return false;
    }
  }
}
