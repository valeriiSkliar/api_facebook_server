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
    // Check if we already have a browser and page in the context
    // This would be set when using a browser from the pool
    if (context.state.browser && !context.state.page) {
      // && context.state.page) {
      this.logger.log(
        '[InitializationStep.execute] Using provided browser and page from pool',
      );
      const browserContext = await context.state.browser.newContext();
      const page = await browserContext.newPage();
      await page.setViewportSize(
        context.options.browser?.viewport || { width: 1280, height: 800 },
      );

      // Store browser and page in context
      context.state.page = page;

      // We still need to set the viewport
      // await context.state.page.setViewportSize(
      //   context.options.browser?.viewport || { width: 1280, height: 800 },
      // );

      // Mark as external so we don't close it in cleanup
      context.state.externalBrowser = true;

      // Continue to the next step in the pipeline
      return;
    }
    // Launch browser with options from context
    this.logger.log(
      '[InitializationStep.execute] Launching browser',
      context.options.browser,
    );
    const browser = await launchPlaywright({
      launchOptions: {
        headless: context.options.browser?.headless
          ? context.options.browser?.headless
          : false,
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
    // Only close the browser if it's not external (not from the pool)
    if (context.state.browser && !context.state.externalBrowser) {
      if (context.options.behavior?.cleanUpTimeout) {
        this.logger.log(
          `Waiting for ${context.options.behavior.cleanUpTimeout}ms before closing browser`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, context.options.behavior!.cleanUpTimeout),
        );
        this.logger.log('Closing browser');
      }
      await context.state.page?.close();
    }
    // if (context.state.browser) {
    //   if (context.options.behavior?.cleanUpTimeout) {
    //     this.logger.log(
    //       `Waiting for ${context.options.behavior.cleanUpTimeout}ms before closing browser`,
    //     );
    //     await new Promise((resolve) =>
    //       setTimeout(resolve, context.options.behavior!.cleanUpTimeout),
    //     );
    //     this.logger.log('Closing browser');
    //   }
    //   await context.state.browser.close();
    // }
  }
}
