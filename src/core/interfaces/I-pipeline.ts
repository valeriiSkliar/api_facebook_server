/**
 * Generic interface for pipeline steps
 * @template TContext - The context type used by the step
 * @template TCredentials - Optional credentials type used by the step
 */
export interface IPipelineStep<TContext, TCredentials = void> {
  /**
   * Get the name of the step
   */
  getName(): string;

  /**
   * Execute the step with given context and optional credentials
   * @param context - The execution context
   * @param credentials - Optional credentials needed for execution
   * @returns A promise that resolves to boolean indicating success or failure
   */
  execute(context: TContext, credentials?: TCredentials): Promise<boolean>;
}

/**
 * Generic result interface for pipeline execution
 * @template TData - Optional data type returned by the pipeline
 */
export interface IPipelineResult<TData = any> {
  success: boolean;
  error?: string;
  errors?: Error[];
  data?: TData;
  executionTime?: number;
}

/**
 * Generic pipeline interface
 * @template TStep - The type of steps used in this pipeline
 * @template TContext - The context type used for execution
 * @template TResult - The result type returned after execution
 * @template TCredentials - Optional credentials type needed for execution
 */
export interface IPipeline<
  TStep extends IPipelineStep<TContext, TCredentials>,
  TContext,
  TResult extends IPipelineResult,
  TCredentials = void,
> {
  /**
   * Add a step to the pipeline
   * @param step - The step to add
   * @returns The pipeline instance for chaining
   */
  addStep(step: TStep): this;

  /**
   * Execute the pipeline with given context and optional credentials
   * @param context - The execution context
   * @param credentials - Optional credentials needed for execution
   * @returns A promise that resolves to the result of execution
   */
  execute(context: TContext, credentials?: TCredentials): Promise<TResult>;
}
