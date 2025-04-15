import { Injectable, Logger } from '@nestjs/common';
import { FacebookScraperStep } from './facebook-scraper-step';
import { FacebookScraperContext } from '../facebook-scraper-types';
import { FacebookCreativeService } from '../services';

@Injectable()
export class StorageFacebookCreativesStep extends FacebookScraperStep {
  constructor(
    name: string,
    protected readonly logger: Logger,
    private readonly creativeService: FacebookCreativeService,
  ) {
    super(name, logger);
  }

  async execute(context: FacebookScraperContext): Promise<boolean> {
    const { state } = context;
    const { adsCollected } = state;

    if (!adsCollected || adsCollected.length === 0) {
      this.logger.log(
        '[StoreFacebookCreativesStep] No Facebook creatives collected to save.',
      );
      return true; // Nothing to save, step succeeded
    }

    try {
      this.logger.log(
        `[StoreFacebookCreativesStep] Saving ${adsCollected.length} Facebook creatives to database.`,
      );
      await this.creativeService.saveCreatives(adsCollected);

      this.logger.log(
        `[StoreFacebookCreativesStep] Successfully saved Facebook creatives to database.`,
      );
      return true; // Save operation succeeded
    } catch (error) {
      // Type assertion for error handling
      const stepError = error as Error;
      this.logger.error(
        `[StoreFacebookCreativesStep] Failed to execute SaveFacebookCreativesStep: ${stepError.message}`,
        stepError.stack,
      );
      return false; // Indicate step failure
    }
  }

  async shouldExecute(context: FacebookScraperContext): Promise<boolean> {
    // Execute this step if we have ads collected and storage is enabled
    return Promise.resolve(
      context.state.adsCollected.length > 0 &&
        !!context.options.storage?.enabled,
    );
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
    return Promise.resolve();
  }
}
