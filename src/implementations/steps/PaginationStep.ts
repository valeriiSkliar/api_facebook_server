import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';

export class PaginationStep extends AbstractScraperStep {
  shouldExecute(context: ScraperContext): boolean {
    const maxAdsReached =
      context.state.adsCollected.length >=
      (context.options.behavior?.maxAdsToCollect || 200);

    if (maxAdsReached) {
      context.state.forceStop = true;
      context.state.hasMoreResults = false;
      this.logger.log('Max ads reached, stopping pagination');
      return false;
    }

    return !context.state.forceStop && context.state.hasMoreResults;
  }

  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    this.logger.log('Scrolling to load more content');

    let previousAdCount = context.state.adsCollected.length;
    let noNewAdsCount = 0;
    const maxNoNewAdsAttempts = 3;

    while (noNewAdsCount < maxNoNewAdsAttempts) {
      // Check if max ads limit reached
      if (
        context.state.adsCollected.length >=
        (context.options.behavior?.maxAdsToCollect || 200)
      ) {
        context.state.forceStop = true;
        context.state.hasMoreResults = false;
        this.logger.log('Max ads reached during pagination, stopping');
        break;
      }

      // Scroll down to trigger loading more results
      await context.state.page.evaluate(() => {
        window.scrollBy(0, 800);
      });

      // Wait for potential new content to load
      await context.state.page.waitForTimeout(2000);

      // Check if we've reached the bottom
      const isAtBottom = await context.state.page.evaluate(() => {
        return (
          window.innerHeight + window.scrollY >= document.body.scrollHeight
        );
      });

      // Check if new ads were loaded
      const currentAdCount = context.state.adsCollected.length;
      if (currentAdCount === previousAdCount) {
        noNewAdsCount++;

        if (isAtBottom) {
          // If we're at the bottom and no new ads, try waiting a bit longer
          await context.state.page.waitForTimeout(5000);

          // Check one more time if we're still at the bottom
          const stillAtBottom = await context.state.page.evaluate(() => {
            return (
              window.innerHeight + window.scrollY >= document.body.scrollHeight
            );
          });

          if (stillAtBottom) {
            this.logger.log('Reached bottom of page with no new ads');
            context.state.hasMoreResults = false;
            break;
          }
        }
      } else {
        // Reset counter if we found new ads
        noNewAdsCount = 0;
        previousAdCount = currentAdCount;
        this.logger.log(`Found ${currentAdCount - previousAdCount} new ads`);
      }

      // Additional check for visible ad elements
      const visibleAds = await context.state.page.evaluate(() => {
        const adElements = document.querySelectorAll('[role="article"]');
        let count = 0;
        for (const ad of adElements) {
          const rect = ad.getBoundingClientRect();
          if (rect.top < window.innerHeight) {
            count++;
          }
        }
        return count;
      });

      this.logger.debug(`Visible ads on screen: ${visibleAds}`);

      if (isAtBottom && visibleAds === 0) {
        this.logger.log('No more ads visible on page');
        context.state.hasMoreResults = false;
        break;
      }
    }

    if (noNewAdsCount >= maxNoNewAdsAttempts) {
      this.logger.log('No new ads found after multiple attempts');
      context.state.hasMoreResults = false;
    }
  }
}
