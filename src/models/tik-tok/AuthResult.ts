import { Session } from './Session';

/**
 * Authentication result model
 * Contains the result of an authentication attempt
 */
export interface AuthResult<TData = any> {
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

  /**
   * Data returned by the authentication step
   */
  data?: TData;
}
