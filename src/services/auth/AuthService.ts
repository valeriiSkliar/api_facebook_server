// src/services/auth/AuthService.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { IAuthenticatorFactory } from '@src/interfaces';
import { AuthCredentials } from '@src/models/tik-tok/AuthCredentials';

/**
 * High-level service for authentication operations
 * Works with any authenticator implementation through the factory
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    try {
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
        await authenticator.runAuthenticator(credentials);
        return await authenticator.verifySession();
      }

      return refreshed;
    } catch (error) {
      this.logger.error('Session refresh failed', {
        error: error instanceof Error ? error.message : String(error),
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
