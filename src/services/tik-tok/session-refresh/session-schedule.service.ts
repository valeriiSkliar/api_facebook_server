import { PrismaService } from '@src/database';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRefreshService } from './session-refresh.service';
import { TikTokAuthService } from '@src/authenticators/tik-tok/tiktok-auth-service';

@Injectable()
export class SessionScheduleService implements OnModuleInit {
  private readonly logger = new Logger(SessionScheduleService.name);
  // Флаг для отслеживания запущенного процесса обновления сессий
  private isRefreshing = false;
  // Время последнего обновления сессии
  private lastRefreshTime = 0;

  constructor(
    private sessionRefreshService: SessionRefreshService,
    private prisma: PrismaService,
    private tikTokAuthService: TikTokAuthService,
  ) {
    this.logger.log('SessionScheduleService initialized');
    console.log('SessionScheduleService initialized - direct console output');
  }

  /**
   * Этот метод вызывается после инициализации модуля и запускает первоначальное обновление сессии
   */
  async onModuleInit() {
    this.logger.log('SessionScheduleService onModuleInit triggered');

    try {
      await this.initialSessionCheck();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error during initial session check: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Выполняет первоначальную проверку сессий при запуске приложения
   */
  async initialSessionCheck() {
    this.logger.log('Performing initial session check on application startup');

    try {
      const result =
        await this.tikTokAuthService.createSessionsForTikTokAccounts();
      this.logger.log('Initial session creation completed', {
        success: result.success,
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });
    } catch (error) {
      this.logger.error('Error during initial session creation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check sessions every hour and refresh if needed
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAndRefreshSessions() {
    console.log('checkAndRefreshSessions called - direct console output');
    this.logger.log('checkAndRefreshSessions method called');

    // Проверяем, не запущен ли уже процесс обновления
    if (this.isRefreshing) {
      const timeSinceLastRefresh = Date.now() - this.lastRefreshTime;
      // Если обновление запущено менее часа назад, пропускаем
      if (timeSinceLastRefresh < 3600000) {
        // 1 hour
        this.logger.log(
          `Skipping session refresh - already in progress (${timeSinceLastRefresh}ms ago)`,
        );
        return;
      } else {
        // Если прошло больше часа, считаем предыдущее обновление зависшим и сбрасываем флаг
        this.logger.warn(
          `Previous refresh seems to be stuck (${timeSinceLastRefresh}ms) - resetting flag`,
        );
      }
    }

    try {
      // Устанавливаем флаг запущенного процесса
      this.isRefreshing = true;
      this.lastRefreshTime = Date.now();

      this.logger.log('Starting scheduled TikTok authentication');

      const result =
        await this.tikTokAuthService.createSessionsForTikTokAccounts();

      this.logger.log('Scheduled TikTok authentication completed', {
        success: result.success,
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      if (result.failedCount > 0) {
        this.logger.warn('Some TikTok authentications failed', {
          failedCount: result.failedCount,
          sessions: result.sessions.filter((s) => !s.success),
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error during scheduled TikTok authentication: ${errorMessage}`,
        errorStack,
      );
    } finally {
      // Сбрасываем флаг независимо от результата
      this.isRefreshing = false;
    }
  }
}
