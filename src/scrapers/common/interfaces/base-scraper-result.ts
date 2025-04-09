/**
 * Base interface for scraper results.
 * All scraper result implementations should extend this.
 *
 * @template TData Type of the collected data
 */
export interface IBaseScraperResult<TData = unknown> {
  /** Whether the scraping was successful */
  success: boolean;

  /** Array of collected data items */
  ads: TData[];

  /** Total count of collected items */
  totalCount: number;

  /** Total execution time in milliseconds */
  executionTime: number;

  /** Path where output was stored */
  outputPath?: string;

  /** Array of errors encountered during scraping */
  errors: Error[];

  /** Whether to include the results in the response */
  includeAdsInResponse?: boolean;

  /** Whether there are more results to fetch */
  hasMoreResults?: boolean;

  /** Current page number for pagination */
  currentPage?: number;
}
