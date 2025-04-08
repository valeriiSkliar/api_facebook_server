import { AdData } from './facebook-ad-data';

export interface ScraperResult {
  /**
   * Indicates if the scraping operation was successful
   */
  success: boolean;

  /**
   * The collected ad data
   */
  ads: AdData[];

  /**
   * Total count of ads collected
   */
  totalCount: number;

  /**
   * Total execution time in milliseconds
   */
  executionTime: number;

  /**
   * Path where the data was saved (if applicable)
   */
  outputPath?: string;

  /**
   * Any errors that occurred during scraping
   */
  errors: Error[];

  /**
   * Whether to include the ads in the response
   */
  includeAdsInResponse?: boolean;

  /**
   * Whether there are more results to fetch
   */
  hasMoreResults?: boolean;

  /**
   * Current page number
   */
  currentPage?: number;
}
