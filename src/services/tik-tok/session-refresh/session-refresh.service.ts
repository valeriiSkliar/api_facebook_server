import { PrismaService } from '@src/database';
import { Injectable, Logger } from '@nestjs/common';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { Log } from 'crawlee';
import { Env } from '@src/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AuthService } from '@src/services/auth/auth-service';

@Injectable()
export class SessionRefreshService {
  private readonly logger = new Logger(SessionRefreshService.name);
  private readonly crawleeLogger: Log;

  // Флаг для отслеживания активного процесса обновления
  private isRefreshing = false;
  // Время последнего обновления
  private lastRefreshTime = 0;
  // Email аккаунта, используемого для текущего обновления
  private currentRefreshEmail: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    this.crawleeLogger = new Log({ prefix: 'SessionRefreshService' });
  }

  /**
   * Find the most recent active session and refresh it
   */
  async refreshActiveSession(): Promise<boolean> {
    // Проверяем, не запущен ли уже процесс обновления
    if (this.isRefreshing) {
      const timeSinceLastRefresh = Date.now() - this.lastRefreshTime;
      // Если обновление запущено менее 15 секунд назад, пропускаем
      if (timeSinceLastRefresh < 15000) {
        this.logger.warn(
          `Session refresh already in progress (${timeSinceLastRefresh}ms) for ${this.currentRefreshEmail}. Skipping.`,
        );
        return false;
      } else {
        // Если прошло больше 15 секунд, считаем предыдущее обновление зависшим и сбрасываем флаг
        this.logger.warn(
          `Previous refresh for ${this.currentRefreshEmail} seems to be stuck (${timeSinceLastRefresh}ms). Resetting and continuing.`,
        );
      }
    }

    // Устанавливаем флаг и время начала
    this.isRefreshing = true;
    this.lastRefreshTime = Date.now();
    this.currentRefreshEmail = null;

    try {
      this.logger.log('Looking for an active session to refresh');

      // Get the most recent active session
      const activeSession = await this.prisma.session.findFirst({
        where: {
          status: 'ACTIVE',
          is_valid: true,
        },
        orderBy: {
          last_activity_timestamp: 'desc',
        },
        include: {
          emailAccount: true,
        },
      });

      if (!activeSession) {
        this.logger.warn('No active session found for refresh');
        return await this.createNewSession();
      }

      // Обновляем текущий email и ID сессии
      this.currentRefreshEmail = activeSession.email;
      const sessionId = activeSession.id;

      // Create the session storage path if it doesn't exist
      const sessionStoragePath =
        process.env.SESSION_STORAGE_PATH || './storage/sessions';
      await fs.ensureDir(sessionStoragePath);

      // Run the authenticator to refresh the session
      this.logger.log(
        `Refreshing session for email: ${activeSession.email} (ID: ${sessionId})`,
      );

      const credentials: AuthCredentials = {
        email: activeSession.email,
        password: Env.TIKTOK_PASSWORD,
        sessionPath: activeSession.storage_path,
        sessionId: sessionId, // Передаем ID сессии в учетные данные
      };

      // Use the high-level AuthService to refresh the session
      const success = await this.authService.refreshSession(credentials);

      if (success) {
        // Mark the session as updated in the database
        await this.prisma.session.update({
          where: { id: activeSession.id },
          data: {
            last_activity_timestamp: new Date(),
          },
        });

        this.logger.log(
          `Session refresh completed for: ${activeSession.email} (ID: ${sessionId})`,
        );
      } else {
        this.logger.warn(`Session refresh failed for: ${activeSession.email}`);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Failed to refresh session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    } finally {
      // Сбрасываем флаги в любом случае
      this.isRefreshing = false;
    }
  }

  /**
   * Create a completely new session when no valid ones exist
   */
  private async createNewSession(): Promise<boolean> {
    try {
      this.logger.log('Creating a new TikTok session');

      // Get the first available email account
      const emailAccount = await this.prisma.email.findFirst({
        where: {
          status: 'ACTIVE',
        },
      });

      if (!emailAccount) {
        this.logger.error('No active email accounts found');
        return false;
      }

      // Обновляем текущий email
      this.currentRefreshEmail = emailAccount.email_address;

      // Create the session storage path
      const sessionStoragePath =
        process.env.SESSION_STORAGE_PATH || './storage/sessions';
      await fs.ensureDir(sessionStoragePath);
      const sessionPath = path.join(
        sessionStoragePath,
        `tiktok_${emailAccount.email_address}.json`,
      );

      // Create credentials and run authenticator
      const credentials: AuthCredentials = {
        email: emailAccount.email_address,
        password: emailAccount.password,
        sessionPath: sessionPath,
      };

      // Use the high-level AuthService to authenticate
      const success = await this.authService.authenticate(credentials);

      if (success) {
        this.logger.log(
          `New session created for: ${emailAccount.email_address}`,
        );
      } else {
        this.logger.warn(
          `Failed to create new session for: ${emailAccount.email_address}`,
        );
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
