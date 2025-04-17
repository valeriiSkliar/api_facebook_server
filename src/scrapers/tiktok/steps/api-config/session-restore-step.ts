import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import { PrismaService } from '@src/database/prisma.service';
import { SessionStorageService } from '@src/services/session-manager';
import { SessionRestoreService } from '@src/services';
import { BrowserPoolService } from '@src/core/browser/browser-pool';
import { TiktokApiConfigStep } from './api-config-step';
import {
  TiktokApiConfigContext,
  SessionWithRelations,
} from '../../pipelines/api-config/tiktok-api-config-types';
import { Browser, BrowserContext, Page } from 'playwright';

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
    private readonly browserPoolService: BrowserPoolService,
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
      !context.state.accountsWithValidSessions ||
      context.state.accountsWithValidSessions.length === 0
    ) {
      this.logger.log('No accounts with valid sessions found in state');
      return false;
    }

    let successCount = 0;
    const accountsToRestore: SessionWithRelations[] =
      context.state.accountsWithValidSessions;
    context.state.restoredSessionContexts = [];

    // Process each account with a valid session
    for (const account of accountsToRestore) {
      let browserInfo: { browser: Browser; context: BrowserContext } | null =
        null;
      let page: Page | null = null;
      try {
        // Get a dedicated browser context for this session restoration attempt
        this.logger.log(
          `Requesting browser context for session ID: ${account.id} (${account.email})`,
        );
        browserInfo = await this.browserPoolService.getBrowserForSessionRestore(
          String(account.id),
        );

        if (!browserInfo) {
          this.logger.error(
            `Failed to get browser context for session ${account.id}, skipping.`,
          );
          continue;
        }

        // Create a new page within the dedicated context
        page = await browserInfo.context.newPage();

        // Navigate to the target domain *before* attempting to restore session
        // This is crucial for setting cookies and localStorage correctly
        this.logger.log(
          `Navigating page for session ${account.id} to TikTok domain...`,
        );
        await page.goto('https://www.tiktok.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        }); // Added navigation
        this.logger.log(`Page navigated for session ${account.id}.`);

        this.logger.log(
          `Attempting session restore for ${account.email} (Session ID: ${account.id}) using new page.`,
        );

        try {
          // Try to restore from database state first
          if (account.cookies.length > 0 || account.origins.length > 0) {
            this.logger.log(
              `Restoring session ${account.id} with ${account.cookies.length} cookies and ${account.origins.length} origins from database state`,
            );

            // Prepare storage state from database session
            const storageState =
              await this.sessionStorageService.getSessionState(account.id);

            // Check if page exists before using it
            if (!page) {
              this.logger.error(
                `Page is null for session ${account.id}, cannot restore from state.`,
              );
              throw new Error('Page object is null');
            }

            // Try to restore from database state
            const result =
              await this.sessionRestoreService.restoreSessionFromState(
                page,
                storageState,
              );

            if (result) {
              this.logger.log(
                `Session restored successfully from database for ${account.email}`,
              );
              // Ensure context exists before pushing
              if (browserInfo) {
                context.state.restoredSessionContexts.push({
                  sessionId: String(account.id),
                  email: account.email,
                  context: browserInfo.context,
                });
                successCount++;
              } else {
                this.logger.warn(
                  `BrowserInfo became null unexpectedly after successful DB restore for session ${account.id}`,
                );
              }
              if (page && !page.isClosed()) await page.close(); // Close the page, keep context
              continue; // Move to the next account
            } else {
              this.logger.warn(
                `Failed to restore session from database for ${account.email}, will try file backup`,
              );
            }
          }

          // Fall back to file-based session if available
          if (!account.storage_path) {
            this.logger.log(
              `No session path available for ${account.email}, skipping file-based session restore`,
            );
            if (page && !page.isClosed()) await page.close();
            // Clear context if file path is missing
            if (browserInfo)
              await this.browserPoolService.clearContext(String(account.id));
            continue; // Move to the next account
          }

          // Check if session file exists
          const sessionExists = await fs.pathExists(account.storage_path);
          if (!sessionExists) {
            this.logger.log(
              `Session file not found at ${account.storage_path} for ${account.email}`,
            );
            if (page && !page.isClosed()) await page.close();
            // Clear context if file does not exist
            if (browserInfo)
              await this.browserPoolService.clearContext(String(account.id));
            continue; // Move to the next account
          }

          this.logger.log(
            `Attempting to restore session from file: ${account.storage_path} for ${account.email}`,
          );

          // Check if page exists before using it
          if (!page) {
            this.logger.error(
              `Page is null for session ${account.id}, cannot restore from file.`,
            );
            throw new Error('Page object is null');
          }

          // Try to restore the session from file
          const result = await this.sessionRestoreService.restoreSession(
            page,
            account.storage_path,
          );

          if (result) {
            this.logger.log(
              `Session restored successfully from file for ${account.email}`,
            );
            // Ensure context exists before pushing
            if (browserInfo) {
              context.state.restoredSessionContexts.push({
                sessionId: String(account.id),
                email: account.email,
                context: browserInfo.context,
              });
              successCount++;
            } else {
              this.logger.warn(
                `BrowserInfo became null unexpectedly after successful file restore for session ${account.id}`,
              );
            }
            // Keep context open on success, page is closed in finally block
          } else {
            this.logger.warn(
              `Failed to restore session from file for ${account.email}, will need new login`,
            );
            // Close the page and the context as restoration failed
            if (page && !page.isClosed()) await page.close();
            if (browserInfo)
              await this.browserPoolService.clearContext(String(account.id));
          }
        } catch (sessionError) {
          this.logger.error(
            `Error restoring session for ${account.email}: ${
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError)
            }`,
          );
          // Close the page and context on error
          if (page && !page.isClosed()) await page.close();
          if (browserInfo)
            await this.browserPoolService.clearContext(String(account.id));
        } finally {
          // Ensure page is closed if it wasn't already (e.g., successful restore)
          if (page && !page.isClosed()) {
            try {
              await page.close();
            } catch (closeError) {
              this.logger.warn(
                `Error closing page for session ${account.id}: ${closeError}`,
              );
            }
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error during session restore processing for account ${account.email} (Session ID: ${account.id}): ${errorMessage}`,
        );
        // Ensure cleanup happens even if context/page creation failed
        if (page && !page.isClosed()) {
          try {
            await page.close();
          } catch (closeError) {
            this.logger.warn(
              `Error closing page for session ${account.id}: ${closeError}`,
            );
          }
        }
        // Clear context if outer try-catch caught an error
        if (browserInfo) {
          await this.browserPoolService.clearContext(String(account.id));
        }
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
    // No specific cleanup required here, BrowserPoolService manages contexts.
    // If specific resources were created ONLY in this step, clean them here.
    this.logger.log(`Cleanup for ${this.name} - nothing specific to clean.`);
    return Promise.resolve();
  }
}
