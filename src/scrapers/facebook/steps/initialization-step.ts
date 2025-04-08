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
    if (!context.state.page || context.state.page.isClosed()) {
      this.logger.error(
        '[InitializationStep.execute] No valid page provided in context. External page is required.',
      );
      throw new Error(
        'InitializationStep requires an external page to be provided',
      );
    }

    this.logger.log(
      '[InitializationStep.execute] Using external page from context.',
    );

    try {
      await context.state.page.setViewportSize(
        context.options.browser?.viewport || { width: 1280, height: 800 },
      );
    } catch (vpError: unknown) {
      this.logger.error(
        `[InitializationStep.execute] Could not set viewport: ${vpError instanceof Error ? vpError.message : 'Unknown error'}`,
      );
      throw vpError;
    }

    context.state.externalBrowser = context.state.browserId ? true : false;
    return true;
  }

  async cleanup(context: ScraperContext): Promise<void> {
    this.logger.log(
      '[InitializationStep.cleanup] Skipping cleanup for externally managed resources',
      {
        browserId: context.state.browserId,
      },
    );

    return Promise.resolve();
  }
}
