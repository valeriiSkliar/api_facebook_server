import { Logger } from '@nestjs/common';
import { IPipeline } from './IPipeline';
import { IPipelineResult } from './IPipeline';
import { IPipelineStep } from './IPipeline';

/**
 * Abstract base pipeline class that implements common pipeline behavior
 */
export abstract class BasePipeline<
  TStep extends IPipelineStep<TContext, TCredentials>,
  TContext,
  TResult extends IPipelineResult,
  TCredentials = void,
> implements IPipeline<TStep, TContext, TResult, TCredentials>
{
  protected steps: TStep[] = [];

  constructor(protected readonly logger: Logger) {}

  /**
   * Add a step to the pipeline
   * @param step - The step to add
   * @returns The pipeline instance for chaining
   */
  addStep(step: TStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Execute all steps in the pipeline
   * Must be implemented by concrete pipelines
   * @param context - The execution context
   * @param credentials - Optional credentials needed for execution
   */
  abstract execute(
    context: TContext,
    credentials?: TCredentials,
  ): Promise<TResult>;

  /**
   * Log step execution
   * @param stepName - Name of the step being executed
   */
  protected logStepExecution(stepName: string): void {
    this.logger.log(`Executing step: ${stepName}`);
  }

  /**
   * Log step skipping
   * @param stepName - Name of the step being skipped
   * @param reason - Optional reason for skipping
   */
  protected logStepSkip(stepName: string, reason?: string): void {
    const message = reason
      ? `Skipping step: ${stepName} (${reason})`
      : `Skipping step: ${stepName}`;
    this.logger.log(message);
  }

  /**
   * Log error during step execution
   * @param stepName - Name of the step that failed
   * @param error - The error that occurred
   */
  protected logStepError(stepName: string, error: unknown): void {
    this.logger.error(
      `Error in step: ${stepName}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
