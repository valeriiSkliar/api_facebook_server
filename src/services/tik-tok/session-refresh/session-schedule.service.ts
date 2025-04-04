/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { PrismaService } from '@src/database';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRefreshService } from './session-refresh.service';

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
      // Проверка наличия активной сессии или создание новой при запуске приложения
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

    // Проверяем наличие активной сессии
    const activeSession = await this.prisma.apiConfiguration.findFirst({
      where: {
        is_active: true,
      },
    });

    if (!activeSession) {
      this.logger.log(
        'No valid API config found on startup, triggering session refresh',
      );

      // Запускаем процесс обновления/создания сессии
      const refreshResult =
        await this.sessionRefreshService.refreshActiveSession();

      if (refreshResult) {
        this.logger.log('Initial session refresh completed successfully');
      } else {
        this.logger.warn('Initial session refresh failed');
      }
    } else {
      this.logger.log(
        'Valid API config found on startup, no immediate refresh needed',
      );
    }
  }

  /**
   * Check sessions every 30 seconds and refresh if needed
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkAndRefreshSessions() {
    console.log('checkAndRefreshSessions called - direct console output');
    this.logger.log('checkAndRefreshSessions method called');

    // Проверяем, не запущен ли уже процесс обновления
    if (this.isRefreshing) {
      const timeSinceLastRefresh = Date.now() - this.lastRefreshTime;
      // Если обновление запущено менее 30 секунд назад, пропускаем
      if (timeSinceLastRefresh < 30000) {
        this.logger.log(
          `Skipping session refresh - already in progress (${timeSinceLastRefresh}ms ago)`,
        );
        return;
      } else {
        // Если прошло больше 30 секунд, считаем предыдущее обновление зависшим и сбрасываем флаг
        this.logger.warn(
          `Previous refresh seems to be stuck (${timeSinceLastRefresh}ms) - resetting flag`,
        );
      }
    }

    try {
      // Устанавливаем флаг запущенного процесса
      this.isRefreshing = true;
      this.lastRefreshTime = Date.now();

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
    } finally {
      // Сбрасываем флаг независимо от результата
      this.isRefreshing = false;
    }
  }
}
