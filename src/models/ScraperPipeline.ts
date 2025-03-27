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

    try {
      for (const step of this.steps) {
        if (step.shouldExecute(context)) {
          this.logger.log(`Executing step: ${step.getName()}`);
          await step.execute(context);
        } else {
          this.logger.log(`Skipping step: ${step.getName()}`);
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
          this.logger.error(
            `Failed to clean up step: ${step.getName()}`,
            error,
          );
        }
      }
    }
  }
}
