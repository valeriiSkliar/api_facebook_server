// src/services/auth/BaseAuthenticator.ts
import { Logger } from '@nestjs/common';
import { IAuthenticator } from '@src/scrapers/common/interfaces';
import { AuthenticatorContext } from '../models/authenticator-context';
import { AuthenticatorOptions } from '../models/authenticator-options';
import { AuthCredentials } from '../models/auth-credentials';

/**
 * Base class for all authenticator implementations
 * Provides common functionality and standardized context creation
 */
export abstract class BaseAuthenticator implements IAuthenticator {
  protected context: AuthenticatorContext;

  constructor(
    protected readonly logger: Logger,
    options?: Partial<AuthenticatorOptions>,
  ) {
    this.context = this.createContext(options);
  }

  /**
   * Creates a standardized context for the authenticator
   * @param options Optional configuration options
   * @returns Authenticator context with default values merged with provided options
   */
  protected createContext(
    options?: Partial<AuthenticatorOptions>,
  ): AuthenticatorContext {
    const defaultOptions: AuthenticatorOptions = {
      browser: {
        headless: true,
      },
      network: {
        timeout: 30000,
        retries: 3,
      },
      behavior: {
        applyFilters: false,
        maxRetries: 3,
        waitForResults: true,
        maxWaitTimeoutForStep: 30000,
        cleanUpTimeout: 300000,
      },
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './storage/sessions',
      },
    };

    return {
      options: { ...defaultOptions, ...options },
      state: {
        errors: [],
        forceStop: false,
        externalBrowser: false,
      },
    };
  }

  // Abstract methods to be implemented by concrete authenticators
  abstract runAuthenticator(credentials: AuthCredentials): Promise<void>;
  abstract verifySession(): Promise<boolean>;
  abstract refreshSession(): Promise<boolean>;
  abstract logout(): Promise<void>;
  abstract dispose(): Promise<void>;
}
