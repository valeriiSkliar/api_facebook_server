/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  AuthStepType,
  IAuthenticationStep,
} from '@src/scrapers/common/interfaces';
import { Logger } from '@nestjs/common';
import { SessionRestoreService } from '../../../services/tik-tok/session-refresh/SessionRestoreService';
import * as fs from 'fs-extra';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { PrismaService } from '@src/database/prisma.service';
import { SessionStorageService } from '@src/services/session-manager';

/**
 * Step responsible for restoring a previously saved session state
 * Must be executed as a PRE_SESSION step before regular login steps
 */
export class SessionRestoreStep implements IAuthenticationStep {
  private readonly sessionRestoreService: SessionRestoreService;

  constructor(
    private readonly logger: Logger,
    private readonly prisma?: PrismaService,
    private readonly sessionStorageService?: SessionStorageService,
  ) {
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

    if (!credentials) {
      this.logger.log('No credentials provided, skipping session restore');
      return false;
    }

    try {
      // First try to find session in database
      if (this.prisma && this.sessionStorageService) {
        try {
          this.logger.log(`Looking for session by email: ${credentials.email}`);
          const session = await this.prisma.session.findFirst({
            where: {
              email: credentials.email,
              is_valid: true,
            },
            orderBy: {
              last_activity_timestamp: 'desc',
            },
          });

          if (session) {
            this.logger.log(
              `Found valid session ID: ${session.id} in database`,
            );
            credentials.sessionPath = session.storage_path;

            try {
              // Get session state from database
              const storageState =
                await this.sessionStorageService.getSessionState(session.id);
              this.logger.log(
                `Retrieved session state with ${storageState.cookies?.length ?? 0} cookies and ${storageState.origins?.length ?? 0} origins`,
              );

              // Try to restore from database state
              const result =
                await this.sessionRestoreService.restoreSessionFromState(
                  context.state.page,
                  storageState,
                );

              if (result) {
                this.logger.log('Session restored successfully from database');
                return true;
              } else {
                this.logger.warn(
                  'Failed to restore session from database, will try file backup',
                );
              }
            } catch (dbError) {
              this.logger.error(
                `Error retrieving session state from database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
              );
              this.logger.warn('Will try to fall back to file-based session');
            }
          } else {
            this.logger.log(
              `No valid session found for email ${credentials.email} in database`,
            );
          }
        } catch (dbLookupError) {
          this.logger.error(
            `Error looking up session in database: ${dbLookupError instanceof Error ? dbLookupError.message : String(dbLookupError)}`,
          );
        }
      }

      // Fall back to file-based session if available
      if (!credentials.sessionPath) {
        this.logger.log(
          'No session path provided, skipping file-based session restore',
        );
        return false;
      }

      // Check if session file exists
      const sessionExists = await fs.pathExists(credentials.sessionPath);
      if (!sessionExists) {
        this.logger.log(
          `Session file not found at ${credentials.sessionPath}, skipping session restore`,
        );
        return false;
      }

      this.logger.log(
        `Attempting to restore session from file: ${credentials.sessionPath}`,
      );

      // Try to restore the session from file
      const result = await this.sessionRestoreService.restoreSession(
        context.state.page,
        credentials.sessionPath,
      );

      if (result) {
        this.logger.log('Session restored successfully from file');
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
