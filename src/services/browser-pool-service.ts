import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { Browser, chromium, Page } from 'playwright';
import { ScraperOptionsDto } from '@src/dto/ScraperOptionsDto';

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
  private readonly browserAssignments: Map<string, string> = new Map(); // browserId -> requestId

  constructor(private readonly redisService: RedisService) {
    // Initialize max browsers from environment or use default
    this.maxBrowsers = parseInt(process.env.MAX_BROWSER_INSTANCES || '10', 10);

    // Set up cleanup interval
    setInterval(() => {
      this.cleanupExpiredBrowsers().catch((err) =>
        this.logger.error('Error in browser cleanup', err),
      );
    }, 60 * 1000); // Run every minute

    // Synchronize browsers on startup
    this.synchronizeBrowsers().catch((err) =>
      this.logger.error('Error synchronizing browsers on startup', err),
    );
  }

  /**
   * Find an available browser that is not currently assigned to a request
   */
  async getAvailableBrowser(): Promise<BrowserInstance | null> {
    try {
      // Получаем все активные браузеры
      const activeBrowsers = await this.getActiveBrowsers();

      // Ищем свободный браузер (без requestId)
      const availableBrowser = activeBrowsers.find(
        (browser) => !browser.requestId || browser.requestId === '',
      );

      if (availableBrowser) {
        this.logger.log(`Found available browser: ${availableBrowser.id}`);
        return availableBrowser;
      }

      return null;
    } catch (error) {
      this.logger.error('Error finding available browser', error);
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
    parameters: ScraperOptionsDto,
  ): Promise<BrowserInstance | null> {
    try {
      // Проверяем, есть ли свободный браузер для повторного использования
      const availableBrowser = await this.getAvailableBrowser();

      if (availableBrowser && availableBrowser.browser) {
        // Если найден свободный браузер, используем его
        this.logger.log(
          `Reusing existing browser ${availableBrowser.id} for request ${requestId}`,
        );

        // Обновляем данные браузера
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.BROWSER_EXPIRY * 1000);

        const updatedBrowser: BrowserInstance = {
          ...availableBrowser,
          requestId,
          userId,
          lastUsedAt: now,
          expiresAt,
        };

        // Сохраняем обновленные данные в Redis
        const redisKey = `${this.BROWSER_PREFIX}${availableBrowser.id}`;
        const redisBrowserData = { ...updatedBrowser };
        delete redisBrowserData.browser; // Can't serialize the browser object

        await this.redisService.set(
          redisKey,
          redisBrowserData,
          this.BROWSER_EXPIRY,
        );

        // Обновляем отслеживание назначений
        this.browserAssignments.set(availableBrowser.id, requestId);

        return updatedBrowser;
      }

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

      // Log browser parameters
      this.logger.log('Launching browser with parameters:', parameters);

      try {
        // Получаем настройки браузера из параметров запроса
        const browserOptions = parameters?.browser || {};

        // Запускаем браузер с настройками из параметров
        const browser = await chromium.launch({
          // Используем headless из параметров или по умолчанию false
          headless: browserOptions?.headless === false ? false : true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
          executablePath: process.env.CHROME_PATH,
          slowMo: 50, // Используем фиксированное значение
        });

        // Store the browser instance in memory
        this.activeBrowsers.set(browserId, browser);
        browserInstance.browser = browser;

        // Отслеживаем назначение
        this.browserAssignments.set(browserId, requestId);

        // Store in Redis
        const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
        const redisBrowserData = { ...browserInstance };
        delete redisBrowserData.browser; // Can't serialize the browser object

        await this.redisService.set(
          redisKey,
          redisBrowserData,
          this.BROWSER_EXPIRY,
        );

        this.logger.log(
          `Created browser ${browserId} for request ${requestId}`,
        );
        return browserInstance;
      } catch (error) {
        console.error('Error starting browser:', error);
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error reserving browser for request ${requestId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Release a browser but keep it active for reuse
   */
  async makeAvailable(browserId: string): Promise<boolean> {
    try {
      // Получаем текущие данные браузера
      const browserInstance = await this.getBrowser(browserId);

      if (!browserInstance) {
        this.logger.warn(`Browser ${browserId} not found`);
        return false;
      }

      // Обновляем данные, удаляя requestId
      const now = new Date();
      browserInstance.requestId = undefined;
      browserInstance.lastUsedAt = now;
      browserInstance.expiresAt = new Date(
        now.getTime() + this.BROWSER_EXPIRY * 1000,
      );

      // Сохраняем обновленные данные в Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      const redisBrowserData = { ...browserInstance };
      delete redisBrowserData.browser; // Can't serialize the browser object

      await this.redisService.set(
        redisKey,
        redisBrowserData,
        this.BROWSER_EXPIRY,
      );

      // Удаляем из отслеживания назначений
      this.browserAssignments.delete(browserId);

      this.logger.log(`Browser ${browserId} marked as available for reuse`);
      return true;
    } catch (error) {
      this.logger.error(`Error making browser ${browserId} available`, error);
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

      // По умолчанию вместо закрытия помечаем как доступный
      if (browser) {
        // Попытка сделать браузер доступным для повторного использования
        const madeAvailable = await this.makeAvailable(browserId);

        // Если успешно сделали доступным, не закрываем
        if (madeAvailable) {
          return true;
        }

        // Если не удалось сделать доступным, закрываем
        await browser.close();
        this.activeBrowsers.delete(browserId);
      }

      // Remove from Redis
      const redisKey = `${this.BROWSER_PREFIX}${browserId}`;
      await this.redisService.del(redisKey);

      // Удаляем из отслеживания назначений
      this.browserAssignments.delete(browserId);

      this.logger.log(`Released browser ${browserId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error releasing browser ${browserId}`, error);
      return false;
    }
  }

  /**
   * Get an existing browser by ID
   */
  async getBrowser(browserId: string): Promise<BrowserInstance | null> {
    try {
      if (!browserId) {
        return null;
      }

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
        return browserData;
      } else {
        this.logger.warn(
          `Browser ${browserId} found in Redis but not in memory`,
        );
        // Clean up stale Redis entry
        await this.redisService.del(redisKey);
        return null;
      }
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
   * Execute a callback in a browser
   */
  async executeInBrowser(
    browserId: string,
    callback: (page: Page) => Promise<any>,
  ): Promise<any> {
    try {
      const browserInstance = await this.getBrowser(browserId);
      if (!browserInstance || !browserInstance.browser) {
        throw new Error(`Browser ${browserId} not found or not initialized`);
      }

      // Create a new page in the browser
      const page = await browserInstance.browser.newPage();

      try {
        // Execute the callback with the page
        return await callback(page);
      } finally {
        // Close the page when done
        await page.close();
      }
    } catch (error) {
      this.logger.error(`Error executing in browser ${browserId}`, error);
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

  async createBrowser(parameters?: ScraperOptionsDto): Promise<Browser> {
    try {
      this.logger.log(`Creating new browser with parameters:`, parameters);

      // Получаем настройки браузера из параметров
      const browserOptions = parameters?.browser || {};

      // Launch a real browser instance with appropriate parameters
      const browser = await chromium.launch({
        headless: browserOptions?.headless === false ? false : true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      // Создаем страницу для использования
      await browser.newPage();

      // Генерируем ID для браузера
      const browserId = uuidv4();

      // Сохраняем экземпляр браузера в Map
      this.activeBrowsers.set(browserId, browser);
      this.logger.log(`Browser added to pool with ID: ${browserId}`);

      this.logger.log(`Browser created with ID: ${browserId}`);

      // Обработка закрытия браузера для автоматической очистки
      browser.on('disconnected', () => {
        this.logger.log(
          `Browser ${browserId} disconnected, removing from pool`,
        );
        this.activeBrowsers.delete(browserId);
      });

      return browser;
    } catch (error) {
      this.logger.error(`Error creating browser:`, error);
      throw error;
    }
  }

  /**
   * Synchronize browsers between Redis and memory
   */
  async synchronizeBrowsers() {
    try {
      this.logger.log('Starting browser synchronization');
      const browserKeys = await this.redisService.keys(
        `${this.BROWSER_PREFIX}*`,
      );
      this.logger.log(`Found ${browserKeys.length} browsers in Redis`);

      let removedCount = 0;

      // Check each browser in Redis
      for (const key of browserKeys) {
        const browserId = key.replace(this.BROWSER_PREFIX, '');
        const browserData = await this.redisService.get<BrowserInstance>(key);

        // If browser exists in Redis but not in memory
        if (browserData && !this.activeBrowsers.has(browserId)) {
          // Remove from Redis
          await this.redisService.del(key);
          removedCount++;
          this.logger.warn(`Removed stale browser reference: ${browserId}`);
        }
      }

      this.logger.log(
        `Browser synchronization complete. Removed ${removedCount} stale references. Current active browsers: ${this.activeBrowsers.size}`,
      );
    } catch (error) {
      this.logger.error('Error during browser synchronization', error);
      throw error;
    }
  }
}
