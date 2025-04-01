// src/services/browser-pool/browser-lifecycle-manager.ts

import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  BrowserState,
  BrowserInstance,
  BrowserCreationOptions,
  BrowserOperationResult,
} from './types';

@Injectable()
export class BrowserLifecycleManager {
  private readonly logger = new Logger(BrowserLifecycleManager.name);

  /**
   * Create a new browser instance
   * @param options - Browser creation options
   */
  async createBrowser(
    options?: BrowserCreationOptions,
  ): Promise<BrowserOperationResult<BrowserInstance>> {
    const startTime = Date.now();
    const browserId = uuidv4();

    try {
      this.logger.log(`Creating new browser with ID: ${browserId}`);

      // Launch playwright browser with appropriate options
      const browser = await chromium.launch({
        headless: options?.headless ?? true,
        slowMo: options?.slowMo ?? 50,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--remote-debugging-max-buffer-size-megabytes=100',
          ...(options?.extraArgs || []),
        ],
      });

      // Create and return the browser instance object
      const now = new Date();
      const expiryTime = 15 * 60 * 1000; // 15 minutes in milliseconds

      const instance: BrowserInstance = {
        id: browserId,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + expiryTime),
        state: BrowserState.AVAILABLE,
        browser,
        metrics: {
          creationTime: Date.now() - startTime,
          requestsServed: 0,
          errors: 0,
        },
      };

      // Set up automatic cleanup on disconnect
      browser.on('disconnected', () => {
        this.logger.log(`Browser ${browserId} disconnected automatically`);
      });

      this.logger.log(
        `Browser ${browserId} created successfully in ${instance?.metrics?.creationTime ?? 0}ms`,
      );

      return {
        success: true,
        browserId,
        data: instance,
      };
    } catch (error) {
      this.logger.error(`Failed to create browser ${browserId}:`, error);

      return {
        success: false,
        browserId,
        error: error as Error,
      };
    }
  }

  /**
   * Close a browser instance and clean up resources
   * @param instance - The browser instance to close
   */
  async closeBrowser(
    instance: BrowserInstance,
  ): Promise<BrowserOperationResult> {
    if (!instance || !instance.browser) {
      return {
        success: false,
        browserId: instance?.id,
        error: new Error('Invalid browser instance'),
      };
    }

    try {
      // Update state to indicate closing
      instance.state = BrowserState.CLOSING;

      this.logger.log(`Closing browser ${instance.id}`);
      await instance.browser.close();

      this.logger.log(`Browser ${instance.id} closed successfully`);
      return {
        success: true,
        browserId: instance.id,
      };
    } catch (error) {
      this.logger.error(`Error closing browser ${instance.id}:`, error);

      return {
        success: false,
        browserId: instance.id,
        error: error as Error,
      };
    }
  }

  /**
   * Perform a health check on a browser instance
   * @param instance - The browser instance to check
   */
  async checkBrowserHealth(instance: BrowserInstance): Promise<boolean> {
    if (!instance || !instance.browser) {
      return false;
    }

    try {
      // A simple check - create a new context to verify browser is still operational
      const context = await instance.browser.newContext();
      await context.close();

      // Update health check info
      instance.healthCheck = new Date();
      instance.healthStatus = true;

      return true;
    } catch (error) {
      this.logger.warn(
        `Health check failed for browser ${instance.id}:`,
        error,
      );

      instance.healthCheck = new Date();
      instance.healthStatus = false;

      return false;
    }
  }

  /**
   * Extend the session of a browser instance
   * @param instance - The browser instance to extend
   * @param durationSeconds - How long to extend the session in seconds
   */
  extendBrowserSession(
    instance: BrowserInstance,
    durationSeconds: number = 15 * 60,
  ): void {
    if (!instance) return;

    const now = new Date();
    instance.lastUsedAt = now;
    instance.expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    this.logger.debug(
      `Extended session for browser ${instance.id} by ${durationSeconds} seconds`,
    );
  }
}
