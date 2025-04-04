import { Logger } from '@nestjs/common';
import { ScraperContext } from '@src/scrapers/facebook/models/facebook-scraper-context';
import { ScraperResult } from '@src/scrapers/facebook/models/facebook-scraper-result';
import { IScraperStep } from '@src/scrapers/common/interfaces';
import { BasePipeline } from '@src/core/interfaces';

export class ScraperPipeline extends BasePipeline<
  IScraperStep,
  ScraperContext,
  ScraperResult
> {
  constructor(logger: Logger) {
    super(logger);
  }

  async execute(context: ScraperContext): Promise<ScraperResult> {
    const startTime = Date.now();
    const executedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        const stepName = step.getName();
        if (step.shouldExecute(context)) {
          this.logStepExecution(stepName);
          // If using external browser, log additional info for debugging
          if (
            context.state.externalBrowser &&
            stepName === 'InitializationStep'
          ) {
            this.logger.log(
              `Using external browser (ID: ${context.state.browserId || 'unknown'})`,
            );
          }
          await step.execute(context);
          executedSteps.push(step.getName());
        } else {
          this.logStepSkip(stepName);
          if (context.state.forceStop) {
            this.logger.log(
              `Force stop requested, halting pipeline after step: ${stepName}`,
            );
            break;
          }
        }
      }

      // Format the result to match ScraperResult structure
      return {
        success: context.state.errors.length === 0,
        ads: context.state.adsCollected,
        totalCount: context.state.adsCollected.length,
        executionTime: Date.now() - startTime,
        outputPath: context.options?.storage?.outputPath || '',
        errors: context.state.errors,
        includeAdsInResponse: context.options?.includeAdsInResponse || false,
      };
    } catch (error) {
      this.logger.error(`Pipeline execution failed`, error);
      return {
        success: false,
        ads: context.state.adsCollected,
        totalCount: context.state.adsCollected.length,
        executionTime: Date.now() - startTime,
        errors: [...context.state.errors, error as Error],
        includeAdsInResponse: context.options?.includeAdsInResponse || false,
      };
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
}
