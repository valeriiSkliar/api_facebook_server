// src/auth/implementations/AuthenticationPipeline.ts
import { Page } from 'playwright';
import { AuthCredentials, AuthResult } from '@src/models';
import { IAuthenticationStep, AuthStepType } from '@src/interfaces';
import { BasePipeline } from '@src/interfaces';

export class AuthenticationPipeline extends BasePipeline<
  IAuthenticationStep,
  Page,
  AuthResult,
  AuthCredentials
> {
  private sessionRestored = false;

  /**
   * Set whether a session has been restored
   */
  setSessionRestored(restored: boolean): void {
    this.sessionRestored = restored;
  }

  async execute(
    page: Page,
    credentials: AuthCredentials,
  ): Promise<
    AuthResult<{
      startTime: number;
      executionTime: number;
      sessionRestored: boolean;
    }>
  > {
    const startTime = Date.now();

    for (const step of this.steps) {
      // Skip login steps if session was restored AND it's not a POST_SESSION step
      if (
        this.sessionRestored &&
        step.getType() === AuthStepType.LOGIN &&
        step.getType() !== AuthStepType.POST_SESSION
      ) {
        this.logStepSkip(step.getName(), 'session was restored');
        continue;
      }

      this.logStepExecution(step.getName());
      this.logger.log(`Executing authentication step: ${step.getName()}`);

      try {
        const success = await step.execute(page, credentials);
        // If this is the session restore step, update the session restored flag based on its result
        if (step.getType() === AuthStepType.PRE_SESSION) {
          this.setSessionRestored(success);
        }

        if (!success) {
          // If session restore failed, continue with other steps
          if (step.getType() === AuthStepType.PRE_SESSION) {
            this.logStepSkip(step.getName(), 'continuing with login steps');
            continue;
          }

          return {
            success: false,
            error: `Failed at authentication step: ${step.getName()}`,
            data: {
              startTime,
              executionTime: Date.now() - startTime,
              sessionRestored: this.sessionRestored,
            },
          };
        }
      } catch (error) {
        this.logStepError(step.getName(), error);

        // If session restore errored, continue with other steps
        if (step.getType() === AuthStepType.PRE_SESSION) {
          this.logger.log(
            'Session restore errored, continuing with login steps',
          );
          continue;
        }

        return {
          success: false,
          error: `Error in authentication step ${step.getName()}: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            startTime,
            executionTime: Date.now() - startTime,
            sessionRestored: this.sessionRestored,
          },
        };
      }
    }

    return {
      success: true,
      data: {
        startTime,
        executionTime: Date.now() - startTime,
        sessionRestored: this.sessionRestored,
      },
    };
  }
}
