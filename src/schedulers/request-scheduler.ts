import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestManagerService } from '../services/request-manager-service';
import { BrowserPoolService } from '../services/browser-pool/browser-pool-service';
import { CacheService } from '../services/cache-service';

@Injectable()
export class RequestScheduler {
  private readonly logger = new Logger(RequestScheduler.name);

  constructor(
    private readonly requestManager: RequestManagerService,
    private readonly browserPool: BrowserPoolService,
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

      // Подсчет и группировка браузеров по requestId
      const browserUsage = new Map<string, number>();
      const requestMap = new Map<string, string[]>();

      activeBrowsers.forEach((browser) => {
        if (browser.requestId) {
          // Подсчитываем количество браузеров для каждого requestId
          browserUsage.set(
            browser.requestId,
            (browserUsage.get(browser.requestId) || 0) + 1,
          );

          // Группируем браузеры по requestId
          const browsersForRequest = requestMap.get(browser.requestId) || [];
          browsersForRequest.push(browser.id);
          requestMap.set(browser.requestId, browsersForRequest);
        }
      });

      // Определяем, есть ли повторное использование браузеров
      const reusedBrowserCount = [...browserUsage.values()].filter(
        (count) => count > 1,
      ).length;

      // Форматируем информацию о браузерах
      let browserDetails = '';
      if (activeBrowsers.length > 0) {
        browserDetails = activeBrowsers
          .map((b) => {
            const shortId = b.id.substring(0, 8);
            const shortRequestId = b.requestId?.substring(0, 8) || 'unassigned';
            const requestBrowserCount = b.requestId
              ? browserUsage.get(b.requestId) || 0
              : 0;
            return `${shortId}... (${shortRequestId}...${requestBrowserCount > 1 ? ', shared: ' + requestBrowserCount : ''})`;
          })
          .join(', ');
      } else {
        browserDetails = 'No active browsers';
      }

      // Формируем вывод статистики с информацией о переиспользовании
      const reuseSummary =
        reusedBrowserCount > 0
          ? `\n        - Browsers Reuse: ${reusedBrowserCount} requests share browsers`
          : '';

      this.logger.log(`System Stats:
        - Active Browsers: ${activeBrowsers.length}/${this.browserPool.getBrowserCount()}
        - Pending Requests: ${pendingRequests}${reuseSummary}
        - Browser Details: ${browserDetails}`);
    } catch (error: any) {
      this.logger.error('Error logging system stats', error);
    }
  }
}
