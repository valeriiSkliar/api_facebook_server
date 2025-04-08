export interface TiktokScraperOptions {
  storage?: {
    enabled?: boolean;
    format?: string;
    outputPath?: string;
  };

  /**
   * Whether to include the actual ad data in the API response
   * Setting this to true may result in large response payloads
   */
  includeAdsInResponse?: boolean;

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
    maxPages?: number;
    waitForResults?: boolean;
    waitTimeout?: number;
    cleanUpTimeout?: number;
  };
}
