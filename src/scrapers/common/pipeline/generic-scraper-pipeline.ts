import { Logger } from '@nestjs/common';
import { BasePipeline } from '@src/core/interfaces';
import { IGenericScraperStep } from '../interfaces/generic-scraper-step';
import { IBaseScraperContext } from '../interfaces/base-scraper-context';
import { IBaseScraperResult } from '../interfaces/base-scraper-result';

/**
 * Generic scraper pipeline class.
 * Executes a series of steps to scrape data.
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
      for (const step of this.steps) {
        const stepName = step.getName();

        // Determine if the step should be executed
        const shouldExecute = await step.shouldExecute(context);
        if (shouldExecute) {
          this.logStepExecution(stepName);

          // Log browser details for initial step if using external browser
          if (
            context.state.externalBrowser &&
            stepName.includes('Initialization')
          ) {
            this.logger.log(
              `Using external browser (ID: ${context.state.browserId || 'unknown'})`,
            );
          }

          // Execute the step
          await step.execute(context);
          executedSteps.push(stepName);
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
