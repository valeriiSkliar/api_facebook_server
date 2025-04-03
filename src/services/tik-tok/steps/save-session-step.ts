import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { AuthCredentials, AuthenticatorContext } from '@src/models';
import { Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Step responsible for saving the current session state after successful authentication
 * Must be executed as a POST_SESSION step after successful login
 */
export class SaveSessionStep implements IAuthenticationStep {
  constructor(private readonly logger: Logger) {}

  getType(): AuthStepType {
    // This must be POST_SESSION to properly save the session after authentication
    return AuthStepType.POST_SESSION;
  }

  getName(): string {
    return 'Save Session';
  }

  /**
   * Execute session saving
   * @param context - Current authentication context
   * @param credentials - User credentials containing session path
   * @returns True if session was saved successfully, false otherwise
   */
  async execute(
    context: AuthenticatorContext,
    credentials?: AuthCredentials,
  ): Promise<boolean> {
    if (!context.state.page) {
      this.logger.error('No page found in context when trying to save session');
      return false;
    }

    if (!credentials || !credentials.sessionPath) {
      this.logger.warn(
        'No session path provided in credentials, using default path',
      );

      if (!credentials) {
        return false;
      }

      // Create default session path if none provided
      const sessionDir = './storage/sessions';
      await fs.ensureDir(sessionDir);
      credentials.sessionPath = path.join(
        sessionDir,
        `tiktok_${credentials.email.replace(/[@.]/g, '_')}.json`,
      );
    }

    try {
      // Ensure the parent directory exists
      await fs.ensureDir(path.dirname(credentials.sessionPath));

      this.logger.log(`Saving session state to ${credentials.sessionPath}`);

      // Get the current storage state including cookies and localStorage
      const storageState = await context.state.page.context().storageState();

      // Save the storage state to a file
      await fs.writeJson(credentials.sessionPath, storageState, { spaces: 2 });

      this.logger.log('Session state saved successfully');
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error saving session state: ${errorMessage}`);
      return false;
    }
  }
}
