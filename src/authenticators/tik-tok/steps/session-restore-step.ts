import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { Logger } from '@nestjs/common';
import { SessionRestoreService } from '../../../services/tik-tok/session-refresh/SessionRestoreService';
import * as fs from 'fs-extra';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';

/**
 * Step responsible for restoring a previously saved session state
 * Must be executed as a PRE_SESSION step before regular login steps
 */
export class SessionRestoreStep implements IAuthenticationStep {
  private readonly sessionRestoreService: SessionRestoreService;

  constructor(private readonly logger: Logger) {
    this.sessionRestoreService = new SessionRestoreService(logger);
  }

  getType(): AuthStepType {
    // This must be PRE_SESSION to properly affect session restoration logic
    return AuthStepType.PRE_SESSION;
  }

  getName(): string {
    return 'Session Restore';
  }

  /**
   * Execute session restoration
   * @param context - Current authentication context
   * @param credentials - User credentials containing session path
   * @returns True if session was restored successfully, false otherwise
   */
  async execute(
    context: AuthenticatorContext,
    credentials?: AuthCredentials,
  ): Promise<boolean> {
    if (!context.state.page) {
      this.logger.error(
        'No page found in context when trying to restore session',
      );
      return false;
    }

    if (!credentials || !credentials.sessionPath) {
      this.logger.log(
        'No session path provided in credentials, skipping session restore',
      );
      return false;
    }

    try {
      // Check if session file exists
      const sessionExists = await fs.pathExists(credentials.sessionPath);
      if (!sessionExists) {
        this.logger.log(
          `Session file not found at ${credentials.sessionPath}, skipping session restore`,
        );
        return false;
      }

      this.logger.log(
        `Attempting to restore session from ${credentials.sessionPath}`,
      );

      // Try to restore the session
      const result = await this.sessionRestoreService.restoreSession(
        context.state.page,
        credentials.sessionPath,
      );

      if (result) {
        this.logger.log('Session restored successfully');
      } else {
        this.logger.warn(
          'Failed to restore session, will proceed with normal login',
        );
      }

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during session restore: ${errorMessage}`);
      return false;
    }
  }
}
