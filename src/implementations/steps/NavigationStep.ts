import { AbstractScraperStep } from '@src/scrapers/common/interfaces/abstract-scraper-step';
import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';

// steps/NavigationStep.ts
export class NavigationStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<boolean> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    const url = this.buildAdLibraryUrl(context.query);
    this.logger.log(`Navigating to: ${url}`);

    try {
      await context.state.page.goto(url, {
        // waitUntil: 'networkidle',
        timeout: 5000,
      });

      // Handle cookie consent if present
      try {
        const cookieSelector =
          '[data-testid="cookie-policy-manage-dialog-accept-button"]';
        await context.state.page.waitForSelector(cookieSelector, {
          timeout: 5000,
        });
        await context.state.page.click(cookieSelector);
        this.logger.log('Accepted cookies');
      } catch {
        this.logger.log('No cookie banner found or already accepted');
      }

      // Wait for content to load
      // await context.state.page.waitForSelector('[role="main"]', {
      //   timeout: 30000,
      //   state: 'visible',
      // });

      // Additional wait to ensure dynamic content loads
      await context.state.page.waitForTimeout(2000);

      // Check for login requirement
      // const loginButton = await context.state.page.$(
      //   '[data-testid="royal_login_button"]',
      // );
      // if (loginButton) {
      //   throw new Error('Facebook authentication required');
      // }
      return true;
    } catch (error) {
      this.logger.error('Navigation failed:', error);
      await this.cleanup(context);
      throw new Error('Failed to load Facebook Ads Library');
    }
  }

  private buildAdLibraryUrl(query: AdLibraryQuery): string {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const params = new URLSearchParams();

    // Add required parameters
    params.append('active_status', query.activeStatus);
    params.append('ad_type', query.adType);
    params.append('country', query.countries.join(','));
    params.append('q', query.queryString);
    params.append('media_type', query.mediaType);
    params.append('search_type', query.searchType);

    if (query.isTargetedCountry) {
      params.append('is_targeted_country', 'true');
    }

    if (query.filters?.dateRange) {
      const { start, end } = query.filters.dateRange;
      if (start) {
        params.append('start_date[min]', this.formatDate(start));
      }
      if (end) {
        params.append('start_date[max]', this.formatDate(end));
      }
    }

    return `${baseUrl}?${params.toString()}`;
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  async cleanup(context: ScraperContext): Promise<void> {
    await super.cleanup(context);
    await context.state.page?.close();
  }
}
