/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Page } from 'playwright';
import * as fs from 'fs-extra';
import { BrowserHelperService } from '@src/services';
import { Logger } from '@nestjs/common';
/**
 * Service for restoring saved browser sessions
 */
export class SessionRestoreService {
  private logger: Logger;
  private browserHelperService: BrowserHelperService;

  /**
   * Creates a new SessionRestoreService instance
   * @param logger Logger instance
   */
  constructor(logger: Logger) {
    this.logger = logger;
    this.browserHelperService = BrowserHelperService.getInstance();
  }

  /**
   * Attempts to restore a previously saved session state
   * @param page - Playwright Page instance
   * @param sessionPath - Path to the session state file
   * @returns Promise<boolean> - True if session was restored successfully
   */
  async restoreSession(page: Page, sessionPath: string): Promise<boolean> {
    try {
      await fs.access(sessionPath);
      this.logger.log(
        '[SessionRestoreService] Found saved session state, attempting to restore...',
        {
          sessionPath,
        },
      );

      // Clear existing storage before restoring
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(';').forEach((c) => {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        });
      });

      // Restore the stored state
      const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

      // Extract cookies from the session data
      const cookies = sessionData.cookies;
      if (!Array.isArray(cookies)) {
        throw new Error('Invalid session data: cookies array not found');
      }

      try {
        // Add cookies first
        await page.context().addCookies(cookies);

        // First navigate to a simple page to initialize context
        try {
          await page.goto('about:blank', { timeout: 5000 });
        } catch (error: unknown) {
          const initError = error as Error;
          this.logger.debug(
            '[SessionRestoreService] Initial navigation to blank page failed:',
            {
              error: initError.message,
            },
          );
        }

        // Wait for cookies to be properly set
        await page.waitForTimeout(1000);

        // Navigate to the main page to verify session
        await page.goto(
          'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
          {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          },
        );

        // Verify that we're actually logged in
        const isLoggedIn = await this.browserHelperService.isLoggedIn(page);
        if (!isLoggedIn) {
          throw new Error(
            'Session restoration failed: not logged in after restoring cookies',
          );
        }

        this.logger.log(
          '[SessionRestoreService] Session restored successfully',
        );
        return true;
      } catch (error) {
        this.logger.error(
          '[SessionRestoreService] Failed to restore session state:',
          { error: (error as Error).message },
        );
        // Clear everything on failure
        await page.context().clearCookies();
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        throw error;
      }
    } catch (err: unknown) {
      this.logger.error(
        '[SessionRestoreService] Error restoring session state:',
        { error: (err as Error).message },
      );
      this.logger.log(
        '[SessionRestoreService] No saved session found or error restoring session, proceeding with normal login',
      );
      return false;
    }
  }
}
