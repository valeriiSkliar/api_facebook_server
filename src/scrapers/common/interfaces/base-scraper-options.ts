export interface IBaseScraperOptions {
  /** Storage options */
  storage?: {
    enabled?: boolean;
    format?: string;
    outputPath?: string;
  };

  /** Whether to include results in the response */
  includeAdsInResponse?: boolean;

  /** Browser configuration options */
  browser?: {
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
  };

  /** Network configuration options */
  network?: {
    timeout?: number;
    retries?: number;
  };

  /** Behavior options */
  behavior?: {
    maxAdsToCollect?: number;
    applyFilters?: boolean;
    maxPages?: number;
    waitForResults?: boolean;
    waitTimeout?: number;
    cleanUpTimeout?: number;
  };
}
