import { Logger } from '@nestjs/common';
import { GenericScraperPipeline } from '@src/scrapers/common/pipeline/generic-scraper-pipeline';
import {
  TiktokApiConfigContext,
  TiktokApiConfigResult,
  TiktokApiConfigStep,
} from './tiktok-api-config-types';
import { ApiConfig } from '@src/modules/api-config'; // Assuming ApiConfig interface exists

/**
 * Pipeline specifically designed for acquiring and managing TikTok API configurations.
 * It extends the GenericScraperPipeline but is tailored for API config tasks.
 */
export class TiktokApiConfigPipeline extends GenericScraperPipeline<
  TiktokApiConfigStep, // The specific step type for this pipeline
  TiktokApiConfigContext, // The specific context type
  TiktokApiConfigResult, // The specific result type
  ApiConfig // The type of data collected (API Configs)
> {
  constructor(logger: Logger) {
    // Pass the logger to the base GenericScraperPipeline constructor
    super(logger);
    this.logger.log(
      '[TiktokApiConfigPipeline] TiktokApiConfigPipeline initialized',
    );
  }

  /**
   * Executes the API configuration pipeline.
   * Overrides the base execute method if specific control flow is needed,
   * otherwise relies on the base implementation which handles step execution and error logging.
   *
   * @param context The context containing query, options, and state.
   * @returns A promise resolving to the pipeline result.
   */
  async execute(
    context: TiktokApiConfigContext,
  ): Promise<TiktokApiConfigResult> {
    const startTime = Date.now();
    this.logger.log(
      `[TiktokApiConfigPipeline] Executing TiktokApiConfigPipeline for accountId: ${context.state.accountId}`,
    );

    // Initialize error tracking if not already present
    if (!context.state.errors) {
      context.state.errors = [];
    }
    if (!context.state.configsCollected) {
      context.state.configsCollected = []; // Initialize if needed
    }

    try {
      // --- Standard Step Execution (from BasePipeline) ---
      // Iterate through the steps added to this pipeline instance.
      // You will need to add the actual steps (like Initialize, FetchConfig, ValidateConfig, SaveConfig)
      // using a factory similar to how other scrapers are built.
      for (const step of this.steps) {
        const stepName = step.getName();
        const shouldExecute = await step.shouldExecute(context); // Check if the step should run

        if (shouldExecute) {
          this.logStepExecution(stepName); // Log step start
          const success = await step.execute(context); // Execute the step

          // Handle step failure if necessary (optional: base pipeline already logs errors)
          if (!success) {
            this.logger.warn(
              `[TiktokApiConfigPipeline] Step ${stepName} reported failure.`,
            );
            // Decide if pipeline should stop or continue based on step importance
            // For now, we let the base error handling manage this.
            // If a critical step fails, it might throw an error caught below.
          }
        } else {
          this.logStepSkip(stepName); // Log step skip
        }

        // Check for force stop request within the loop
        if (context.state.forceStop) {
          this.logger.log(
            `[TiktokApiConfigPipeline] Force stop requested during step: ${stepName}`,
          );
          break; // Exit the loop
        }
      }
      // --- End Standard Step Execution ---

      this.logger.log(
        `[TiktokApiConfigPipeline] execution finished for accountId: ${context.state.accountId}`,
      );
      // Format and return the result based on the final context state
      return this.formatResult(
        context,
        startTime,
        context.state.errors.length === 0,
      );
    } catch (error) {
      this.logger.error(
        `[TiktokApiConfigPipeline] Pipeline execution failed for accountId: ${context.state.accountId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Add the error to the context
      if (error instanceof Error) {
        context.state.errors.push(error);
      } else {
        context.state.errors.push(new Error(String(error)));
      }
      // Format and return the result indicating failure
      return this.formatResult(context, startTime, false);
    } finally {
      // Ensure cleanup runs for all steps added to the pipeline
      this.logger.log(
        `[TiktokApiConfigPipeline] Running cleanup for TiktokApiConfigPipeline (accountId: ${context.state.accountId})`,
      );
      for (const step of this.steps) {
        try {
          await step.cleanup(context);
        } catch (cleanupError) {
          this.logStepError(
            `[TiktokApiConfigPipeline] cleanup for ${step.getName()}`,
            cleanupError,
          );
        }
      }
    }
  }

  /**
   * Formats the final result of the pipeline execution.
   * Maps the internal state to the TiktokApiConfigResult structure.
   *
   * @param context The final state of the context after execution.
   * @param startTime The timestamp when the pipeline execution started.
   * @param success Indicates whether the pipeline execution was successful overall.
   * @returns The formatted pipeline result.
   */
  protected override formatResult(
    context: TiktokApiConfigContext,
    startTime: number,
    success: boolean,
  ): TiktokApiConfigResult {
    // Adapt the result formatting for API Configs
    const result: TiktokApiConfigResult = {
      success: success && context.state.errors.length === 0,
      // Use 'configs' key if returning multiple configs, or 'finalConfig' for a single one
      configs: context.state.configsCollected, // Renamed from 'ads'
      finalConfig: context.state.retrievedConfig, // Add the specific config retrieved
      totalCount: context.state.configsCollected.length, // Count of configs
      executionTime: Date.now() - startTime,
      errors: context.state.errors,
      // 'outputPath' might not be relevant here unless configs are saved to files
      outputPath: context.options?.storage?.outputPath,
      // 'includeAdsInResponse' renamed for clarity
      includeAdsInResponse: context.options?.includeAdsInResponse || false, // Should probably be false for configs
      // Pagination fields might not be relevant, set defaults or omit
      hasMoreResults: context.state.hasMoreResults ?? false,
      currentPage: context.state.currentPage ?? 0,
      ads: [],
    };
    return result;
  }

  // Inherit logStepExecution, logStepSkip, logStepError from BasePipeline
  // No need to override them unless custom logging is needed.
}
