export interface TikTokScraperOptions {
  behavior: {
    applyFilters: boolean;
    maxPages: number;
    waitForResults: boolean;
    waitTimeout: number;
  };
  storage: {
    enabled: boolean;
    format: 'json';
    outputPath: string;
  };
}
