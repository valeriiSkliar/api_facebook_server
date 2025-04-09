import { Logger } from '@nestjs/common';
import { BasePipeline } from '@src/core/interfaces';
import { IGenericScraperStep } from '../interfaces/generic-scraper-step';
import { IBaseScraperContext } from '../interfaces/base-scraper-context';
import { IBaseScraperResult } from '../interfaces/base-scraper-result';

/**
 * Generic scraper pipeline class.
 * Executes a series of steps to scrape data with support for pagination.
 *
 * @template TStep Type of the step, must implement IGenericScraperStep<TContext>
 * @template TContext Type of the context, must extend IBaseScraperContext
 * @template TResult Type of the result, must extend IBaseScraperResult
 * @template TData Type of the collected data items
 */
export class GenericScraperPipeline<
  TStep extends IGenericScraperStep<TContext>,
  TContext extends IBaseScraperContext,
  TResult extends IBaseScraperResult<TData>,
  TData = unknown,
> extends BasePipeline<TStep, TContext, TResult> {
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * Execute the pipeline steps with the provided context
   * @param context The scraper context
   */
  async execute(context: TContext): Promise<TResult> {
    const startTime = Date.now();
    const executedSteps: string[] = [];

    try {
      // Execute the pipeline with pagination support
      await this.controlFlow(context, executedSteps);

      // Format the result
      return this.formatResult(context, startTime, true);
    } catch (error) {
      this.logger.error(
        `Pipeline execution failed`,
        error instanceof Error ? error.stack : String(error),
      );

      // Add the error to the context
      if (error instanceof Error) {
        context.state.errors.push(error);
      } else {
        context.state.errors.push(new Error(String(error)));
      }

      // Format the result with failure status
      return this.formatResult(context, startTime, false);
    } finally {
      // Clean up all steps
      for (const step of this.steps) {
        try {
          await step.cleanup(context);
        } catch (error) {
          this.logStepError(`cleanup for ${step.getName()}`, error);
        }
      }
    }
  }

  /**
   * Controlled execution flow that handles pagination
   * This method will identify and repeat necessary steps when pagination is required
   * @param context The scraper context
   * @param executedSteps Array to track which steps have been executed
   */
  protected async controlFlow(
    context: TContext,
    executedSteps: string[],
  ): Promise<void> {
    // Identify API request and pagination steps
    const apiStepIndex = this.findStepIndex('ApiRequest');
    const paginationStepIndex = this.findStepIndex('Pagination');

    // If we don't have both API request and pagination steps, run the pipeline normally
    if (apiStepIndex === -1 || paginationStepIndex === -1) {
      this.logger.log('Running pipeline without pagination support');
      return await this.executeSteps(this.steps, context, executedSteps);
    }

    // Split pipeline steps into phases
    const initSteps = this.steps.slice(0, apiStepIndex); // Steps before API request
    const paginationCycleSteps = this.steps.slice(apiStepIndex); // API request and all steps after

    // Execute initialization steps first (only once)
    this.logger.log('Executing initialization steps...');
    await this.executeSteps(initSteps, context, executedSteps);

    // Configure pagination limits and safeguards
    const maxPages = context.options?.behavior?.maxPages || 10;
    const maxAdsToCollect =
      context.options?.behavior?.maxAdsToCollect || Number.MAX_SAFE_INTEGER;

    // Absolute emergency circuit breaker to prevent infinite loops
    // The smaller of: configured maxPages * 2 or hardcoded 50
    const absoluteMaxPages = Math.min(maxPages * 2, 50);

    // Execute pagination cycle until we run out of pages or hit the limit
    let pageCount = 0;
    let emptyResultsCount = 0;
    const maxConsecutiveEmptyResults = 3; // Stop after 3 consecutive empty result pages
    let previousAdsCount = 0;

    do {
      this.logger.log(`Processing page ${pageCount + 1}...`);

      // Execute one pagination cycle
      await this.executeSteps(paginationCycleSteps, context, executedSteps);

      pageCount++;

      // Check if we got new ads in this cycle
      const currentAdsCount = context.state.adsCollected.length;
      const newAdsInThisCycle = currentAdsCount - previousAdsCount;
      previousAdsCount = currentAdsCount;

      // Track consecutive empty results as a safeguard
      if (newAdsInThisCycle === 0) {
        emptyResultsCount++;
        this.logger.warn(
          `No new ads found in this cycle. Empty results count: ${emptyResultsCount}`,
        );
      } else {
        // Reset the counter if we found ads
        emptyResultsCount = 0;
      }

      // Emergency circuit breakers - check multiple exit conditions

      // 1. Check if we've collected enough ads
      if (context.state.adsCollected.length >= maxAdsToCollect) {
        this.logger.log(`Reached maximum ads to collect: ${maxAdsToCollect}`);
        context.state.hasMoreResults = false;
        break;
      }

      // 2. Check if API reports no more results
      if (!context.state.hasMoreResults) {
        this.logger.log('API reported no more results available');
        break;
      }

      // 3. Check if we've reached the configured page limit
      if (pageCount >= maxPages) {
        this.logger.log(`Reached configured maximum page limit (${maxPages})`);
        context.state.hasMoreResults = false;
        break;
      }

      // 4. Check for too many consecutive empty result pages
      if (emptyResultsCount >= maxConsecutiveEmptyResults) {
        this.logger.warn(
          `Received ${emptyResultsCount} consecutive empty result pages. Stopping pagination as a precaution.`,
        );
        context.state.hasMoreResults = false;
        break;
      }

      // 5. Absolute emergency circuit breaker
      if (pageCount >= absoluteMaxPages) {
        this.logger.error(
          `EMERGENCY CIRCUIT BREAKER: Reached absolute maximum page limit (${absoluteMaxPages}). ` +
            `This may indicate an infinite loop condition.`,
        );
        context.state.errors.push(
          new Error(
            `Emergency circuit breaker triggered after ${pageCount} pages. Possible infinite loop.`,
          ),
        );
        context.state.hasMoreResults = false;
        break;
      }

      this.logger.log(
        `More results available, continuing to page ${pageCount + 1}...`,
      );
      // eslint-disable-next-line no-constant-condition
    } while (true);

    this.logger.log(
      `Pagination complete after processing ${pageCount} pages. Collected ${context.state.adsCollected.length} ads total.`,
    );
  }

  /**
   * Find the index of a step by partial name match
   * @param partialName Partial name to match
   * @returns Index of the step or -1 if not found
   */
  private findStepIndex(partialName: string): number {
    return this.steps.findIndex((step) => step.getName().includes(partialName));
  }

  /**
   * Execute a set of steps in sequence
   * @param steps The steps to execute
   * @param context The scraper context
   * @param executedSteps Array to track which steps have been executed
   */
  private async executeSteps(
    steps: TStep[],
    context: TContext,
    executedSteps: string[],
  ): Promise<void> {
    for (const step of steps) {
      const stepName = step.getName();

      // Determine if the step should be executed
      const shouldExecute = await step.shouldExecute(context);
      if (shouldExecute) {
        this.logStepExecution(stepName);

        // Execute the step
        const success = await step.execute(context);
        executedSteps.push(stepName);

        // If a step fails, log it but continue the pipeline
        if (!success) {
          this.logger.warn(
            `Step ${stepName} failed but pipeline will continue`,
          );
        }
      } else {
        this.logStepSkip(stepName);
      }

      // Check if force stop is requested
      if (context.state.forceStop) {
        this.logger.log(
          `Force stop requested, halting pipeline after step: ${stepName}`,
        );
        break;
      }
    }
  }

  /**
   * Log that a step is being executed
   * @param stepName Name of the step
   */
  protected logStepExecution(stepName: string): void {
    this.logger.log(`Executing step: ${stepName}`);
  }

  /**
   * Log that a step is being skipped
   * @param stepName Name of the step
   */
  protected logStepSkip(stepName: string): void {
    this.logger.log(`Skipping step: ${stepName}`);
  }

  /**
   * Log an error that occurred during step execution
   * @param stepName Name of the step
   * @param error Error that occurred
   */
  protected logStepError(stepName: string, error: unknown): void {
    this.logger.error(
      `Error in ${stepName}`,
      error instanceof Error ? error.stack : String(error),
    );
  }

  /**
   * Format the result of the pipeline execution
   * @param context The scraper context
   * @param startTime The start time of the execution
   * @param success Whether the execution was successful
   */
  private formatResult(
    context: TContext,
    startTime: number,
    success: boolean,
  ): TResult {
    // Create a base result object
    const result = {
      success: success && context.state.errors.length === 0,
      ads: context.state.adsCollected as TData[],
      totalCount: context.state.adsCollected.length,
      executionTime: Date.now() - startTime,
      outputPath:
        context.state.outputPath || context.options?.storage?.outputPath || '',
      errors: context.state.errors,
      includeAdsInResponse: context.options?.includeAdsInResponse || false,
      hasMoreResults: context.state.hasMoreResults,
      currentPage: context.state.currentPage,
    };

    // Cast to TResult
    return result as TResult;
  }
}
