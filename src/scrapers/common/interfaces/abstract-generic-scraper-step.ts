/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger } from '@nestjs/common';
import { IGenericScraperStep } from '../interfaces/generic-scraper-step';
import { IBaseScraperContext } from '../interfaces/base-scraper-context';

/**
 * Abstract implementation of IGenericScraperStep.
 * Provides common functionality for all scraper steps.
 *
 * @template TContext Type of the context, must extend IBaseScraperContext
 */
export abstract class AbstractGenericScraperStep<
  TContext extends IBaseScraperContext,
> implements IGenericScraperStep<TContext>
{
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
  ) {}

  /**
   * Get the name of this step
   */
  getName(): string {
    return this.name;
  }

  /**
   * Determine if this step should be executed
   * Default implementation always returns true
   * @param context The scraper context
   */
  shouldExecute(context: TContext): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Execute this step
   * Must be implemented by subclasses
   * @param context The scraper context
   */
  abstract execute(context: TContext): Promise<boolean>;

  /**
   * Clean up resources used by this step
   * Default implementation does nothing
   * @param context The scraper context
   */
  async cleanup(context: TContext): Promise<void> {
    // Default implementation - no cleanup needed
  }
}
