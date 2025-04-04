// src/services/auth/AuthService.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { IAuthenticatorFactory } from '@src/interfaces';
import { AuthCredentials } from '@src/models/tik-tok/auth-credentials';

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
   * Refresh an existing session
   * @param credentials Optional credentials to use if refresh fails
   * @returns Promise resolving to boolean indicating success
   */
  async refreshSession(credentials?: AuthCredentials): Promise<boolean> {
    // Если уже идет процесс аутентификации и это тот же email - пропускаем
    if (
      credentials &&
      this.isAuthenticating &&
      this.lastAuthEmail === credentials.email
    ) {
      const timeSinceLastAuth = Date.now() - this.lastAuthTime;
      // Если прошло менее 10 секунд с предыдущей попытки аутентификации, пропускаем
      if (timeSinceLastAuth < 10000) {
        this.logger.warn('Parallel session refresh detected and prevented', {
          email: credentials.email,
          timeSinceLastAuth: `${timeSinceLastAuth}ms`,
        });
        return false;
      }
    }

    const authenticator = this.authenticatorFactory.createAuthenticator(
      this.logger,
    );

    try {
      // Try refreshing first
      const refreshed = await authenticator.refreshSession();

      // If refresh failed and credentials are provided, try full auth
      if (!refreshed && credentials) {
        this.logger.log(
          'Session refresh failed, attempting full authentication',
        );
        // Пропускаем полную аутентификацию, если она уже идет
        if (this.isAuthenticating && this.lastAuthEmail === credentials.email) {
          this.logger.warn(
            'Skipping authentication as it is already in progress',
            { email: credentials.email },
          );
          return false;
        }

        // Устанавливаем флаг и данные текущей аутентификации
        this.isAuthenticating = true;
        this.lastAuthEmail = credentials.email;
        this.lastAuthTime = Date.now();

        try {
          await authenticator.runAuthenticator(credentials);
          const result = await authenticator.verifySession();
          return result;
        } finally {
          // Сбрасываем флаг аутентификации
          this.isAuthenticating = false;
        }
      }

      return refreshed;
    } catch (error) {
      this.logger.error('Session refresh failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Сбрасываем флаг аутентификации на случай ошибки
      this.isAuthenticating = false;
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
