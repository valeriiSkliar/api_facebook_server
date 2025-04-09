import { Logger } from '@nestjs/common';
import { IBaseScraperQuery } from '../interfaces/base-scraper-query';
import { IBaseScraperOptions } from '../interfaces/base-scraper-options';
import { IBaseScraperState } from '../interfaces/base-scraper-state';
import { IBaseScraperContext } from '../interfaces/base-scraper-context';
import { IBaseScraperResult } from '../interfaces/base-scraper-result';
import { GenericScraperPipeline } from '../pipeline/generic-scraper-pipeline';
import { IGenericScraperStep } from '../interfaces/generic-scraper-step';

/**
 * Abstract factory class for creating scrapers.
 *
 * @template TQuery Type of the query, must extend IBaseScraperQuery
 * @template TOptions Type of the options, must extend IBaseScraperOptions
 * @template TState Type of the state, must extend IBaseScraperState
 * @template TContext Type of the context, must extend IBaseScraperContext
 * @template TStep Type of the step, must implement IGenericScraperStep<TContext>
 * @template TResult Type of the result, must extend IBaseScraperResult
 * @template TData Type of the collected data items
 */
export abstract class GenericScraperFactory<
  TQuery extends IBaseScraperQuery,
  TOptions extends IBaseScraperOptions,
  TState extends IBaseScraperState,
  TContext extends IBaseScraperContext<TQuery, TOptions, TState>,
  TStep extends IGenericScraperStep<TContext>,
  TResult extends IBaseScraperResult<TData>,
  TData = unknown,
> {
  constructor(protected readonly logger: Logger) {}

  /**
   * Create a scraper pipeline
   * @param options Optional options for the scraper
   */
  abstract createScraper(
    options?: Partial<TOptions>,
  ): GenericScraperPipeline<TStep, TContext, TResult, TData>;

  /**
   * Create a scraper context
   * @param query The query for the scraper
   * @param options Optional options for the scraper
   */
  abstract createContext(query: TQuery, options?: Partial<TOptions>): TContext;

  /**
   * Get the steps for the scraper
   */
  abstract getSteps(): TStep[];

  /**
   * Merge provided options with default options
   * @param options Optional options to merge with defaults
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected mergeWithDefaultOptions(options?: Partial<TOptions>): TOptions {
    // This method should be implemented by subclasses
    throw new Error('Method not implemented');
  }
}
