// src/interfaces/auth/IAuthenticatorFactory.ts
import { Logger } from '@nestjs/common';
import { AuthenticatorContext, AuthenticatorOptions } from '@src/models';
import { IAuthenticator } from './i-authenticator';

/**
 * Interface for authenticator factories
 * Defines the standardized contract for creating authenticators
 */
export interface IAuthenticatorFactory {
  /**
   * Creates an authenticator instance
   * @param logger Logger instance for the authenticator
   * @returns An authenticator implementation
   */
  createAuthenticator(logger: Logger): IAuthenticator;

  /**
   * Creates a standardized authenticator context
   * @param options Optional configuration options
   * @returns An authenticator context
   */
  createContext(options?: Partial<AuthenticatorOptions>): AuthenticatorContext;
}
