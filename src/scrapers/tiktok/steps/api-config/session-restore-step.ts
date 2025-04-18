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
import { BrowserHelperService } from '@src/core/browser/helpers/BrowserHelperService';
import { IntegratedRequestCaptureService } from '@src/services/integrated-request-capture-service';
/**
 * Step responsible for restoring previously saved session states for TikTok API config contexts
 */
@Injectable()
export class SessionRestoreStep extends TiktokApiConfigStep {
  private readonly sessionRestoreService: SessionRestoreService;
  private requestCaptureService: IntegratedRequestCaptureService;

  private readonly minScrollPixels: number = 100;
  private readonly maxScrollPixels: number = 300;
  private readonly minDelay: number = 500;
  private readonly maxDelay: number = 1500;
  private readonly maxScrolls: number = 50;
  private readonly bottomMargin: number = 50;
  private interruptionRequested: boolean = false;

  // Add the browserHelper property back as a private readonly field
  private readonly browserHelper: BrowserHelperService;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly sessionStorageService: SessionStorageService,
    private readonly browserPoolService: BrowserPoolService,
  ) {
    super(name, logger);
    this.sessionRestoreService = new SessionRestoreService(logger);
    // Get the singleton instance directly
    this.browserHelper = BrowserHelperService.getInstance();
    // Set logger for the helper service instance
    this.browserHelper.setLogger(this.logger);
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
        // This is crucial for setting cookies and localStorage correctly.
        // Wrap in try-catch to handle navigation errors gracefully.
        this.logger.log(
          `Navigating page for session ${account.id} to TikTok domain...`,
        );
        try {
          await page.goto('https://www.tiktok.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          this.logger.log(
            `Page navigated successfully for session ${account.id}.`,
          );
        } catch (navError) {
          this.logger.error(
            `Navigation failed for session ${account.id}: ${navError instanceof Error ? navError.message : String(navError)}`,
          );
          if (page && !page.isClosed()) await page.close();
          if (browserInfo)
            await this.browserPoolService.clearContext(String(account.id));
          continue; // Skip to the next account if navigation fails
        }

        this.logger.log(
          `Attempting session restore for ${account.email} (Session ID: ${account.id}) using new page.`,
        );

        try {
          let sessionRestored = false;

          // Try to restore from database state first
          if (account.cookies.length > 0 || account.origins.length > 0) {
            this.logger.log(
              `Restoring session ${account.id} with ${account.cookies.length} cookies and ${account.origins.length} origins from database state`,
            );

            // Prepare storage state from database session
            const storageState =
              await this.sessionStorageService.getSessionState(account.id);

            // Check if page exists *and is open* before using it
            if (!page || page.isClosed()) {
              this.logger.error(
                `Page is null or closed for session ${account.id}, cannot restore from state.`,
              );
              throw new Error('Page object is null or closed');
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
              sessionRestored = true;
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
            // if (page && !page.isClosed()) await page.close();
            // Clear context if file path is missing
            if (browserInfo)
              await this.browserPoolService.clearContext(
                String(account.id),
                undefined,
                async (context) => {
                  this.logger.log(
                    `Callback: Closing pages for context of session ${account.id}`,
                  );
                  const closePromises = context.pages().map(async (page) => {
                    await this.scrollNaturally(page);
                    await page.close();
                  });
                  await Promise.allSettled(closePromises);
                  this.logger.log(
                    `Callback: Finished closing pages for context of session ${account.id}`,
                  );
                },
              );
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

          // Check if page exists *and is open* before using it
          if (!page || page.isClosed()) {
            this.logger.error(
              `Page is null or closed for session ${account.id}, cannot restore from file.`,
            );
            throw new Error('Page object is null or closed');
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
            sessionRestored = true;
          } else {
            this.logger.warn(
              `Failed to restore session from file for ${account.email}, will need new login`,
            );
            // Close the page and the context as restoration failed
            if (page && !page.isClosed()) await page.close();
            if (browserInfo)
              await this.browserPoolService.clearContext(
                String(account.id),
                undefined,
                async (context) => {
                  this.logger.log(
                    `Callback: Closing context of session ${account.id}`,
                  );
                  await context.close();
                  this.logger.log(
                    `Callback: Finished closing context of session ${account.id}`,
                  );
                },
              );
          }

          // --- Start Interception and Scrolling if session restored --- //
          if (sessionRestored && browserInfo) {
            // Close the temporary page used for restoration checks
            if (page && !page.isClosed()) {
              await page.close();
            }

            let interceptScrollPage: Page | null = null;
            try {
              this.logger.log(
                `Setting up interception and scrolling for restored session: ${account.email} (ID: ${account.id})`,
              );

              // Create a new page in the *restored* context
              interceptScrollPage = await browserInfo.context.newPage();

              // Navigate to a starting point
              await interceptScrollPage.goto(
                'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
                {
                  waitUntil: 'domcontentloaded',
                  timeout: 30000,
                },
              );

              // Initialize RequestCaptureService for this specific session
              this.requestCaptureService = new IntegratedRequestCaptureService(
                this.logger,
                account.id, // Pass the actual session ID
              );

              // Reset interruption flag before scrolling
              this.interruptionRequested = false;

              // Setup interception with callback to stop scrolling
              await this.requestCaptureService.setupInterception(
                interceptScrollPage,
                {
                  log: this.logger,
                  sessionId: account.id,
                  page: interceptScrollPage,
                  onFirstRequest: async () => {
                    this.logger.log(
                      `First request captured for session ${account.id}, stopping scroll.`,
                    );
                    // this.interruptionRequested = true;
                  },
                },
              );

              // Perform natural scrolling on the new page
              this.logger.log(
                `Starting natural scrolling for session ${account.id}...`,
              );
              await this.scrollNaturally(interceptScrollPage);
              this.logger.log(
                `Natural scrolling finished for session ${account.id}. Interrupted: ${this.interruptionRequested}`,
              );

              // Add the context to the list of successfully restored contexts
              context.state.restoredSessionContexts.push({
                sessionId: String(account.id),
                email: account.email,
                context: browserInfo.context,
              });
              successCount++;
            } catch (scrollInterceptError) {
              this.logger.error(
                `Error during interception/scrolling for session ${account.id}: ${scrollInterceptError}`,
              );
              // If scrolling/interception failed, we might still consider the session restored,
              // but we need to clean up the page and possibly the context.
              if (interceptScrollPage && !interceptScrollPage.isClosed()) {
                await interceptScrollPage.close();
              }
              // Decide if the context should be cleared based on the error
              // For now, let's assume the context is still potentially usable if restoration itself succeeded.
              // If the error implies context corruption, clear it:
              // await this.browserPoolService.clearContext(String(account.id));
              // Add to restored contexts even if scroll/intercept failed, as session *was* restored
              context.state.restoredSessionContexts.push({
                sessionId: String(account.id),
                email: account.email,
                context: browserInfo.context,
              });
              successCount++; // Count as success because session was restored
            } finally {
              // Ensure the intercept/scroll page is closed
              if (interceptScrollPage && !interceptScrollPage.isClosed()) {
                await interceptScrollPage.close();
              }
            }
          } else if (browserInfo && !sessionRestored) {
            // If session restore failed, ensure the context is cleared
            this.logger.warn(
              `Session restore failed for ${account.email}, clearing context.`,
            );
            await this.browserPoolService.clearContext(String(account.id));
          }
          // --- End Interception and Scrolling --- //
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
          // Ensure the *temporary* page is closed if it wasn't already (e.g., during file restore failure)
          // The interceptScrollPage is handled in its own try/catch/finally
          if (page && !page.isClosed()) {
            try {
              await page.close();
            } catch (closeError) {
              this.logger.warn(
                `Error closing page for session ${account.id}: ${closeError}`,
              );
            }
          }
          // We no longer unconditionally clear the context here.
          // Clearing happens on failure *inside* the try block or if sessionRestored is false.
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
          await this.browserPoolService.clearContext(
            String(account.id),
            undefined,
            async (context) => {
              this.logger.log(
                `Callback: Closing pages for context of session ${account.id}`,
              );
              const closePromises = context.pages().map((page) => page.close());
              await Promise.allSettled(closePromises);
              this.logger.log(
                `Callback: Finished closing pages for context of session ${account.id}`,
              );
            },
          );
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

  /**
   * Function for natural scrolling of the page, imitating human behavior
   * Scrolls the page step by step with small random variations
   * @param page - Playwright page instance
   * @returns Promise<number> Number of scrolls performed
   */
  private async scrollNaturally(page: Page): Promise<number> {
    // Get current page metrics
    const pageMetrics = await page.evaluate(() => {
      return {
        scrollHeight: document.body.scrollHeight,
        scrollTop: window.pageYOffset || document.documentElement.scrollTop,
        windowHeight: window.innerHeight,
      };
    });

    let currentScrollTop = pageMetrics.scrollTop;
    const maxScrollTop =
      pageMetrics.scrollHeight - pageMetrics.windowHeight - this.bottomMargin;
    let scrollCount = 0;

    // Continue scrolling until reaching bottom boundary or max scrolls count, or until interrupted
    while (
      currentScrollTop < maxScrollTop &&
      scrollCount < this.maxScrolls &&
      !this.interruptionRequested
    ) {
      // Generate random scroll amount
      const scrollAmount = this.browserHelper.randomBetween(
        this.minScrollPixels,
        this.maxScrollPixels,
      );

      // Calculate new scroll position, but don't scroll beyond max allowed position
      const newScrollTop = Math.min(
        currentScrollTop + scrollAmount,
        maxScrollTop,
      );

      // Perform smooth scrolling
      await page.evaluate((scrollTo) => {
        window.scrollTo({
          top: scrollTo,
          behavior: 'smooth',
        });
      }, newScrollTop);

      // Update current scroll position
      currentScrollTop = newScrollTop;
      scrollCount++;

      // Random delay between scrolls to imitate human behavior
      const randomDelay = this.browserHelper.randomBetween(
        this.minDelay,
        this.maxDelay,
      );

      // Before waiting, check if interruption was requested
      if (this.interruptionRequested) {
        break;
      }

      await this.browserHelper.delay(randomDelay);

      // Check again for interruption after the delay
      if (this.interruptionRequested) {
        break;
      }

      // Sometimes make an additional pause as if a human stopped to read content
      if (Math.random() < 0.3) {
        // 30% chance to make an additional pause
        const readingPause = this.browserHelper.randomBetween(1000, 3000);

        // Before additional pause, check if interruption was requested
        if (this.interruptionRequested) {
          break;
        }

        await this.browserHelper.delay(readingPause);

        // Check again for interruption after the reading pause
        if (this.interruptionRequested) {
          break;
        }
      }

      // Check if we reached the bottom of the page
      const newMetrics = await page.evaluate(() => {
        return {
          scrollHeight: document.body.scrollHeight,
          scrollTop: window.pageYOffset || document.documentElement.scrollTop,
          windowHeight: window.innerHeight,
        };
      });

      // If page height changed during scrolling (dynamic content loaded), update max scroll position
      if (newMetrics.scrollHeight !== pageMetrics.scrollHeight) {
        const newMaxScrollTop =
          newMetrics.scrollHeight - newMetrics.windowHeight - this.bottomMargin;

        // Only update if the new max is greater than the old max
        if (newMaxScrollTop > maxScrollTop) {
          currentScrollTop = newMetrics.scrollTop;
        }
      }
    }

    this.logger.log(`Natural scrolling: ${scrollCount} scrolls performed`);
    return scrollCount;
  }
}
