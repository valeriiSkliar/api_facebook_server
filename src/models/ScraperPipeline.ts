import { Logger } from '@nestjs/common';
import { ScraperContext } from '@src/models/ScraperContext';
import { ScraperResult } from '@src/models/ScraperResult';
import { IScraperStep } from '@src/interfaces/IScraperStep';

export class ScraperPipeline {
  private steps: IScraperStep[] = [];

  constructor(private readonly logger: Logger) {}

  addStep(step: IScraperStep): ScraperPipeline {
    this.steps.push(step);
    return this;
  }

  async execute(context: ScraperContext): Promise<ScraperResult> {
    const startTime = Date.now();
    const executedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        const stepName = step.getName();
        if (step.shouldExecute(context)) {
          this.logger.log(`Executing step: ${stepName}`);
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
          this.logger.log(`Skipping step: ${stepName}`);
          if (context.state.forceStop) {
            this.logger.log(
              `Force stop requested, halting pipeline after step: ${stepName}`,
            );
            break;
          }
        }
      }
      this.logger.log(
        `Pipeline executed ${executedSteps.length} steps: ${executedSteps.join(', ')}`,
      );

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
          this.logger.error(
            `Failed to clean up step: ${step.getName()}`,
            error,
          );
        }
      }
    }
  }
}
