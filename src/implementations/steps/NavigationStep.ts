import { AbstractScraperStep } from '@src/interfaces/AbstractScraperStep';
import { ScraperContext } from '@src/models/ScraperContext';
import { AdLibraryQuery } from '@src/models/AdLibraryQuery';

// steps/NavigationStep.ts
export class NavigationStep extends AbstractScraperStep {
  async execute(context: ScraperContext): Promise<void> {
    if (!context.state.page) {
      throw new Error('Page not initialized');
    }

    const url = this.buildAdLibraryUrl(context.query);
    this.logger.log(`Navigating to: ${url}`);

    try {
      await context.state.page.goto(url, {
        // waitUntil: 'domcontentloaded',
        timeout: 2000,
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
    } catch (error) {
      this.logger.error('Navigation failed:', error);
      throw new Error('Failed to load Facebook Ads Library');
    }
  }

  private buildAdLibraryUrl(query: AdLibraryQuery): string {
    // Base URL for Facebook Ad Library
    const baseUrl = 'https://www.facebook.com/ads/library/';

    // Construct query parameters
    const params = new URLSearchParams();

    // Add required parameters
    params.append('active_status', query.activeStatus);
    params.append('ad_type', query.adType);
    params.append('country', query.countries.join(','));
    params.append('q', query.queryString);
    params.append('media_type', query.mediaType);
    params.append('search_type', query.searchType);

    // Add optional parameters
    if (query.isTargetedCountry) {
      params.append('is_targeted_country', 'true');
    }

    // Add additional filters if present
    if (query.filters) {
      // Process filters based on your filter structure
      // For example:
      if (query.filters.dateRange) {
        const { start, end } = query.filters.dateRange;
        if (start) params.append('start_date', new Date(start).toISOString());
        if (end) params.append('end_date', new Date(end).toISOString());
      }
    }

    // Construct the final URL
    return `${baseUrl}?${params.toString()}`;
  }
}
