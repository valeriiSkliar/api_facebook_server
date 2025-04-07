import { Injectable, Logger } from '@nestjs/common';
import { chromium, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  BrowserState,
  BrowserInstance,
  BrowserCreationOptions,
  BrowserOperationResult,
} from '../browser-pool/types';
import { TabManager, BrowserTab } from '../tab-manager/tab-manager';
import { Env } from '@src/config';

@Injectable()
export class BrowserLifecycleManager {
  private readonly logger = new Logger(BrowserLifecycleManager.name);
  private readonly MAX_TABS_PER_BROWSER = 10;
  private activePages = new Map<string, Page>();

  constructor(private readonly tabManager: TabManager) {}

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
        headless: Boolean(Env.IS_PRODUCTION),
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
        openTabs: 0,
        tabIds: [],
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

      // Close all tabs for this browser
      await this.tabManager.closeAllTabsForBrowser(instance.id);

      for (const tabId of instance.tabIds) {
        const page = this.activePages.get(tabId);
        if (page && !page.isClosed()) {
          await page.close();
        }
        this.activePages.delete(tabId);
      }

      // Close the browser
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
   * Create a new tab in a browser
   * @param instance - Browser instance
   * @param requestId - Request ID (optional for system operations)
   * @param userId - User ID (optional for system operations)
   * @param userEmail - User email
   */
  async createTab(
    instance: BrowserInstance,
    requestId?: string,
    userId?: string,
    userEmail?: string,
  ): Promise<{ tab: BrowserTab; page: Page } | null> {
    if (!instance || !instance.browser) {
      this.logger.error(`Invalid browser instance when creating tab`);
      return null;
    }

    let page: Page | null = null;
    let tab: BrowserTab | null = null;

    try {
      // Check if browser has capacity
      if (instance.openTabs >= this.MAX_TABS_PER_BROWSER) {
        this.logger.warn(
          `Browser ${instance.id} has reached maximum tab capacity`,
        );
        return null;
      }

      // Create a new page in the browser
      page = await instance.browser.newPage();

      // Create the tab in TabManager
      tab = await this.tabManager.createTab(
        instance.id,
        requestId,
        userId,
        userEmail,
      );

      if (tab && page && !page.isClosed()) {
        this.activePages.set(tab.id, page);
        this.logger.log(`Associated Page object with tab ${tab.id}`);

        // Update browser instance
        instance.openTabs++;
        instance.tabIds.push(tab.id);
        instance.lastUsedAt = new Date();

        // Update browser state if this is the first tab
        if (instance.openTabs === 1) {
          instance.state = BrowserState.IN_USE;
        }

        this.logger.log(
          `Created tab ${tab.id} in browser ${instance.id} for request ${tab.requestId}`,
        );
        return { tab, page };
      } else {
        this.logger.error(
          `Failed to create valid page or tab for browser ${instance.id}. Page closed: ${page?.isClosed()}. Tab created: ${!!tab}`,
        );
        if (page && !page.isClosed())
          await page
            .close()
            .catch((e) =>
              this.logger.error(
                `Error closing page during failed tab creation: ${e}`,
              ),
            );
        if (tab)
          await this.tabManager
            .closeTab(tab.id)
            .catch((e) =>
              this.logger.error(
                `Error closing tab metadata during failed tab creation: ${e}`,
              ),
            );
        return null;
      }
    } catch (error) {
      this.logger.error(`Error creating tab in browser ${instance.id}:`, error);
      if (page && !page.isClosed())
        await page
          .close()
          .catch((e) =>
            this.logger.error(
              `Error closing page after failed tab creation: ${e}`,
            ),
          );
      if (tab)
        await this.tabManager
          .closeTab(tab.id)
          .catch((e) =>
            this.logger.error(
              `Error closing tab metadata after failed tab creation: ${e}`,
            ),
          );
      return null;
    }
  }

  /**
   * Create a system tab not associated with any request
   * @param instance - Browser instance
   * @param sessionId - Optional session identifier
   * @param userEmail - Optional user email
   */
  async createSystemTab(
    instance: BrowserInstance,
    sessionId?: string,
    userEmail?: string,
  ): Promise<{ tab: BrowserTab; page: Page } | null> {
    if (!instance || !instance.browser) {
      this.logger.error(`Invalid browser instance when creating system tab`);
      return null;
    }

    let page: Page | null = null;
    let tab: BrowserTab | null = null;

    try {
      // Check if browser has capacity (optional, system tabs might have different rules)
      if (instance.openTabs >= this.MAX_TABS_PER_BROWSER) {
        this.logger.warn(
          `Browser ${instance.id} has reached maximum tab capacity when creating system tab`,
        );
        return null;
      }

      // Create a new page in the browser
      page = await instance.browser.newPage();

      // Create the tab in TabManager with system identifiers
      tab = await this.tabManager.createSystemTab(
        instance.id,
        sessionId,
        userEmail,
      );

      if (tab && page && !page.isClosed()) {
        this.activePages.set(tab.id, page);
        this.logger.log(`Associated Page object with system tab ${tab.id}`);

        // Update browser instance
        instance.openTabs++;
        instance.tabIds.push(tab.id);
        instance.lastUsedAt = new Date();

        // Update browser state if this is the first tab
        if (instance.openTabs === 1) {
          instance.state = BrowserState.IN_USE;
        }

        this.logger.log(
          `Created system tab ${tab.id} in browser ${instance.id}`,
        );
        return { tab, page };
      } else {
        this.logger.error(
          `Failed to create valid page or system tab for browser ${instance.id}. Page closed: ${page?.isClosed()}. Tab created: ${!!tab}`,
        );
        if (page && !page.isClosed())
          await page
            .close()
            .catch((e) =>
              this.logger.error(
                `Error closing page during failed system tab creation: ${e}`,
              ),
            );
        if (tab)
          await this.tabManager
            .closeTab(tab.id)
            .catch((e) =>
              this.logger.error(
                `Error closing tab metadata during failed system tab creation: ${e}`,
              ),
            );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Error creating system tab in browser ${instance.id}:`,
        error,
      );
      if (page && !page.isClosed())
        await page
          .close()
          .catch((e) =>
            this.logger.error(
              `Error closing page after failed system tab creation: ${e}`,
            ),
          );
      if (tab)
        await this.tabManager
          .closeTab(tab.id)
          .catch((e) =>
            this.logger.error(
              `Error closing tab metadata after failed system tab creation: ${e}`,
            ),
          );
      return null;
    }
  }

  /**
   * Close a tab and release its resources
   * @param instance - Browser instance
   * @param tabId - ID of the tab to close
   */
  async closeTab(instance: BrowserInstance, tabId: string): Promise<boolean> {
    if (!instance || !instance.browser) {
      this.logger.error(
        `Invalid browser instance ${instance?.id} when trying to close tab ${tabId}`,
      );
      return false;
    }

    const page = this.activePages.get(tabId);
    let pageClosedSuccessfully = false;

    if (page) {
      if (!page.isClosed()) {
        try {
          await page.close();
          this.logger.log(`Playwright page for tab ${tabId} closed.`);
          pageClosedSuccessfully = true;
        } catch (closeError) {
          this.logger.error(
            `Error closing Playwright page for tab ${tabId}:`,
            closeError,
          );
        }
      } else {
        this.logger.warn(
          `Playwright page object for tab ${tabId} was already closed.`,
        );
        pageClosedSuccessfully = true;
      }
    } else {
      this.logger.warn(
        `Playwright page object not found in activePages for tab ${tabId} during closure.`,
      );
      pageClosedSuccessfully = true;
    }

    if (pageClosedSuccessfully) {
      this.activePages.delete(tabId);
      this.logger.log(`Removed page mapping for tab ${tabId}`);
    }

    const tabManagerCloseSuccess = await this.tabManager.closeTab(tabId);

    if (tabManagerCloseSuccess) {
      instance.openTabs = Math.max(0, instance.openTabs - 1);
      instance.tabIds = instance.tabIds.filter((id) => id !== tabId);
      instance.lastUsedAt = new Date();
      if (instance.openTabs === 0) {
        instance.state = BrowserState.AVAILABLE;
        this.logger.log(
          `Browser ${instance.id} is now available (0 tabs open).`,
        );
      }
      this.logger.log(
        `Closed tab metadata for ${tabId} in browser ${instance.id}. Open tabs: ${instance.openTabs}`,
      );
      return true;
    } else {
      this.logger.warn(
        `Failed to close tab metadata in TabManager for tab ${tabId}. Browser state might be inconsistent.`,
      );
      return false;
    }
  }

  /**
   * Get the Page object associated with a tab ID
   * @param tabId - ID of the tab
   */
  getPageForTab(tabId: string): Page | null {
    const page = this.activePages.get(tabId);
    if (page) {
      if (!page.isClosed()) {
        this.logger.debug(`Page found for tab ${tabId}. Is closed: false`);
        return page;
      } else {
        this.logger.warn(
          `Page found for tab ${tabId}, but it is already closed.`,
        );
        this.activePages.delete(tabId);
        return null;
      }
    }
    this.logger.warn(`Page object not found in activePages for tab ${tabId}.`);
    return null;
  }

  /**
   * Gets the browser instance associated with a tab ID
   * Note: This is a simplified version that returns just the ID, not the full browser object
   */
  async getBrowserForTab(tabId: string): Promise<{ id: string } | null> {
    try {
      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        this.logger.warn(`No tab found with ID ${tabId}`);
        return null;
      }

      return tab.browserId ? { id: tab.browserId } : null;
    } catch (error) {
      this.logger.error(`Error getting browser for tab ${tabId}:`, error);
      return null;
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

  /**
   * Check if a browser has available capacity for more tabs
   * @param instance - The browser instance to check
   */
  hasBrowserCapacity(instance: BrowserInstance): boolean {
    return instance && instance.openTabs < this.MAX_TABS_PER_BROWSER;
  }
}
