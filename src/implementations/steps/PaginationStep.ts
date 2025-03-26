import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';

export class PaginationStep extends AbstractScraperStep {
  shouldExecute(context: ScraperContext): boolean {
    return (
      context.state.adsCollected.length <
        (context.options.behavior?.maxAdsToCollect || 200) &&
      context.state.hasMoreResults
    );
  }

  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    this.logger.debug('Scrolling to load more content');

    // Scroll down to trigger loading more results
    await context.state.page.evaluate(() => {
      window.scrollBy(0, 800);
    });

    // Wait for network activity to settle
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we've reached the bottom
    const isAtBottom = await context.state.page.evaluate(() => {
      return window.innerHeight + window.scrollY >= document.body.scrollHeight;
    });

    if (isAtBottom) {
      context.state.hasMoreResults = false;
      this.logger.debug('Reached bottom of page');
    }
  }
}
