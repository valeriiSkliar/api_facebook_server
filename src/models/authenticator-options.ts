export interface AuthenticatorOptions {
  storage?: {
    enabled?: boolean;
    format?: string;
    outputPath?: string;
  };

  /**
   * Browser configuration options
   */
  browser?: {
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
  };

  /**
   * Network configuration options
   */
  network?: {
    timeout?: number;
    retries?: number;
  };

  /**
   * Scraper behavior options
   */
  behavior?: {
    maxAdsToCollect?: number;
    applyFilters?: boolean;
    maxRetries?: number;
    waitForResults?: boolean;
    maxWaitTimeoutForStep?: number;
    cleanUpTimeout?: number;
  };
}
