import { Logger } from '@nestjs/common';
import { TiktokApiConfigStep } from './api-config-step';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';

export class NavigationAndRestoreStep extends TiktokApiConfigStep {
  private readonly NAVIGATION_TIMEOUT = 30000; // 30 seconds
  private readonly PAGE_LOAD_WAIT = 5000; // 5 seconds

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
  ) {
    super(name, logger);
  }

  async shouldExecute(): Promise<boolean> {
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    const { browserContexts } = context.state;
    if (!browserContexts?.length) {
      this.logger.error('Browser contexts not found in NavigationStep');
      throw new Error('Browser contexts not found');
    }

    // Используем только первый контекст для навигации
    const browserContext = browserContexts[0];
    const page = browserContext.page;
    if (!page) {
      this.logger.error('Page not found in NavigationStep');
      throw new Error('Page not found');
    }

    this.logger.log(`Navigating to TikTok creative center page`);

    try {
      // First navigate to a blank page to ensure clean state
      await page.goto('about:blank', { timeout: 5000 }).catch(() => {
        this.logger.warn(
          'Initial navigation to blank page failed, continuing anyway',
        );
      });

      // Set longer timeout for main navigation
      await page.goto(
        'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
        {
          waitUntil: 'networkidle',
          timeout: this.NAVIGATION_TIMEOUT,
        },
      );

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle', {
        timeout: this.NAVIGATION_TIMEOUT,
      });

      // Additional wait for any dynamic content
      await page.waitForTimeout(this.PAGE_LOAD_WAIT);

      // Verify page loaded successfully
      const pageTitle = await page.title();
      this.logger.log(
        `Successfully navigated to page with title: ${pageTitle}`,
      );

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Navigation to TikTok page failed: ${errorMessage}`);
      throw error;
    }
  }
}
