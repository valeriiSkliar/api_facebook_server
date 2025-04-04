/* eslint-disable no-useless-escape */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Page } from 'playwright';
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
      // Получаем или создаем браузер
      let browser = await this.getBrowserWithCapacity();

      // Если нет браузера с достаточной емкостью, создаем новый
      if (!browser) {
        if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
          this.logger.warn(
            `Cannot create browser: max limit of ${this.config.maxPoolSize} reached`,
          );
          return null;
        }

        // Создаем новый браузер
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

        // Записываем метрики
        this.metricsService.recordBrowserCreation(
          browser.metrics?.creationTime || 0,
        );

        // Сохраняем в Redis
        await this.storageService.saveBrowser(browser, this.config.browserTTL);
      }

      // Создаем системную вкладку в браузере
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

      // Обновляем браузер в Redis
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
  async closeTab(browserId: string, tabId: string): Promise<boolean> {
    try {
      const browser = this.activeBrowsers.get(browserId);

      if (!browser) {
        this.logger.warn(
          `Browser ${browserId} not found when closing tab ${tabId}`,
        );
        return false;
      }

      // Use lifecycle manager to close the tab
      const success = await this.lifecycleManager.closeTab(browser, tabId);

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
   * Clean up expired browser instances
   */
  async cleanupExpiredBrowsers(): Promise<number> {
    try {
      let cleanedCount = 0;
      const now = new Date();

      // Get all active browsers
      const browsers = Array.from(this.activeBrowsers.values());

      // Check each browser for expiration
      for (const browser of browsers) {
        if (browser.expiresAt < now) {
          // Browser has expired, close it
          this.logger.log(`Cleaning up expired browser ${browser.id}`);

          try {
            // Change state and close browser
            browser.state = BrowserState.CLOSING;
            await this.lifecycleManager.closeBrowser(browser);

            // Remove from memory and Redis
            this.activeBrowsers.delete(browser.id);
            await this.storageService.deleteBrowser(browser.id);

            // Record metrics
            this.metricsService.recordBrowserClosure();

            cleanedCount++;
          } catch (error) {
            this.logger.error(
              `Error closing expired browser ${browser.id}:`,
              error,
            );
          }
        }
      }

      // Also clean up expired tabs
      const expiredTabsCount = await this.tabManager.cleanupExpiredTabs();
      if (expiredTabsCount > 0) {
        this.logger.log(`Cleaned up ${expiredTabsCount} expired tabs`);
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired browsers`);
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired browsers:', error);
      return 0;
    }
  }

  /**
   * Perform health checks on all browsers
   */
  async performHealthChecks(): Promise<number> {
    try {
      let unhealthyCount = 0;

      // Get all active browsers
      const browsers = Array.from(this.activeBrowsers.values());

      for (const browser of browsers) {
        // Skip browsers that are already closing
        if (browser.state === BrowserState.CLOSING) {
          continue;
        }

        const isHealthy =
          await this.lifecycleManager.checkBrowserHealth(browser);

        if (!isHealthy) {
          this.logger.warn(
            `Browser ${browser.id} failed health check, closing`,
          );

          // Close all tabs first
          for (const tabId of browser.tabIds) {
            await this.closeTab(browser.id, tabId);
          }

          // Close unhealthy browser
          await this.releaseBrowser(browser.id);

          unhealthyCount++;
        }
      }

      if (unhealthyCount > 0) {
        this.logger.log(
          `Found and closed ${unhealthyCount} unhealthy browsers`,
        );
      }

      return unhealthyCount;
    } catch (error) {
      this.logger.error('Error performing health checks:', error);
      return 0;
    }
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
    const browsers = Array.from(this.activeBrowsers.values());

    this.logger.log(`Closing ${browsers.length} active browsers`);

    const promises = browsers.map((browser) => {
      browser.state = BrowserState.CLOSING;
      return this.lifecycleManager
        .closeBrowser(browser)
        .catch((err) =>
          this.logger.error(`Error closing browser ${browser.id}:`, err),
        );
    });

    await Promise.all(promises);

    // Clear the active browsers map
    this.activeBrowsers.clear();
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
}
