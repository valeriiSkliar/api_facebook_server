import { IBaseScraperState } from './base-scraper-state';
import { IBaseScraperQuery } from './base-scraper-query';
import { IBaseScraperOptions } from './base-scraper-options';

/**
 * Base interface for scraper context.
 * All scraper context implementations should extend this.
 *
 * @template TQuery Type of the query, must extend IBaseScraperQuery
 * @template TOptions Type of the options, must extend IBaseScraperOptions
 * @template TState Type of the state, must extend IBaseScraperState
 */
export interface IBaseScraperContext<
  TQuery extends IBaseScraperQuery = IBaseScraperQuery,
  TOptions extends IBaseScraperOptions = IBaseScraperOptions,
  TState extends IBaseScraperState = IBaseScraperState,
> {
  /** The query parameters for scraping */
  query: TQuery;

  /** The options for scraping */
  options: TOptions;

  /** The state of the scraping process */
  state: TState;
}
