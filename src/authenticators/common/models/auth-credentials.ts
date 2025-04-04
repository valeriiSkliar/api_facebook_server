import { ProxyConfig } from '@src/core/common/models/proxy-config';

/**
 * Authentication credentials model
 * Contains the necessary information for authenticating a user
 */
export interface AuthCredentials {
  /**
   * Email address for authentication
   */
  email: string;

  /**
   * Password for authentication
   */
  password: string;

  /**
   * Optional proxy configuration to use for the authentication request
   */
  proxyConfig?: ProxyConfig;

  /**
   * Optional path to the session file for session restoration
   */
  sessionPath?: string;

  /**
   * Optional session ID for existing database session
   */
  sessionId?: number;
}
