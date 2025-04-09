/**
 * Base interface for scraper queries.
 * All scraper query implementations should extend this.
 */
export interface IBaseScraperQuery {
  /** The search query string */
  queryString: string;
}
