// src/services/browser-pool/browser-pool-service.ts

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
// import { Browser } from 'playwright';
// import { v4 as uuidv4 } from 'uuid';
import { ScraperOptionsDto } from '../../dto/ScraperOptionsDto';
import {
  BrowserState,
  BrowserInstance,
  BrowserPoolConfig,
  BrowserCallback,
  //   BrowserOperationResult,
} from './types';
import { BrowserLifecycleManager } from './browser-lifecycle-manager';
import { BrowserStorageService } from './browser-storage-service';
import { BrowserMetricsService } from './browser-metrics-service';

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
  ) {
    // Initialize configuration with defaults and environment variables
    this.config = {
      minPoolSize: parseInt(process.env.MIN_BROWSER_INSTANCES || '2', 10),
      maxPoolSize: parseInt(process.env.MAX_BROWSER_INSTANCES || '10', 10),
      browserTTL: parseInt(process.env.BROWSER_TTL || '900', 10), // 15 minutes
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
   * Find an available browser that is not currently assigned to a request
   */
  async getAvailableBrowser(): Promise<BrowserInstance | null> {
    try {
      // Get all browsers that are in the AVAILABLE state
      const availableBrowsers = Array.from(this.activeBrowsers.values()).filter(
        (browser) => browser.state === BrowserState.AVAILABLE,
      );

      if (availableBrowsers.length === 0) {
        return null;
      }

      // Sort by last used time (oldest first) for better distribution
      availableBrowsers.sort(
        (a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime(),
      );

      const browser = availableBrowsers[0];
      this.logger.log(`Found available browser: ${browser.id}`);

      return new Promise((resolve) => {
        resolve(browser);
      });
    } catch (error) {
      this.logger.error('Error finding available browser:', error);
      return null;
    }
  }

  /**
   * Reserve a browser for a specific request
   */
  async reserveBrowser(
    requestId: string,
    userId: string,
    userEmail: string,
    options: ScraperOptionsDto,
  ): Promise<BrowserInstance | null> {
    try {
      // First try to reuse an available browser
      const availableBrowser = await this.getAvailableBrowser();

      if (availableBrowser) {
        // Update browser state and metadata
        availableBrowser.requestId = requestId;
        availableBrowser.userId = userId;
        availableBrowser.userEmail = userEmail;
        availableBrowser.state = BrowserState.RESERVED;

        // Update timestamps
        const now = new Date();
        availableBrowser.lastUsedAt = now;
        availableBrowser.expiresAt = new Date(
          now.getTime() + this.config.browserTTL! * 1000,
        );

        // Save updated browser metadata to Redis
        await this.storageService.saveBrowser(
          availableBrowser,
          this.config.browserTTL,
        );

        // Record metric for browser reuse
        this.metricsService.recordBrowserReuse();

        this.logger.log(
          `Reusing browser ${availableBrowser.id} for request ${requestId}`,
        );
        return availableBrowser;
      }

      // If we're at capacity, return null
      if (this.activeBrowsers.size >= this.config.maxPoolSize!) {
        this.logger.warn(
          `Cannot create browser: max limit of ${this.config.maxPoolSize} reached`,
        );
        return null;
      }

      // Create a new browser
      const result = await this.lifecycleManager.createBrowser({
        headless: options?.browser?.headless ?? true,
        slowMo: 50,
      });

      if (!result.success || !result.data) {
        this.logger.error('Failed to create browser:', result.error);
        return null;
      }

      // Set up the new browser instance
      const browserInstance = result.data;
      browserInstance.requestId = requestId;
      browserInstance.userId = userId;
      browserInstance.userEmail = userEmail;
      browserInstance.state = BrowserState.RESERVED;

      // Record metrics
      this.metricsService.recordBrowserCreation(
        browserInstance.metrics?.creationTime || 0,
      );

      // Store the browser in memory
      this.activeBrowsers.set(browserInstance.id, browserInstance);

      // Store in Redis
      await this.storageService.saveBrowser(
        browserInstance,
        this.config.browserTTL,
      );

      this.logger.log(
        `Created browser ${browserInstance.id} for request ${requestId}`,
      );
      return browserInstance;
    } catch (error) {
      this.logger.error(
        `Error reserving browser for request ${requestId}:`,
        error,
      );
      this.metricsService.recordError();
      return null;
    }
  }

  /**
   * Make a browser available for reuse
   */
  async makeAvailable(browserId: string): Promise<boolean> {
    try {
      const browserInstance = this.activeBrowsers.get(browserId);

      if (!browserInstance) {
        this.logger.warn(`Browser ${browserId} not found`);
        return false;
      }

      // Update browser state
      browserInstance.requestId = undefined;
      browserInstance.state = BrowserState.AVAILABLE;

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

      // If there was a user associated, remove the association
      if (browserInstance.userId) {
        await this.storageService.removeUserBrowser(browserInstance.userId);
        browserInstance.userId = undefined;
        browserInstance.userEmail = undefined;
      }

      this.logger.log(`Browser ${browserId} marked as available for reuse`);
      return true;
    } catch (error) {
      this.logger.error(`Error making browser ${browserId} available:`, error);
      this.metricsService.recordError();
      return false;
    }
  }

  /**
   * Release a browser and close it
   */
  async releaseBrowser(browserId: string): Promise<boolean> {
    try {
      const browserInstance = this.activeBrowsers.get(browserId);

      if (!browserInstance) {
        this.logger.warn(
          `Browser ${browserId} not found when trying to release`,
        );
        return false;
      }

      // Try to make the browser available for reuse instead of closing
      const madeAvailable = await this.makeAvailable(browserId);
      if (madeAvailable) {
        return true;
      }

      // If making available failed, close the browser
      browserInstance.state = BrowserState.CLOSING;

      // Close the browser
      await this.lifecycleManager.closeBrowser(browserInstance);

      // Remove from memory
      this.activeBrowsers.delete(browserId);

      // Remove from Redis
      await this.storageService.deleteBrowser(browserId);

      // If there was a user associated, remove the association
      if (browserInstance.userId) {
        await this.storageService.removeUserBrowser(browserInstance.userId);
      }

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
      const browserInstance = this.activeBrowsers.get(browserId);

      if (browserInstance) {
        return browserInstance;
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
   * Extend the reservation time for a browser
   */
  async extendReservation(browserId: string): Promise<boolean> {
    try {
      const browserInstance = this.activeBrowsers.get(browserId);

      if (!browserInstance) {
        return false;
      }

      // Use lifecycle manager to extend the session
      this.lifecycleManager.extendBrowserSession(
        browserInstance,
        this.config.browserTTL,
      );

      // Update Redis
      await this.storageService.saveBrowser(
        browserInstance,
        this.config.browserTTL,
      );

      this.logger.debug(`Extended reservation for browser ${browserId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error extending reservation for browser ${browserId}:`,
        error,
      );
      return false;
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
      const browserInstance = this.activeBrowsers.get(browserId);

      if (!browserInstance || !browserInstance.browser) {
        throw new Error(`Browser ${browserId} not found or not initialized`);
      }

      // Update state
      const previousState = browserInstance.state;
      browserInstance.state = BrowserState.IN_USE;

      // Extend the reservation
      await this.extendReservation(browserId);

      try {
        // Execute the callback with the browser
        const result = await callback({
          browserId,
          browser: browserInstance.browser,
        });

        // Record successful request
        this.metricsService.recordRequestServed();

        return result;
      } catch (error) {
        // Record error
        this.metricsService.recordError();

        this.logger.error(`Error executing in browser ${browserId}:`, error);
        throw error;
      } finally {
        // Restore previous state if still active
        if (this.activeBrowsers.has(browserId)) {
          browserInstance.state = previousState;
          await this.storageService.saveBrowser(
            browserInstance,
            this.config.browserTTL,
          );
        }
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
   * Get browser pool metrics
   */
  getPoolMetrics() {
    // Update state distribution
    this.metricsService.updateStateDistribution(
      Array.from(this.activeBrowsers.values()),
    );

    // Get current metrics
    return this.metricsService.getMetrics();
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
}
