import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';
import { launchPlaywright } from 'crawlee';
import { Logger } from '@nestjs/common';

// steps/InitializationStep.ts
export class InitializationStep extends AbstractScraperStep {
  constructor(name: string, logger: Logger) {
    super(name, logger);
  }

  async execute(context: ScraperContext): Promise<void> {
    super.logger.debug('Initializing browser');

    // Launch browser with options from context
    const browser = await launchPlaywright({
      launchOptions: {
        headless: context.options.browser?.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      },
    });

    const page = await browser.newPage();
    await page.setViewportSize(
      context.options.browser?.viewport || { width: 1280, height: 800 },
    );

    // Store browser and page in context
    context.state.browser = browser;
    context.state.page = page;
  }

  async cleanup(context: ScraperContext): Promise<void> {
    if (context.state.browser) {
      await context.state.browser.close();
    }
  }
}
