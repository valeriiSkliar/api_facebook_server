/**
 * Proxy configuration model
 * Contains the necessary information for configuring a proxy
 */
export interface ProxyConfig {
  /**
   * Proxy server hostname or IP address
   */
  host: string;

  /**
   * Proxy server port
   */
  port: number;

  /**
   * Optional username for proxy authentication
   */
  username?: string;

  /**
   * Optional password for proxy authentication
   */
  password?: string;

  /**
   * Proxy protocol type
   */
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
}
