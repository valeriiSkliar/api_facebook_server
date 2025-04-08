import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import {
  AbstractScraperStep,
  AuthStepType,
} from '@src/scrapers/common/interfaces';

// steps/InitializationStep.ts
export class InitializationStep extends AbstractScraperStep {
  private readonly stepType: AuthStepType;

  getType(): AuthStepType {
    return this.stepType;
  }

  async execute(context: ScraperContext): Promise<boolean> {
    return await Promise.resolve(true);
  }

  async cleanup(): Promise<void> {
    this.logger.log(
      '[TiktokInitializationStep.cleanup] Skipping cleanup for externally managed resources',
    );

    return Promise.resolve();
  }
}
