// src/tiktok-search/session-schedule.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRefreshService } from './session-refresh.service';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class SessionScheduleService {
  private readonly logger = new Logger(SessionScheduleService.name);

  constructor(
    private sessionRefreshService: SessionRefreshService,
    private prisma: PrismaService,
  ) {}

  /**
   * Check sessions every 45 minutes and refresh if needed
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAndRefreshSessions() {
    try {
      this.logger.log('Scheduled session check started');

      // Check if we have any valid API configs
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const validApiConfig = await this.prisma.apiConfiguration.findFirst({
        where: {
          is_active: true,
          updated_at: {
            gt: oneHourAgo,
          },
        },
      });

      // If no valid API config found, trigger a refresh
      if (!validApiConfig) {
        this.logger.log(
          'No valid API config found, triggering session refresh',
        );
        const refreshResult =
          await this.sessionRefreshService.refreshActiveSession();

        if (refreshResult) {
          this.logger.log('Scheduled session refresh completed successfully');
        } else {
          this.logger.warn('Scheduled session refresh failed');
        }
      } else {
        this.logger.log('Valid API config found, no refresh needed');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error during scheduled session check: ${errorMessage}`,
        errorStack,
      );
    }
  }
}
