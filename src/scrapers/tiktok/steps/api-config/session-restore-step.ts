import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import { PrismaService } from '@src/database/prisma.service';
import { SessionStorageService } from '@src/services/session-manager';
import { SessionRestoreService } from '@src/services';
import { TiktokApiConfigStep } from './api-config-step';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';

/**
 * Step responsible for restoring previously saved session states for TikTok API config contexts
 */
@Injectable()
export class SessionRestoreStep extends TiktokApiConfigStep {
  private readonly sessionRestoreService: SessionRestoreService;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly sessionStorageService: SessionStorageService,
  ) {
    super(name, logger);
    this.sessionRestoreService = new SessionRestoreService(logger);
  }

  /**
   * Execute session restoration for browser contexts
   * @param context - Current TikTok API config context
   * @returns True if at least one session was restored successfully, false otherwise
   */
  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    if (
      !context.state.browserContexts ||
      context.state.browserContexts.length === 0
    ) {
      this.logger.error('No browser contexts found in state');
      return false;
    }

    if (
      !context.state.accountsWithValidSessions ||
      context.state.accountsWithValidSessions.length === 0
    ) {
      this.logger.log('No accounts with valid sessions found in state');
      return false;
    }

    let successCount = 0;
    const browserContexts = context.state.browserContexts;
    const accountsToRestore = context.state.accountsWithValidSessions;

    // Process each account with a valid session
    for (const account of accountsToRestore) {
      try {
        // Find matching browser context for the account
        const browserContext = browserContexts.find(
          (ctx) => ctx.email === account.email,
        );

        if (!browserContext) {
          this.logger.warn(
            `No browser context found for account ${account.email}, skipping session restore.`,
          );
          continue;
        }

        if (!browserContext.page) {
          this.logger.warn(
            `No page in browser context for account ${account.email}, skipping session restore.`,
          );
          continue;
        }

        this.logger.log(
          `Found valid session ID: ${account.id} for ${browserContext.email} (context found)`,
        );

        try {
          // Try to restore from database state first
          if (account.cookies.length > 0 || account.origins.length > 0) {
            this.logger.log(
              `Restoring session with ${account.cookies.length} cookies and ${account.origins.length} origins from database state`,
            );

            // Prepare storage state from database session
            const storageState =
              await this.sessionStorageService.getSessionState(account.id);

            // Try to restore from database state
            const result =
              await this.sessionRestoreService.restoreSessionFromState(
                browserContext.page,
                storageState,
              );

            if (result) {
              this.logger.log(
                `Session restored successfully from database for ${browserContext.email}`,
              );
              browserContext.ready = true;
              successCount++;
              continue; // Move to the next account
            } else {
              this.logger.warn(
                `Failed to restore session from database for ${browserContext.email}, will try file backup`,
              );
            }
          }

          // Fall back to file-based session if available
          if (!account.storage_path) {
            this.logger.log(
              `No session path available for ${browserContext.email}, skipping file-based session restore`,
            );
            continue; // Move to the next account
          }

          // Check if session file exists
          const sessionExists = await fs.pathExists(account.storage_path);
          if (!sessionExists) {
            this.logger.log(
              `Session file not found at ${account.storage_path} for ${browserContext.email}`,
            );
            continue; // Move to the next account
          }

          this.logger.log(
            `Attempting to restore session from file: ${account.storage_path} for ${browserContext.email}`,
          );

          // Try to restore the session from file
          const result = await this.sessionRestoreService.restoreSession(
            browserContext.page,
            account.storage_path,
          );

          if (result) {
            this.logger.log(
              `Session restored successfully from file for ${browserContext.email}`,
            );
            browserContext.ready = true;
            successCount++;
          } else {
            this.logger.warn(
              `Failed to restore session from file for ${browserContext.email}, will need new login`,
            );
          }
        } catch (sessionError) {
          this.logger.error(
            `Error restoring session for ${browserContext.email}: ${
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError)
            }`,
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error during session restore processing for account ${account.email}: ${errorMessage}`,
        );
      }
    }

    // Return success if at least one session was restored
    if (successCount > 0) {
      this.logger.log(
        `Successfully restored ${successCount} out of ${accountsToRestore.length} potential sessions`,
      );
      return true;
    }

    this.logger.warn('Failed to restore any sessions');
    return false;
  }

  /**
   * Clean up any resources used by this step
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async cleanup(context: TiktokApiConfigContext): Promise<void> {
    // No specific cleanup required for this step
  }
}
