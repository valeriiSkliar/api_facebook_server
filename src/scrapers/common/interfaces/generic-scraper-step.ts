import { IBaseScraperContext } from './base-scraper-context';

/**
 * Interface for generic scraper steps.
 * All scraper step implementations should implement this.
 *
 * @template TContext Type of the context, must extend IBaseScraperContext
 */
export interface IGenericScraperStep<TContext extends IBaseScraperContext> {
  /**
   * Get the name of this step
   */
  getName(): string;

  /**
   * Determine if this step should be executed
   * @param context The scraper context
   */
  shouldExecute(context: TContext): boolean | Promise<boolean>;

  /**
   * Execute this step
   * @param context The scraper context
   */
  execute(context: TContext): Promise<boolean>;

  /**
   * Clean up resources used by this step
   * @param context The scraper context
   */
  cleanup(context: TContext): Promise<void>;
}
