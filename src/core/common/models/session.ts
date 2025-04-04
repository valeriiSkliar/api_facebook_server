import { ProxyConfig } from './proxy-config';

/**
 * Session model
 * Represents an authenticated session with all necessary data
 */
export interface Session {
  /**
   * Unique identifier for the session
   */
  id: string;

  /**
   * User identifier associated with this session
   */
  userId: string;

  /**
   * Cookies associated with the session
   */
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;

  /**
   * HTTP headers to use with this session
   */
  headers: Record<string, string>;

  /**
   * Session creation timestamp
   */
  createdAt: Date;

  /**
   * Session expiration timestamp
   */
  expiresAt: Date;

  /**
   * Timestamp of last session usage
   */
  lastUsedAt: Date;

  /**
   * Optional proxy configuration associated with this session
   */
  proxyConfig?: ProxyConfig;
}
