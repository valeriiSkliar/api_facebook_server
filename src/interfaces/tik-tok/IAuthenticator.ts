// import { Page } from 'playwright';
// import { Page } from 'playwright';
import { AuthCredentials } from '@src/models/tik-tok/AuthCredentials';
// import { AuthResult } from '../models';

/**
 * Interface for authentication services
 * Defines the contract for any authentication implementation
 */
export interface IAuthenticator {
  // /**
  //  * Performs login with the provided credentials
  //  * @param credentials User credentials for authentication
  //  * @param page Page for context
  //  * @returns Promise resolving to authentication result
  //  */
  // login(credentials: AuthCredentials, page: Page): Promise<AuthResult>;

  /**
   * Verifies if the current session is valid
   * @returns Promise resolving to boolean indicating session validity
   */
  verifySession(): Promise<boolean>;

  /**
   * Refreshes the current session to extend its validity
   * @returns Promise resolving to boolean indicating success
   */
  refreshSession(): Promise<boolean>;

  /**
   * Performs logout, invalidating the current session
   * @returns Promise resolving when logout is complete
   */
  logout(): Promise<void>;

  // /**
  //  * Handles the TikTok cookie consent banner by clicking the "Allow all" button
  //  * @returns Promise resolving to an object indicating success or failure
  //  */
  // handleCookieConsent(
  //   page: Page,
  // ): Promise<{ success: boolean; error?: string }>;

  /**
   * Cleans up resources used by the authenticator
   * @returns Promise resolving when cleanup is complete
   */
  dispose(): Promise<void>;

  /**
   * Runs the authentication process
   * @param credentials User credentials for authentication
   * @returns Promise resolving to authentication result
   */
  runAuthenticator(credentials: AuthCredentials): Promise<void>;
}
