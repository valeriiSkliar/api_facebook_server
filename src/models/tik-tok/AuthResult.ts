import { Session } from './Session';

/**
 * Authentication result model
 * Contains the result of an authentication attempt
 */
export interface AuthResult {
  /**
   * Whether the authentication was successful
   */
  success: boolean;

  /**
   * Session data if authentication was successful
   */
  session?: Session;

  /**
   * Error message if authentication failed
   */
  error?: string;
}
