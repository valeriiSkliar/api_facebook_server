// src/services/auth/AuthService.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { IAuthenticatorFactory } from '@src/scrapers/common/interfaces';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';

/**
 * High-level service for authentication operations
 * Works with any authenticator implementation through the factory
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Флаг для отслеживания активных процессов аутентификации
  private isAuthenticating = false;
  // Хранение последней используемой почты для предотвращения дублирования
  private lastAuthEmail: string | null = null;
  // Время последней аутентификации
  private lastAuthTime = 0;

  constructor(
    @Inject('IAuthenticatorFactory')
    private readonly authenticatorFactory: IAuthenticatorFactory,
  ) {}

  /**
   * Authenticate a user using the specified credentials
   * @param credentials Authentication credentials
   * @returns Promise resolving to boolean indicating success
   */
  async authenticate(credentials: AuthCredentials): Promise<boolean> {
    // Проверка на параллельную аутентификацию с тем же самым email
    if (this.isAuthenticating && this.lastAuthEmail === credentials.email) {
      const timeSinceLastAuth = Date.now() - this.lastAuthTime;
      // Если прошло менее 10 секунд с предыдущей попытки аутентификации, пропускаем
      if (timeSinceLastAuth < 10000) {
        this.logger.warn('Parallel authentication detected and prevented', {
          email: credentials.email,
          timeSinceLastAuth: `${timeSinceLastAuth}ms`,
        });
        return false;
      }
    }

    try {
      // Устанавливаем флаг и данные текущей аутентификации
      this.isAuthenticating = true;
      this.lastAuthEmail = credentials.email;
      this.lastAuthTime = Date.now();

      const authenticator = this.authenticatorFactory.createAuthenticator(
        this.logger,
      );

      this.logger.log('Starting authentication process', {
        email: credentials.email,
      });

      await authenticator.runAuthenticator(credentials);
      const isValid = await authenticator.verifySession();

      this.logger.log('Authentication process completed', {
        email: credentials.email,
        success: isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.error('Authentication process failed', {
        email: credentials.email,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    } finally {
      // Сбрасываем флаг аутентификации
      this.isAuthenticating = false;
    }
  }

  /**
   * Verify if a session is valid
   * @returns Promise resolving to boolean indicating validity
   */
  async verifySession(): Promise<boolean> {
    const authenticator = this.authenticatorFactory.createAuthenticator(
      this.logger,
    );
    return authenticator.verifySession();
  }

  /**
   * Refreshes an existing session
   * @param credentials Authentication credentials containing session information
   * @returns Promise resolving to boolean indicating success
   */
  async refreshSession(credentials: AuthCredentials): Promise<boolean> {
    try {
      const logger = new Logger(`${AuthService.name}[${credentials.email}]`);
      logger.log('Refreshing session', {
        email: credentials.email,
        sessionPath: credentials.sessionPath,
        sessionId: credentials.sessionId,
      });

      // Создаем аутентификатор через фабрику
      const authenticator = this.authenticatorFactory.createAuthenticator(
        this.logger,
      );

      // Если есть ID сессии, выводим информационное сообщение
      if (credentials.sessionId) {
        logger.log(
          `Using session ID ${credentials.sessionId} for request interception`,
        );
      }

      await authenticator.runAuthenticator(credentials);

      logger.log('Session refresh successful');
      return true;
    } catch (error) {
      this.logger.error('Session refresh failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Logout and invalidate session
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    const authenticator = this.authenticatorFactory.createAuthenticator(
      this.logger,
    );
    return authenticator.logout();
  }
}
