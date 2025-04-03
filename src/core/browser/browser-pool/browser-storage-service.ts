// src/services/browser-pool/browser-storage-service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@core/storage/redis/redis.service';
import { BrowserInstance } from '@core/browser/browser-pool/types';

@Injectable()
export class BrowserStorageService {
  private readonly logger = new Logger(BrowserStorageService.name);
  private readonly BROWSER_PREFIX = 'browser:';
  private readonly USER_BROWSER_PREFIX = 'user-browser:';
  private readonly DEFAULT_TTL = 15 * 60; // 15 minutes in seconds

  constructor(private readonly redisService: RedisService) {}

  /**
   * Save browser metadata to Redis
   * @param instance - Browser instance to store
   * @param ttl - Optional TTL in seconds (defaults to 15 minutes)
   */
  async saveBrowser(instance: BrowserInstance, ttl?: number): Promise<boolean> {
    try {
      if (!instance || !instance.id) {
        return false;
      }

      // Create a copy of the instance data for Redis
      // Exclude the actual browser object which can't be serialized
      const redisBrowserData = { ...instance };
      delete redisBrowserData.browser;

      const key = `${this.BROWSER_PREFIX}${instance.id}`;
      const expiry = ttl || this.DEFAULT_TTL;

      await this.redisService.set(key, redisBrowserData, expiry);

      // Note: We don't associate browsers with users anymore
      // as we're now using a tab-based approach where multiple
      // users can share a browser

      return true;
    } catch (error) {
      this.logger.error(`Error saving browser ${instance.id} to Redis:`, error);
      return false;
    }
  }

  /**
   * Get browser metadata from Redis
   * @param browserId - ID of the browser to retrieve
   */
  async getBrowser(browserId: string): Promise<BrowserInstance | null> {
    try {
      const key = `${this.BROWSER_PREFIX}${browserId}`;
      const browserData = await this.redisService.get<BrowserInstance>(key);

      return browserData;
    } catch (error) {
      this.logger.error(
        `Error getting browser ${browserId} from Redis:`,
        error,
      );
      return null;
    }
  }

  /**
   * Delete browser metadata from Redis
   * @param browserId - ID of the browser to delete
   */
  async deleteBrowser(browserId: string): Promise<boolean> {
    try {
      const key = `${this.BROWSER_PREFIX}${browserId}`;
      await this.redisService.del(key);

      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting browser ${browserId} from Redis:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get browser ID associated with a user
   * @param userId - ID of the user
   */
  async getUserBrowser(userId: string): Promise<string | null> {
    try {
      const key = `${this.USER_BROWSER_PREFIX}${userId}`;
      return await this.redisService.get<string>(key);
    } catch (error) {
      this.logger.error(`Error getting browser for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Remove user-browser association
   * @param userId - ID of the user
   */
  async removeUserBrowser(userId: string): Promise<boolean> {
    try {
      const key = `${this.USER_BROWSER_PREFIX}${userId}`;
      await this.redisService.del(key);

      return true;
    } catch (error) {
      this.logger.error(`Error removing browser for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get all browser IDs from Redis
   */
  async getAllBrowserIds(): Promise<string[]> {
    try {
      const keys = await this.redisService.keys(`${this.BROWSER_PREFIX}*`);
      return keys.map((key) => key.replace(this.BROWSER_PREFIX, ''));
    } catch (error) {
      this.logger.error('Error getting all browser IDs:', error);
      return [];
    }
  }

  /**
   * Update browser expiry time
   * @param browserId - ID of the browser
   * @param ttl - Time to live in seconds
   */
  async updateBrowserExpiry(
    browserId: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<boolean> {
    try {
      const key = `${this.BROWSER_PREFIX}${browserId}`;
      await this.redisService.expire(key, ttl);

      return true;
    } catch (error) {
      this.logger.error(
        `Error updating expiry for browser ${browserId}:`,
        error,
      );
      return false;
    }
  }
}
