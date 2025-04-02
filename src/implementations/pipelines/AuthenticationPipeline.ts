// src/auth/implementations/AuthenticationPipeline.ts
import { Page } from 'playwright';
import { Log } from 'crawlee';
import { AuthCredentials, AuthResult } from '@src/models';
import { IAuthenticationStep, AuthStepType } from '@src/interfaces';

export class AuthenticationPipeline {
  private steps: IAuthenticationStep[] = [];
  private logger: Log;
  private sessionRestored = false;

  constructor(logger: Log) {
    this.logger = logger;
  }

  addStep(step: IAuthenticationStep): AuthenticationPipeline {
    this.steps.push(step);
    return this;
  }

  setSessionRestored(restored: boolean): void {
    this.sessionRestored = restored;
  }

  async execute(page: Page, credentials: AuthCredentials): Promise<AuthResult> {
    for (const step of this.steps) {
      // Skip login steps if session was restored AND it's not a POST_SESSION step
      if (
        this.sessionRestored &&
        step.getType() === AuthStepType.LOGIN &&
        step.getType() !== AuthStepType.POST_SESSION
      ) {
        this.logger.info(
          `Skipping login step ${step.getName()} as session was restored`,
        );
        continue;
      }

      this.logger.info(`Executing authentication step: ${step.getName()}`);

      try {
        const success = await step.execute(page, credentials);
        // If this is the session restore step, update the session restored flag based on its result
        if (step.getType() === AuthStepType.PRE_SESSION) {
          this.setSessionRestored(success);
        }

        if (!success) {
          // If session restore failed, continue with other steps
          if (step.getType() === AuthStepType.PRE_SESSION) {
            this.logger.info(
              'Session restore failed, continuing with login steps',
            );
            continue;
          }
          return {
            success: false,
            error: `Failed at authentication step: ${step.getName()}`,
          };
        }
      } catch (error) {
        this.logger.error(`Error in authentication step: ${step.getName()}`, {
          error: error instanceof Error ? error.message : String(error),
        });

        // If session restore errored, continue with other steps
        if (step.getType() === AuthStepType.PRE_SESSION) {
          this.logger.info(
            'Session restore errored, continuing with login steps',
          );
          continue;
        }

        return {
          success: false,
          error: `Error in authentication step ${step.getName()}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return { success: true };
  }
}
