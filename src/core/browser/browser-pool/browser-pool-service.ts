/* eslint-disable no-useless-escape */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Page, Browser, BrowserContext } from 'playwright';
import {
  BrowserState,
  BrowserInstance,
  BrowserPoolConfig,
  BrowserCallback,
} from './types';
import { BrowserLifecycleManager } from '../lifecycle/browser-lifecycle-manager';
import { BrowserStorageService } from './browser-storage-service';
import { BrowserMetricsService } from './browser-metrics-service';
import { TabManager, BrowserTab } from '../tab-manager/tab-manager';
import { Env } from '@src/config';

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);

  // In-memory storage for active browser instances
  private readonly activeBrowsers: Map<string, BrowserInstance> = new Map();
  // Map to store session contexts { sessionId: { browserId: string, context: BrowserContext } }
  private readonly sessionContexts: Map<
    string,
    { browserId: string; context: BrowserContext }
  > = new Map();

  // Pool configuration
  private readonly config: BrowserPoolConfig;

  // Timers for periodic tasks
  private cleanupTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private preWarmTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly lifecycleManager: BrowserLifecycleManager,
    private readonly storageService: BrowserStorageService,
    private readonly metricsService: BrowserMetricsService,
    private readonly tabManager: TabManager,
  ) {
    // Initialize configuration with defaults and environment variables
    this.config = {
      minPoolSize: parseInt(process.env.MIN_BROWSER_INSTANCES || '2', 10),
      maxPoolSize: parseInt(process.env.MAX_BROWSER_INSTANCES || '10', 10),
      maxTabsPerBrowser: parseInt(process.env.MAX_TABS_PER_BROWSER || '10', 10),
      browserTTL: parseInt(process.env.BROWSER_TTL || '900', 10), // 15 minutes
      tabTTL: parseInt(process.env.TAB_TTL || '600', 10), // 10 minutes
      healthCheckInterval: parseInt(
        process.env.HEALTH_CHECK_INTERVAL || '60000',
        10,
      ), // 1 minute
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '60000', 10), // 1 minute
      preWarmingEnabled: process.env.PREWARM_ENABLED === 'true',
      preWarmThreshold: parseInt(process.env.PREWARM_THRESHOLD || '50', 10), // 50%
    };

    this.logger.log(
      `Initialized browser pool with config: ${JSON.stringify(this.config)}`,
    );
  }

  getMaxTabsPerBrowser(): number {
    return this.config.maxTabsPerBrowser || 10;
  }

  /**
   * Initialize the service when the module starts
   */
  async onModuleInit() {
    // Synchronize with Redis on startup
    await this.synchronizeBrowsers();

    // Start periodic tasks
    this.startPeriodicTasks();

    // Pre-warm the pool if enabled
    if (this.config.preWarmingEnabled) {
      await this.preWarmPool();
    }

    this.logger.log('Browser pool service initialized');
  }

  /**
   * Clean up resources when the module is destroyed
   */
  async onModuleDestroy() {
    // Stop periodic tasks
    this.stopPeriodicTasks();

    // Clean up all session contexts first
    this.logger.log('Closing all managed session contexts...');
    const contextClearPromises = Array.from(this.sessionContexts.keys()).map(
      (sessionId) => this.clearContext(sessionId),
    );
    await Promise.allSettled(contextClearPromises);
    this.logger.log('Finished closing session contexts.');

    // Close all active browsers
    await this.closeAllBrowsers();

    this.logger.log('Browser pool service shut down');
  }

  /**
   * Find a browser with available capacity for a new tab
   */
  async getBrowserWithCapacity(): Promise<BrowserInstance | null> {
    try {
      const allBrowsers = Array.from(this.activeBrowsers.values());
      this.logger.debug(
        `Checking ${allBrowsers.length} active browsers for capacity (maxTabs: ${this.config.maxTabsPerBrowser}).`,
      );

      const availableBrowsers = allBrowsers.filter((browser) => {
        const hasCapacity = browser.openTabs < this.config.maxTabsPerBrowser!;
        const isAvailableState = browser.state !== BrowserState.CLOSING; // Убедитесь, что этот статус корректен
        const isHealthy = browser.healthStatus !== false; // Проверка здоровья
        this.logger.debug(
          ` -> Browser <span class="math-inline">\{browser\.id\.substring\(0, 8\)\}\: state\=</span>{browser.state}, tabs=<span class="math-inline">\{browser\.openTabs\}, hasCapacity\=</span>{hasCapacity}, isAvailableState=<span class="math-inline">\{isAvailableState\}, isHealthy\=</span>{isHealthy}`,
        );
        return hasCapacity && isAvailableState && isHealthy;
      });

      this.logger.debug(
        `Found ${availableBrowsers.length} browsers potentially suitable.`,
      );

      if (availableBrowsers.length === 0) {
        this.logger.log('No browsers found with capacity.');
        return null;
      }

      // Сортировка для выбора наименее загруженного
      availableBrowsers.sort((a, b) => a.openTabs - b.openTabs);
      const chosenBrowser = availableBrowsers[0];
      this.logger.log(
        `Selected browser ${chosenBrowser.id.substring(0, 8)} with ${chosenBrowser.openTabs} tabs.`,
      );
      return await new Promise((resolve) => {
        resolve(chosenBrowser);
      });
    } catch (error) {
      this.logger.error('Error in getBrowserWithCapacity:', error);
      return null;
    }
  }

  /**
   * Create a tab for a specific request
   */
  async createTabForRequest(
    requestId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ browserId: string; tabId: string; page?: Page } | null> {
    try {
      // First try to find a browser with capacity
      let browser = await this.getBrowserWithCapacity();

      // If no browser with capacity, create a new one
      if (!browser) {
        if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
          this.logger.warn(
            `Cannot create browser: max limit of ${this.config.maxPoolSize} reached`,
          );
          return null;
        }

        // Create a new browser
        const result = await this.lifecycleManager.createBrowser({
          headless: Boolean(Env.IS_PRODUCTION),

          slowMo: 50,
        });

        if (!result.success || !result.data) {
          this.logger.error('Failed to create browser:', result.error);
          return null;
        }

        browser = result.data;
        this.activeBrowsers.set(browser.id, browser);

        // Record metrics
        this.metricsService.recordBrowserCreation(
          browser.metrics?.creationTime || 0,
        );

        // Store in Redis
        await this.storageService.saveBrowser(browser, this.config.browserTTL);
      }

      // Create a tab in the browser
      const tabResult = await this.lifecycleManager.createTab(
        browser,
        requestId,
        userId,
        userEmail,
      );

      if (!tabResult) {
        this.logger.error(`Failed to create tab in browser ${browser.id}`);
        return null;
      }

      const { tab, page } = tabResult;

      // Update browser in Redis
      await this.storageService.saveBrowser(browser, this.config.browserTTL);

      this.logger.log(
        `Created tab ${tab.id} in browser ${browser.id} for request ${requestId}`,
      );

      return {
        browserId: browser.id,
        tabId: tab.id,
        page,
      };
    } catch (error) {
      this.logger.error(`Error creating tab for request ${requestId}:`, error);
      this.metricsService.recordError();
      return null;
    }
  }

  /**
   * Create a system tab for session management or other system operations
   * not tied to a specific user request
   */
  async createSystemTabForSession(
    sessionId?: string,
    userEmail?: string,
  ): Promise<{ browserId: string; tabId: string; page: Page } | null> {
    try {
      // Get or create a browser
      let browser = await this.getBrowserWithCapacity();

      // If no browser with capacity, create a new one
      if (!browser) {
        if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
          this.logger.warn(
            `Cannot create browser: max limit of ${this.config.maxPoolSize} reached`,
          );
          return null;
        }

        // Create a new browser
        const result = await this.lifecycleManager.createBrowser({
          headless: Boolean(Env.IS_PRODUCTION),
          slowMo: 50,
        });

        if (!result.success || !result.data) {
          this.logger.error('Failed to create browser:', result.error);
          return null;
        }

        browser = result.data;
        this.activeBrowsers.set(browser.id, browser);

        // Record metrics
        this.metricsService.recordBrowserCreation(
          browser.metrics?.creationTime || 0,
        );

        // Save in Redis
        await this.storageService.saveBrowser(browser, this.config.browserTTL);
      }

      // Create a system tab in the browser
      const systemId = sessionId || `system_${Date.now()}`;
      const tabResult = await this.lifecycleManager.createSystemTab(
        browser,
        systemId,
        userEmail,
      );

      if (!tabResult) {
        this.logger.error(
          `Failed to create system tab in browser ${browser.id}`,
        );
        return null;
      }

      const { tab, page } = tabResult;

      // Update browser in Redis
      await this.storageService.saveBrowser(browser, this.config.browserTTL);

      this.logger.log(
        `Created system tab ${tab.id} in browser ${browser.id} for session ${systemId}`,
      );

      return {
        browserId: browser.id,
        tabId: tab.id,
        page,
      };
    } catch (error) {
      const sessionInfo = sessionId || 'unknown';
      this.logger.error(
        `Error creating system tab for session ${sessionInfo}:`,
        error,
      );
      this.metricsService.recordError();
      return null;
    }
  }

  /**
   * Close a tab
   */
  async closeTab(
    browserId: string,
    tabId: string,
    options?: { deleteRedisKeys?: boolean },
  ): Promise<boolean> {
    try {
      const browser = this.activeBrowsers.get(browserId);

      if (!browser) {
        this.logger.warn(
          `Browser ${browserId} not found when closing tab ${tabId}`,
        );
        return false;
      }

      // Use lifecycle manager to close the tab, passing options
      const success = await this.lifecycleManager.closeTab(
        browser,
        tabId,
        options,
      );

      if (success) {
        // Update browser in Redis
        await this.storageService.saveBrowser(browser, this.config.browserTTL);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Error closing tab ${tabId} in browser ${browserId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Release a browser and close it
   */
  async releaseBrowser(browserId: string): Promise<boolean> {
    try {
      const browser = this.activeBrowsers.get(browserId);

      if (!browser) {
        this.logger.warn(
          `Browser ${browserId} not found when trying to release`,
        );
        return false;
      }

      // If browser still has tabs, just mark it as available but don't close
      if (browser.openTabs > 0) {
        this.logger.log(
          `Browser ${browserId} still has ${browser.openTabs} open tabs, not closing`,
        );
        return true;
      }

      // Close the browser
      browser.state = BrowserState.CLOSING;
      await this.lifecycleManager.closeBrowser(browser);

      // Remove from memory
      this.activeBrowsers.delete(browserId);

      // Remove from Redis
      await this.storageService.deleteBrowser(browserId);

      // Record metrics
      this.metricsService.recordBrowserClosure();

      this.logger.log(`Released and closed browser ${browserId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error releasing browser ${browserId}:`, error);
      this.metricsService.recordError();
      return false;
    }
  }

  /**
   * Get a browser by ID
   */
  async getBrowser(browserId: string): Promise<BrowserInstance | null> {
    try {
      // First check in-memory map
      const browser = this.activeBrowsers.get(browserId);

      if (browser) {
        return browser;
      }

      // Not found in memory, try Redis
      const redisBrowser = await this.storageService.getBrowser(browserId);

      if (!redisBrowser) {
        return null;
      }

      this.logger.warn(
        `Browser ${browserId} found in Redis but not in memory - may be stale`,
      );

      // Clean up stale Redis entry
      await this.storageService.deleteBrowser(browserId);

      return null;
    } catch (error) {
      this.logger.error(`Error getting browser ${browserId}:`, error);
      return null;
    }
  }

  /**
   * Execute a callback in a specific tab of a browser
   */
  async executeInTab<T>(
    browserId: string,
    tabId: string,
    callback: BrowserCallback<T>,
  ): Promise<T> {
    try {
      const browser = this.activeBrowsers.get(browserId);

      if (!browser || !browser.browser) {
        throw new Error(`Browser ${browserId} not found or not initialized`);
      }

      // Get tab info
      const tab = await this.tabManager.getTab(tabId);
      if (!tab) {
        throw new Error(`Tab ${tabId} not found`);
      }

      // Get page object (this needs to be implemented with context)
      const context = await browser.browser.newContext();
      const page = await context.newPage();

      try {
        // Update tab activity
        await this.tabManager.updateTabActivity(tabId);

        // Record request
        this.metricsService.recordRequestServed();

        // Execute the callback with the browser and page
        return await callback({
          browserId,
          browser: browser.browser,
          tabId,
          page,
        });
      } finally {
        // Close the context after use
        await page.close();
        await context.close();
      }
    } catch (error) {
      this.logger.error(`Error executing in tab ${tabId}:`, error);
      this.metricsService.recordError();
      throw error;
    }
  }

  /**
   * Execute a callback in a browser
   */
  async executeInBrowser<T>(
    browserId: string,
    callback: BrowserCallback<T>,
  ): Promise<T> {
    try {
      const browser = this.activeBrowsers.get(browserId);

      if (!browser || !browser.browser) {
        throw new Error(`Browser ${browserId} not found or not initialized`);
      }

      try {
        // Record successful request
        this.metricsService.recordRequestServed();

        // Execute the callback with just the browser
        return await callback({
          browserId,
          browser: browser.browser,
        });
      } catch (error) {
        // Record error
        this.metricsService.recordError();

        this.logger.error(`Error executing in browser ${browserId}:`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error executing in browser ${browserId}:`, error);
      this.metricsService.recordError();
      throw error;
    }
  }

  /**
   * Get all active browsers
   */
  async getActiveBrowsers(): Promise<BrowserInstance[]> {
    return new Promise((resolve) => {
      resolve(Array.from(this.activeBrowsers.values()));
    });
  }

  /**
   * Get browser count
   */
  getBrowserCount(): number {
    return this.activeBrowsers.size;
  }

  /**
   * Get tab info for a request
   */
  async getTabForRequest(requestId: string): Promise<BrowserTab | null> {
    return this.tabManager.getTabByRequest(requestId);
  }

  /**
   * Clean up browsers that have exceeded their TTL
   */
  async cleanupExpiredBrowsers(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    this.logger.debug(`Running cleanup of expired browsers...`);

    const browsersToCheck = Array.from(this.activeBrowsers.values());
    this.logger.debug(`Checking ${browsersToCheck.length} active browsers.`);

    for (const browser of browsersToCheck) {
      if (!browser.expiresAt || !(browser.expiresAt instanceof Date)) {
        this.logger.warn(
          `Browser ${browser.id.substring(0, 8)} has invalid expiresAt. Skipping.`,
        );
        continue;
      }

      // We know expiresAt is a Date here due to the check above
      const expiresAtStr = browser.expiresAt.toISOString();
      this.logger.debug(
        `Checking browser ${browser.id.substring(0, 8)}: expiresAt=${expiresAtStr}, now=${now.toISOString()}`,
      );

      if (browser.expiresAt < now) {
        this.logger.log(
          `Browser ${browser.id.substring(0, 8)} has expired (expiresAt: ${browser.expiresAt.toISOString()}). Closing...`,
        );
        try {
          this.logger.debug(
            `Calling lifecycleManager.closeBrowser for ${browser.id.substring(0, 8)}`,
          );
          const closeResult = await this.lifecycleManager.closeBrowser(browser);
          if (closeResult.success) {
            await this.storageService.deleteBrowser(browser.id);
            this.activeBrowsers.delete(browser.id);
            cleanedCount++;
            this.logger.log(
              `Successfully closed expired browser ${browser.id.substring(0, 8)}.`,
            );
          } else {
            this.logger.error(
              `Failed to close expired browser ${browser.id.substring(0, 8)}: ${closeResult.error?.message}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error during closing expired browser ${browser.id.substring(0, 8)}:`,
            error,
          );
        }
      } else {
        this.logger.debug(
          `Browser ${browser.id.substring(0, 8)} is still valid.`,
        );
      }
    }

    this.logger.log(
      `Expired browser cleanup finished. Closed ${cleanedCount}.`,
    );
    return cleanedCount;
  }

  /**
   * Perform health checks on active browsers
   */
  async performHealthChecks(): Promise<number> {
    let unhealthyCount = 0;
    const now = new Date();
    this.logger.debug(`Running health checks on active browsers...`);

    const browsersToCheck = Array.from(this.activeBrowsers.values());
    this.logger.debug(`Checking ${browsersToCheck.length} active browsers.`);

    for (const browser of browsersToCheck) {
      this.logger.debug(
        `Performing health check for browser ${browser.id.substring(0, 8)}...`,
      );
      let isHealthy: boolean = false;
      try {
        isHealthy = await this.lifecycleManager.checkBrowserHealth(browser);
        this.logger.debug(
          `Health check for browser ${browser.id.substring(0, 8)} result: ${isHealthy ? 'Healthy' : 'Unhealthy'}`,
        );
      } catch (error) {
        this.logger.error(
          `Error during health check for browser ${browser.id.substring(0, 8)}:`,
          error,
        );
        isHealthy = false; // Consider it unhealthy if check fails
      }

      browser.healthCheck = now;
      browser.healthStatus = isHealthy;

      // Update in Redis (important to keep state consistent)
      await this.storageService.saveBrowser(browser, this.config.browserTTL);

      if (!isHealthy) {
        unhealthyCount++;
        this.logger.warn(
          `Browser ${browser.id.substring(0, 8)} is unhealthy. Releasing...`,
        );
        this.logger.debug(
          `Calling releaseBrowser for unhealthy browser ${browser.id.substring(0, 8)}`,
        );
        await this.releaseBrowser(browser.id);
      } else {
        this.logger.debug(`Browser ${browser.id.substring(0, 8)} is healthy.`);
      }
    }

    this.logger.log(
      `Health checks finished. Found ${unhealthyCount} unhealthy browsers.`,
    );
    return unhealthyCount;
  }

  /**
   * Pre-warm the browser pool
   */
  async preWarmPool(): Promise<number> {
    try {
      // Calculate how many browsers we should have pre-warmed
      const targetCount = Math.floor(
        this.config.minPoolSize! * (this.config.preWarmThreshold! / 100),
      );

      // Count available browsers
      const availableBrowsers = Array.from(this.activeBrowsers.values()).filter(
        (browser) => browser.state === BrowserState.AVAILABLE,
      );

      // If we already have enough available browsers, do nothing
      if (availableBrowsers.length >= targetCount) {
        return 0;
      }

      // Calculate how many browsers to create
      const createCount = targetCount - availableBrowsers.length;

      this.logger.log(`Pre-warming pool with ${createCount} browsers`);

      let createdCount = 0;

      // Create browsers
      for (let i = 0; i < createCount; i++) {
        // Check if we've hit the max pool size
        if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
          break;
        }

        try {
          // Create a new browser
          const result = await this.lifecycleManager.createBrowser();

          if (result.success && result.data) {
            // Store the browser
            this.activeBrowsers.set(result.data.id, result.data);

            // Save to Redis
            await this.storageService.saveBrowser(
              result.data,
              this.config.browserTTL,
            );

            // Record metrics
            this.metricsService.recordBrowserCreation(
              result.data.metrics?.creationTime || 0,
            );

            createdCount++;
          }
        } catch (error) {
          this.logger.error('Error pre-warming browser:', error);
        }
      }

      if (createdCount > 0) {
        this.logger.log(`Successfully pre-warmed ${createdCount} browsers`);
      }

      return createdCount;
    } catch (error) {
      this.logger.error('Error pre-warming pool:', error);
      return 0;
    }
  }

  /**
   * Synchronize browsers between Redis and memory
   */
  private async synchronizeBrowsers() {
    try {
      this.logger.log('Starting browser synchronization');

      // Get all browser IDs from Redis
      const browserIds = await this.storageService.getAllBrowserIds();

      this.logger.log(`Found ${browserIds.length} browsers in Redis`);

      let removedCount = 0;

      // Check each browser in Redis
      for (const browserId of browserIds) {
        // If browser exists in Redis but not in memory, remove it
        if (!this.activeBrowsers.has(browserId)) {
          // Remove from Redis
          await this.storageService.deleteBrowser(browserId);
          removedCount++;
        }
      }

      this.logger.log(
        `Browser synchronization complete. Removed ${removedCount} stale references.`,
      );
    } catch (error) {
      this.logger.error('Error during browser synchronization:', error);
    }
  }

  /**
   * Start all periodic tasks
   */
  private startPeriodicTasks() {
    // Set up cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredBrowsers().catch((err) =>
        this.logger.error('Error in browser cleanup:', err),
      );
    }, this.config.cleanupInterval);

    // Set up health check interval
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks().catch((err) =>
        this.logger.error('Error in health checks:', err),
      );
    }, this.config.healthCheckInterval);

    // Set up pre-warming interval if enabled
    if (this.config.preWarmingEnabled) {
      this.preWarmTimer = setInterval(
        () => {
          this.preWarmPool().catch((err) =>
            this.logger.error('Error in pool pre-warming:', err),
          );
        },
        5 * 60 * 1000, // Run every 5 minutes
      );
    }
  }

  /**
   * Stop all periodic tasks
   */
  private stopPeriodicTasks() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.log('Stopped cleanup timer.');
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.preWarmTimer) {
      clearInterval(this.preWarmTimer);
      this.preWarmTimer = null;
    }
  }

  /**
   * Close all active browsers
   */
  private async closeAllBrowsers() {
    this.logger.log(
      `Closing all ${this.activeBrowsers.size} active browsers...`,
    );
    const closePromises = Array.from(this.activeBrowsers.keys()).map((id) =>
      this.releaseBrowser(id),
    );
    await Promise.allSettled(closePromises); // Use allSettled to ensure all attempts are made
    this.activeBrowsers.clear(); // Clear the local map after attempting closure
    this.logger.log('Finished closing all browsers.');
  }

  async makeAvailable(browserId: string): Promise<boolean> {
    try {
      const browserInstance = this.activeBrowsers.get(browserId);

      if (!browserInstance) {
        this.logger.warn(`Browser ${browserId} not found`);
        return false;
      }

      // If the browser doesn't have any tabs open, set it to AVAILABLE
      if (browserInstance.openTabs === 0) {
        browserInstance.state = BrowserState.AVAILABLE;
      }

      // Update timestamps
      const now = new Date();
      browserInstance.lastUsedAt = now;
      browserInstance.expiresAt = new Date(
        now.getTime() + this.config.browserTTL! * 1000,
      );

      // Save to Redis
      await this.storageService.saveBrowser(
        browserInstance,
        this.config.browserTTL,
      );

      this.logger.log(`Browser ${browserId} state updated`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating browser ${browserId} state:`, error);
      this.metricsService.recordError();
      return false;
    }
  }

  /**
   * Get or create a browser and a dedicated context for session restoration.
   * Associates the context with the given sessionId.
   * @param sessionId - The ID of the session to restore.
   * @returns An object containing the browser instance and the new browser context, or null if failed.
   */
  async getBrowserForSessionRestore(
    sessionId: string,
  ): Promise<{ browser: Browser; context: BrowserContext } | null> {
    this.logger.log(
      `Requesting browser and context for session restore: ${sessionId}`,
    );
    try {
      // Reuse existing context if already created for this session
      if (this.sessionContexts.has(sessionId)) {
        const existing = this.sessionContexts.get(sessionId)!;
        const browserInstance = this.activeBrowsers.get(existing.browserId);
        if (browserInstance && browserInstance.browser) {
          this.logger.log(
            `Reusing existing context for session ${sessionId} in browser ${existing.browserId}`,
          );
          // Ensure context is still valid? Playwright might handle this.
          return {
            browser: browserInstance.browser,
            context: existing.context,
          };
        } else {
          this.logger.warn(
            `Browser for existing context of session ${sessionId} not found or invalid. Clearing old entry.`,
          );
          await this.clearContext(sessionId, existing.browserId); // Clear stale entry
        }
      }

      // Find a browser with capacity or create a new one
      let browserInstance = await this.getBrowserWithCapacity();

      if (!browserInstance) {
        if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
          this.logger.warn(
            `Cannot create browser for session ${sessionId}: max pool size ${this.config.maxPoolSize} reached.`,
          );
          return null;
        }

        this.logger.log(
          `No browser with capacity found for session ${sessionId}, creating a new one.`,
        );
        const result = await this.lifecycleManager.createBrowser({
          headless: Boolean(Env.IS_PRODUCTION),
          slowMo: 50, // Consider making this configurable
        });

        if (!result.success || !result.data) {
          this.logger.error(
            `Failed to create browser for session ${sessionId}: ${result.error}`,
          );
          return null;
        }
        browserInstance = result.data;
        this.activeBrowsers.set(browserInstance.id, browserInstance);
        await this.storageService.saveBrowser(
          browserInstance,
          this.config.browserTTL,
        ); // Persist new browser state
        this.logger.log(
          `Created new browser ${browserInstance.id} for session ${sessionId}`,
        );
      } else {
        this.logger.log(
          `Using existing browser ${browserInstance.id} for session ${sessionId}`,
        );
      }

      if (!browserInstance || !browserInstance.browser) {
        this.logger.error(
          `Failed to obtain a valid browser instance for session ${sessionId}.`,
        );
        return null;
      }

      // Create a new isolated BrowserContext for the session
      // TODO: Add specific context options if needed (e.g., proxy, viewport)
      const context = await browserInstance.browser.newContext();
      this.logger.log(
        `Created new browser context for session ${sessionId} in browser ${browserInstance.id}`,
      );

      // Store the context associated with the sessionId
      this.sessionContexts.set(sessionId, {
        browserId: browserInstance.id,
        context: context,
      });

      return { browser: browserInstance.browser, context };
    } catch (error) {
      this.logger.error(
        `Error getting browser/context for session restore ${sessionId}:`,
        error,
      );
      this.metricsService.recordError();
      return null;
    }
  }

  /**
   * Cleans up (closes) the browser context associated with a specific session ID.
   * @param sessionId - The ID of the session whose context needs cleaning.
   * @param browserId - The ID of the browser supposedly hosting the context (optional, for verification).
   * @param beforeClearCallback - An optional async function to execute within the context before closing it.
   */
  async clearContext(
    sessionId: string,
    browserId?: string,
    beforeClearCallback?: (context: BrowserContext) => Promise<void>,
  ): Promise<void> {
    this.logger.log(
      `Clearing context for session ${sessionId} (browser hint: ${browserId || 'N/A'})`,
    );
    const contextInfo = this.sessionContexts.get(sessionId);

    if (!contextInfo) {
      this.logger.warn(`No context found for session ${sessionId} to clear.`);
      return;
    }

    if (browserId && contextInfo.browserId !== browserId) {
      this.logger.warn(
        `Context for session ${sessionId} is in browser ${contextInfo.browserId}, not the provided ${browserId}. Proceeding with closure.`,
      );
    }

    const browserInstance = this.activeBrowsers.get(contextInfo.browserId);

    if (!browserInstance) {
      this.logger.warn(
        `Browser ${contextInfo.browserId} for session ${sessionId} context not found in active pool. Removing context entry.`,
      );
      this.sessionContexts.delete(sessionId);
      return;
    }

    try {
      // Execute callback before closing the context, if provided
      if (beforeClearCallback) {
        this.logger.log(
          `Executing beforeClearCallback for session ${sessionId}`,
        );
        try {
          await beforeClearCallback(contextInfo.context);
          this.logger.log(
            `Successfully executed beforeClearCallback for session ${sessionId}`,
          );
        } catch (callbackError) {
          this.logger.error(
            `Error executing beforeClearCallback for session ${sessionId}: ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`,
          );
          // Decide if error in callback should prevent context closure. Currently, it does not.
          this.metricsService.recordError(); // Record callback error
        }
      }

      await contextInfo.context.close();
      this.logger.log(
        `Successfully closed context for session ${sessionId} in browser ${contextInfo.browserId}`,
      );
    } catch (error) {
      // Log error but continue cleanup, context might already be closed or invalid
      this.logger.error(
        `Error closing context for session ${sessionId} in browser ${contextInfo.browserId}:`,
        error,
      );
      this.metricsService.recordError();
    } finally {
      // Always remove the entry from the map
      this.sessionContexts.delete(sessionId);
      this.logger.log(`Removed context entry for session ${sessionId}`);
    }
  }
}
