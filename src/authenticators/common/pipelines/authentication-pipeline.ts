import { BasePipeline } from '@core/interfaces';
import { AuthenticatorContext } from '../models/authenticator-context';
import { AuthResult } from '../models/auth-result';
import { AuthCredentials } from '../models/auth-credentials';
import {
  AuthStepType,
  IAuthenticationStep,
} from '@src/scrapers/common/interfaces';

export class AuthenticationPipeline extends BasePipeline<
  IAuthenticationStep,
  AuthenticatorContext,
  AuthResult,
  AuthCredentials
> {
  private sessionRestored = false;
  private sessionRestoreAttempted = false;

  /**
   * Set whether a session has been restored
   */
  setSessionRestored(restored: boolean): void {
    this.sessionRestored = restored;
    this.sessionRestoreAttempted = true;

    // Явно логируем состояние для отладки
    this.logger.log(`Session restored flag set to: ${restored}`);
  }

  /**
   * Явно сбрасываем флаг восстановления сессии
   */
  resetSessionRestored(): void {
    this.sessionRestored = false;
    // Явно логируем сброс для отладки
    this.logger.log('Session restored flag was reset to false');
  }

  async execute(
    context: AuthenticatorContext,
    credentials: AuthCredentials,
  ): Promise<
    AuthResult<{
      startTime: number;
      executionTime: number;
      sessionRestored: boolean;
    }>
  > {
    const startTime = Date.now();

    this.sessionRestored = false;
    this.sessionRestoreAttempted = false;

    if (!context.state.page) {
      return {
        success: false,
        error: 'No page available in context',
        data: {
          startTime,
          executionTime: Date.now() - startTime,
          sessionRestored: false,
        },
      };
    }

    for (const step of this.steps) {
      const stepType = step.getType();

      if (
        this.sessionRestoreAttempted &&
        this.sessionRestored &&
        stepType === AuthStepType.LOGIN
      ) {
        this.logStepSkip(step.getName(), 'session was restored');
        continue;
      }

      this.logStepExecution(step.getName());
      this.logger.log(`Executing authentication step: ${step.getName()}`);

      try {
        const success = await step.execute(context, credentials);

        if (stepType === AuthStepType.PRE_SESSION) {
          if (step.getName().toLowerCase().includes('session')) {
            this.setSessionRestored(success);
            this.logger.log(
              `Session restore attempt: ${success ? 'successful' : 'failed'}`,
            );
          }
        }

        if (!success) {
          if (stepType === AuthStepType.PRE_SESSION) {
            this.logStepSkip(step.getName(), 'continuing with login steps');
            this.resetSessionRestored();
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

        if (stepType === AuthStepType.PRE_SESSION) {
          this.logger.log(
            'Session restore errored, continuing with login steps',
          );
          this.resetSessionRestored();
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
