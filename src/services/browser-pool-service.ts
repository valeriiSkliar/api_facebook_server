import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { Browser, chromium } from 'playwright';
import { Env } from '@lib/Env';
import { CreateRequestDto } from '@src/dto/create-request.dto';

export interface BrowserInstance {
  id: string;
  requestId?: string;
  userId?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  browser?: Browser;
}

@Injectable()
export class BrowserPoolService {
  private readonly logger = new Logger(BrowserPoolService.name);
  private readonly BROWSER_PREFIX = 'browser:';
  private readonly BROWSER_EXPIRY = 15 * 60; // 15 minutes in seconds
  private readonly activeBrowsers: Map<string, Browser> = new Map();
  private readonly maxBrowsers: number = 10; // Default limit

  constructor(private readonly redisService: RedisService) {
    // Initialize max browsers from environment or use default
    this.maxBrowsers = parseInt(process.env.MAX_BROWSER_INSTANCES || '10', 10);

    // Set up cleanup interval
    setInterval(() => {
      this.cleanupExpiredBrowsers().catch((err) =>
        this.logger.error('Error in browser cleanup', err),
      );
    }, 60 * 1000); // Run every minute
  }

  /**
   * Reserve a browser for a specific request
   */
  async reserveBrowser(
    requestId: string,
    userId: string,
    userEmail: string,
    parameters: CreateRequestDto['parameters'],
  ): Promise<BrowserInstance | null> {
    try {
      // Check if we already have too many active browsers
      const activeBrowserCount = this.activeBrowsers.size;
      if (activeBrowserCount >= this.maxBrowsers) {
        this.logger.warn(
          `Cannot create browser: max limit of ${this.maxBrowsers} reached`,
        );
        return null;
      }

      // Create a new browser instance
      const browserId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.BROWSER_EXPIRY * 1000);

      const browserInstance: BrowserInstance = {
        id: browserId,
        requestId,
        userId,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
      };

      // TODO: Add browser options
      console.log(parameters);
      // Launch a real browser instance
      const browser = await chromium.launch({
        headless: Env.HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      // Store the browser instance in memory
      this.activeBrowsers.set(browserId, browser);
      browserInstance.browser = browser;

      // Store in Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      const redisBrowserData = { ...browserInstance };
      delete redisBrowserData.browser; // Can't serialize the browser object

      await this.redisService.set(
        redisKey,
        redisBrowserData,
        this.BROWSER_EXPIRY,
      );

      this.logger.log(`Created browser ${browserId} for request ${requestId}`);
      return browserInstance;
    } catch (error) {
      this.logger.error(
        `Error reserving browser for request ${requestId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get an existing browser by ID
   */
  async getBrowser(browserId: string): Promise<BrowserInstance | null> {
    try {
      // Try to get from Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      const browserData =
        await this.redisService.get<BrowserInstance>(redisKey);

      if (!browserData) {
        return null;
      }

      // Check if we have the actual browser instance in memory
      const browser = this.activeBrowsers.get(browserId);
      if (browser) {
        browserData.browser = browser;
      } else {
        this.logger.warn(
          `Browser ${browserId} found in Redis but not in memory`,
        );
        return null;
      }

      return browserData;
    } catch (error) {
      this.logger.error(`Error getting browser ${browserId}`, error);
      throw error;
    }
  }

  /**
   * Extend the reservation time for a browser
   */
  async extendReservation(browserId: string): Promise<boolean> {
    try {
      const browserInstance = await this.getBrowser(browserId);
      if (!browserInstance) {
        return false;
      }

      // Update timestamps
      const now = new Date();
      browserInstance.lastUsedAt = now;
      browserInstance.expiresAt = new Date(
        now.getTime() + this.BROWSER_EXPIRY * 1000,
      );

      // Save to Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      const redisBrowserData = { ...browserInstance };
      delete redisBrowserData.browser; // Can't serialize the browser object

      await this.redisService.set(
        redisKey,
        redisBrowserData,
        this.BROWSER_EXPIRY,
      );

      this.logger.log(`Extended reservation for browser ${browserId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error extending reservation for browser ${browserId}`,
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
      // Get the browser instance
      const browser = this.activeBrowsers.get(browserId);

      if (browser) {
        // Close the browser
        await browser.close();
        // Remove from active browsers
        this.activeBrowsers.delete(browserId);
      }

      // Remove from Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      await this.redisService.del(redisKey);

      this.logger.log(`Released browser ${browserId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error releasing browser ${browserId}`, error);
      return false;
    }
  }

  /**
   * Clean up expired browser instances
   */
  async cleanupExpiredBrowsers(): Promise<number> {
    try {
      let cleanedCount = 0;
      const now = new Date();

      // Check each active browser
      for (const [browserId, browser] of this.activeBrowsers.entries()) {
        const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
        const browserData =
          await this.redisService.get<BrowserInstance>(redisKey);

        // If no data in Redis or expired, close and remove the browser
        if (!browserData || browserData.expiresAt < now) {
          try {
            await browser.close();
            this.logger.log(`Closed expired browser ${browserId}`);
          } catch (err) {
            this.logger.error(`Error closing browser ${browserId}`, err);
          }

          this.activeBrowsers.delete(browserId);
          await this.redisService.del(redisKey);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} expired browsers`);
      }

      return cleanedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired browsers', error);
      throw error;
    }
  }

  /**
   * Get all active browsers
   */
  async getActiveBrowsers(): Promise<BrowserInstance[]> {
    const browsers: BrowserInstance[] = [];

    for (const [browserId, browser] of this.activeBrowsers.entries()) {
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      const browserData =
        await this.redisService.get<BrowserInstance>(redisKey);

      if (browserData) {
        browserData.browser = browser;
        browsers.push(browserData);
      }
    }

    return browsers;
  }

  /**
   * Get browser count
   */
  getBrowserCount(): number {
    return this.activeBrowsers.size;
  }
}
