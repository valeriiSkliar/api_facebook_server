import { AdLibraryQuery } from '@src/scrapers/facebook/models/facebook-ad-lib-query';
import { ScraperOptions } from '@src/scrapers/facebook/models/facebook-scraper-options';
import { ScraperResult } from '@src/scrapers/facebook/models/facebook-scraper-result';
import { Browser, Page } from 'playwright';

/**
 * Defines the common structure for ad scraper services across different platforms.
 * @template QueryType The type representing the search query parameters.
 * @template OptionsType The type representing the scraper configuration options.
 * @template ResultType The type representing the result returned by the scraper.
 */
export interface IAdScraperService<QueryType, OptionsType, ResultType> {
  /**
   * Scrapes ads using a specific browser ID from the pool, or creates a temporary one if no ID is provided.
   * @param query The search query parameters.
   * @param options Scraper configuration options.
   * @param browserId Optional ID of the browser to use from the pool.
   * @returns A promise resolving to the scraper result.
   */
  scrapeAds(
    query: AdLibraryQuery,
    options?: Partial<ScraperOptions>,
  ): Promise<ScraperResult>;

  /**
   * Scrapes ads using a specific browser ID from the pool, or creates a temporary one if no ID is provided.
   * @param query The search query parameters.
   * @param options Scraper configuration options.
   * @param browserId Optional ID of the browser to use from the pool.
   * @returns A promise resolving to the scraper result.
   */
  scrapeAdsWithBrowser?(
    query: QueryType,
    options?: Partial<OptionsType>,
    browserId?: string,
  ): Promise<ResultType>;

  /**
   * Executes the scraper using an externally provided Browser instance.
   * This method assumes the caller manages the browser lifecycle.
   * @param query The search query parameters.
   * @param options Scraper configuration options.
   * @param browser An existing Playwright Browser instance.
   * @param browserId Optional identifier for the browser instance.
   * @returns A promise resolving to the scraper result.
   */
  executeScraperWithBrowser?(
    query: QueryType,
    options?: Partial<OptionsType>,
    browser?: Browser,
    browserId?: string,
  ): Promise<ResultType>;

  /**
   * Executes the scraper using an externally provided Browser and Page instance.
   * This method is useful when a specific page context is already available.
   * Note: This might be optional depending on the specific needs of the scraper implementation.
   * @param query The search query parameters.
   * @param options Scraper configuration options.
   * @param browser An existing Playwright Browser instance.
   * @param page An existing Playwright Page instance.
   * @param browserId Optional identifier for the browser instance.
   * @param requestId Optional identifier for tracking the specific request.
   * @returns A promise resolving to the scraper result.
   */
  executeScraperWithBrowserAndPage?(
    query: QueryType,
    options?: Partial<OptionsType>,
    browser?: Browser,
    page?: Page,
    browserId?: string,
    requestId?: string,
  ): Promise<ResultType>;
}
