import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestManagerService } from '../services/request-manager-service';
import { BrowserPoolService } from '../services/browser-pool-service';
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
  @Cron(CronExpression.EVERY_10_MINUTES)
  async logSystemStats() {
    try {
      const activeBrowsers = await this.browserPool.getActiveBrowsers();

      this.logger.log(`System Stats:
- Active Browsers: ${activeBrowsers.length}/${this.browserPool.getBrowserCount()}
- Browser Details: ${activeBrowsers
        .map(
          (b) =>
            `${b.id.substring(0, 8)}... (${b.requestId?.substring(0, 8)}...)`,
        )
        .join(', ')}`);
    } catch (error) {
      this.logger.error('Error logging system stats', error);
    }
  }
}
