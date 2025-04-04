/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestManagerService } from '../services/request-manager-service';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { CacheService } from '@core/cache';
import { TabManager } from '@core/browser/browser-pool/tab-manager';

@Injectable()
export class RequestScheduler {
  private readonly logger = new Logger(RequestScheduler.name);

  constructor(
    private readonly requestManager: RequestManagerService,
    private readonly browserPool: BrowserPoolService,
    private readonly tabManager: TabManager,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Clean up expired requests every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredRequests() {
    try {
      const count = await this.requestManager.cleanupExpiredRequests();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired requests`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired requests', error);
    }
  }

  /**
   * Clean up expired browsers every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredBrowsers() {
    try {
      const count = await this.browserPool.cleanupExpiredBrowsers();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired browsers`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired browsers', error);
    }
  }

  /**
   * Clean up expired cache entries every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCache() {
    try {
      const count = await this.cacheService.cleanupExpiredEntries();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired cache entries`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired cache entries', error);
    }
  }

  /**
   * Log system stats every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async logSystemStats() {
    try {
      const activeBrowsers = await this.browserPool.getActiveBrowsers();
      const pendingRequests =
        await this.requestManager.getPendingRequestsCount();

      // Group tabs by browser
      const tabsByBrowser = new Map<string, number>();
      const requestTabs = new Map<string, string[]>();

      // Count tabs in each browser
      for (const browser of activeBrowsers) {
        tabsByBrowser.set(browser.id, browser.openTabs);
      }

      // Get all tabs to see which tabs belong to which requests
      for (const browser of activeBrowsers) {
        for (const tabId of browser.tabIds) {
          const tab = await this.tabManager.getTab(tabId);
          if (tab && tab.requestId) {
            // Group by request ID
            const tabsForRequest = requestTabs.get(tab.requestId) || [];
            tabsForRequest.push(tabId);
            requestTabs.set(tab.requestId, tabsForRequest);
          }
        }
      }

      // Count shared browsers (browsers with multiple tabs for different requests)
      const sharedBrowsersCount = activeBrowsers.filter(
        (b) => b.openTabs > 1,
      ).length;

      // Format browser details
      let browserDetails = '';
      if (activeBrowsers.length > 0) {
        browserDetails = activeBrowsers
          .map((b) => {
            const shortId = b.id.substring(0, 8);
            return `${shortId}... (tabs: ${b.openTabs}/${this.browserPool.getMaxTabsPerBrowser()})`;
          })
          .join(', ');
      } else {
        browserDetails = 'No active browsers';
      }

      // Format sharing summary
      const sharingSummary =
        sharedBrowsersCount > 0
          ? `\n        - Shared Browsers: ${sharedBrowsersCount} browsers serving multiple requests`
          : '';

      this.logger.log(`System Stats:
       - Active Browsers: ${activeBrowsers.length}/${this.browserPool.getBrowserCount()}
       - Pending Requests: ${pendingRequests}${sharingSummary}
       - Total Open Tabs: ${Array.from(tabsByBrowser.values()).reduce((sum, count) => sum + count, 0)}
       - Browser Details: ${browserDetails}`);
    } catch (error: any) {
      this.logger.error('Error logging system stats', error);
    }
  }
}
