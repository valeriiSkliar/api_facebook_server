import { Injectable, Logger } from '@nestjs/common';
import { TiktokScraperStep } from './tiktok-scraper-step';
import { TiktokScraperContext } from '../../tiktok-scraper-types';
import { TiktokCreativeService } from '../../services/tiktok-creative.service';

@Injectable()
export class SaveCreativesStep extends TiktokScraperStep {
  constructor(
    protected readonly logger: Logger,
    private readonly creativeService: TiktokCreativeService,
  ) {
    super('SaveCreatives', logger);
  }

  async execute(context: TiktokScraperContext): Promise<boolean> {
    const { state } = context;
    const { adsCollected } = state;

    if (!adsCollected || adsCollected.length === 0) {
      this.logger.log('No creatives collected to save.');
      return true; // Nothing to save, step succeeded
    }

    try {
      await this.creativeService.saveCreatives(adsCollected);
      return true; // Save operation attempted (success logging is in the service)
    } catch (error) {
      // Type assertion for error handling
      const stepError = error as Error;
      this.logger.error(
        `Failed to execute SaveCreativesStep: ${stepError.message}`,
        stepError.stack,
      );
      return false; // Indicate step failure
    }
  }
}
