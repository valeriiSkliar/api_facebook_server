import { AuthStepType } from '@src/scrapers/common/interfaces';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../tiktok-scraper-types';
// steps/InitializationStep.ts
export class InitializationStep extends TiktokScraperStep {
  private readonly stepType: AuthStepType;

  getType(): AuthStepType {
    return this.stepType;
  }

  /**
   * Execute the initialization step
   * @param context TikTok scraper context
   * @returns Promise resolving to true if initialization was successful
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(context: TiktokScraperContext): Promise<boolean> {
    return await Promise.resolve(true);
  }

  /**
   * Clean up resources used by this step
   * @param context TikTok scraper context
   */
  async cleanup(): Promise<void> {
    this.logger.log(
      '[TiktokInitializationStep.cleanup] Skipping cleanup for externally managed resources',
    );

    return Promise.resolve();
  }
}
