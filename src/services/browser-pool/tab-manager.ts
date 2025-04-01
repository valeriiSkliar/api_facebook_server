import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Page } from 'playwright';
import { RedisService } from '../../redis/redis.service';

// Interface to represent a browser tab
export interface BrowserTab {
  id: string;
  browserId: string;
  requestId: string;
  userId: string;
  userEmail?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TabManager {
  private readonly logger = new Logger(TabManager.name);
  private readonly tabs: Map<string, BrowserTab> = new Map();
  private readonly TAB_PREFIX = 'tab:';
  private readonly REQUEST_TAB_PREFIX = 'request-tab:';
  private readonly DEFAULT_TTL = 60 * 60; // 1 hour in seconds

  constructor(private readonly redisService: RedisService) {}

  /**
   * Create a new tab for a request in a specific browser
   */
  async createTab(
    browserId: string,
    requestId: string,
    userId: string,
    userEmail?: string,
    page?: Page,
  ): Promise<BrowserTab> {
    this.logger.log(
      `Creating tab for request ${requestId} in browser ${browserId} ${page?.url()}`,
    );

    const tabId = `tab_${uuidv4()}`;
    const now = new Date();
    const expiryTime = 60 * 60 * 1000; // 1 hour in milliseconds

    const tab: BrowserTab = {
      id: tabId,
      browserId,
      requestId,
      userId,
      userEmail,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + expiryTime),
    };

    // Store in memory
    this.tabs.set(tabId, tab);

    // Store in Redis
    await this.redisService.set(
      `${this.TAB_PREFIX}${tabId}`,
      tab,
      this.DEFAULT_TTL,
    );

    // Create request-to-tab mapping
    await this.redisService.set(
      `${this.REQUEST_TAB_PREFIX}${requestId}`,
      tabId,
      this.DEFAULT_TTL,
    );

    this.logger.log(`Created tab ${tabId} for request ${requestId}`);

    return tab;
  }

  /**
   * Get a tab by its ID
   */
  async getTab(tabId: string): Promise<BrowserTab | null> {
    // Try memory first
    const memoryTab = this.tabs.get(tabId);
    if (memoryTab) {
      return memoryTab;
    }

    // Try Redis
    const redisTab = await this.redisService.get<BrowserTab>(
      `${this.TAB_PREFIX}${tabId}`,
    );
    if (redisTab) {
      // Cache in memory
      this.tabs.set(tabId, redisTab);
      return redisTab;
    }

    return null;
  }

  /**
   * Get a tab by request ID
   */
  async getTabByRequest(requestId: string): Promise<BrowserTab | null> {
    // Get tab ID from Redis
    const tabId = await this.redisService.get<string>(
      `${this.REQUEST_TAB_PREFIX}${requestId}`,
    );
    if (!tabId) {
      return null;
    }

    return this.getTab(tabId);
  }

  /**
   * Get all tabs for a browser
   */
  async getTabsByBrowser(browserId: string): Promise<BrowserTab[]> {
    // Get all tabs from memory that match the browser ID
    const memoryTabs = Array.from(this.tabs.values()).filter(
      (tab) => tab.browserId === browserId,
    );

    // Also check Redis for any tabs not in memory
    const allTabKeys = await this.redisService.keys(`${this.TAB_PREFIX}*`);
    const redisTabs: BrowserTab[] = [];

    for (const key of allTabKeys) {
      const tabId = key.replace(this.TAB_PREFIX, '');
      if (!this.tabs.has(tabId)) {
        const tab = await this.redisService.get<BrowserTab>(key);
        if (tab && tab.browserId === browserId) {
          redisTabs.push(tab);
          // Cache in memory
          this.tabs.set(tabId, tab);
        }
      }
    }

    return [...memoryTabs, ...redisTabs];
  }

  /**
   * Count tabs in a browser
   */
  async getTabsCount(browserId: string): Promise<number> {
    const tabs = await this.getTabsByBrowser(browserId);
    return tabs.length;
  }

  /**
   * Update tab's last used time
   */
  async updateTabActivity(tabId: string): Promise<boolean> {
    const tab = await this.getTab(tabId);
    if (!tab) {
      return false;
    }

    // Update timestamp
    const now = new Date();
    tab.lastUsedAt = now;
    tab.expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // Reset to 1 hour from now

    // Update in memory
    this.tabs.set(tabId, tab);

    // Update in Redis
    await this.redisService.set(
      `${this.TAB_PREFIX}${tabId}`,
      tab,
      this.DEFAULT_TTL,
    );

    return true;
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: string): Promise<boolean> {
    this.logger.log(`Closing tab ${tabId}`);

    const tab = await this.getTab(tabId);
    if (!tab) {
      this.logger.warn(`Tab ${tabId} not found for closing`);
      return false;
    }

    // Remove from memory
    this.tabs.delete(tabId);

    // Remove from Redis
    await this.redisService.del(`${this.TAB_PREFIX}${tabId}`);
    await this.redisService.del(`${this.REQUEST_TAB_PREFIX}${tab.requestId}`);

    this.logger.log(`Closed tab ${tabId} for request ${tab.requestId}`);

    return true;
  }

  /**
   * Close all tabs for a browser
   */
  async closeAllTabsForBrowser(browserId: string): Promise<number> {
    const tabs = await this.getTabsByBrowser(browserId);

    let closedCount = 0;
    for (const tab of tabs) {
      const success = await this.closeTab(tab.id);
      if (success) {
        closedCount++;
      }
    }

    return closedCount;
  }

  /**
   * Clean up expired tabs
   */
  async cleanupExpiredTabs(): Promise<number> {
    const now = new Date();
    let closedCount = 0;

    // Check memory tabs
    for (const [tabId, tab] of this.tabs.entries()) {
      if (tab.expiresAt < now) {
        const success = await this.closeTab(tabId);
        if (success) {
          closedCount++;
        }
      }
    }

    // Check Redis tabs
    const allTabKeys = await this.redisService.keys(`${this.TAB_PREFIX}*`);
    for (const key of allTabKeys) {
      const tab = await this.redisService.get<BrowserTab>(key);
      if (tab && tab.expiresAt < now) {
        const success = await this.closeTab(tab.id);
        if (success) {
          closedCount++;
        }
      }
    }

    return closedCount;
  }
}
