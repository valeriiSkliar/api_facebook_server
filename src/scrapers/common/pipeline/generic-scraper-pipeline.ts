import { Logger } from '@nestjs/common';
// Assuming IPipelineStep and IPipelineResult are defined, possibly in @src/core/interfaces
import {
  BasePipeline,
  IPipelineStep,
  IPipelineResult,
} from '@src/core/interfaces';

/**
 * Base interface for scraper context state.
 * Individual scrapers should extend this.
 */
export interface IBaseScraperState {
  errors: Error[];
  forceStop: boolean;
  externalBrowser?: boolean;
  browserId?: string;
  // Add other common state properties if needed
}

/**
 * Base interface for scraper context.
 * Individual scrapers should extend this.
 */
export interface IBaseScraperContext {
  state: IBaseScraperState;
  // Add other common context properties if needed (like options)
}

/**
 * Base interface for scraper steps.
 * Individual steps should implement this.
 */
export interface IGenericScraperStep<TContext extends IBaseScraperContext>
  extends IPipelineStep<TContext> {
  shouldExecute(context: TContext): boolean | Promise<boolean>;
  cleanup(context: TContext): Promise<void>;
}

/**
 * A generic scraper pipeline that can work with different scraper types.
 *
 * @template TStep The specific type of scraper step, implementing IGenericScraperStep<TContext>.
 * @template TContext The specific type of scraper context, extending IBaseScraperContext.
 * @template TResult The specific type of scraper result, extending IPipelineResult.
 */
export class GenericScraperPipeline<
  TStep extends IGenericScraperStep<TContext>,
  TContext extends IBaseScraperContext,
  TResult extends IPipelineResult,
> extends BasePipeline<TStep, TContext, TResult> {
  constructor(logger: Logger) {
    super(logger);
  }

  /**
   * Executes the pipeline steps using the provided context.
   * @param context The scraper-specific context.
   * @returns A promise resolving to the scraper-specific result.
   */
  async execute(context: TContext): Promise<TResult> {
    const startTime = Date.now();
    const executedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        const stepName = step.getName();

        // Use the generic context for shouldExecute check
        if (await step.shouldExecute(context)) {
          this.logStepExecution(stepName);

          // Log browser details if present (common state property)
          if (
            context.state.externalBrowser &&
            stepName === 'InitializationStep'
          ) {
            this.logger.log(
              `Using external browser (ID: ${context.state.browserId || 'unknown'})`,
            );
          }

          // Execute the step with the generic context
          await step.execute(context);
          executedSteps.push(step.getName());
        } else {
          this.logStepSkip(stepName);
          // Check forceStop from the common state
          if (context.state.forceStop) {
            this.logger.log(
              `Force stop requested, halting pipeline after step: ${stepName}`,
            );
            break;
          }
        }
      }

      // --- Generic Result Formatting ---
      // The pipeline itself returns a base result. The specific scraper logic
      // (e.g., the service that calls this pipeline) should be responsible
      // for constructing the final, detailed result (like ScraperResult or TikTokScraperResult)
      // based on the final context state and this base result.

      const baseResult = {
        success: context.state.errors.length === 0,
        errors: context.state.errors,
        executionTime: Date.now() - startTime,
        // Add any other fields common to all results defined in IPipelineResult
      };

      // We cast to TResult, assuming the caller will handle the specifics.
      // Alternatively, you could require TResult to have a factory method
      // or pass a result formatter function to the constructor.
      return baseResult as TResult;
    } catch (error) {
      this.logger.error(
        `Pipeline execution failed`,
        error instanceof Error ? error.stack : String(error),
      );

      // Construct a generic error result
      const errorResult = {
        success: false,
        errors: [...context.state.errors, error as Error],
        executionTime: Date.now() - startTime,
      };
      return errorResult as TResult; // Cast to TResult
    } finally {
      // Cleanup remains generic, relying on the step's implementation
      for (const step of this.steps) {
        try {
          // The cleanup method is part of IGenericScraperStep
          await step.cleanup(context);
        } catch (error) {
          this.logStepError(`cleanup for ${step.getName()}`, error);
        }
      }
    }
  }
}
