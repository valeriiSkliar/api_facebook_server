import { TikTokAdData } from './TikTokAdData';

export interface TikTokScraperOptions {
  searchQuery?: string;
  maxAds?: number;
  industryFilter?: string[];
  objectiveFilter?: string[];
  minLikes?: number;
  minCtr?: number;
}

export interface ScraperOptions {
  retryAttempts: number;
  delayBetweenRequests: number;
  timeout: number;
  userAgent?: string;
}

export interface ApiConfiguration {
  accessToken: string;
  apiEndpoint: string;
}

export interface TikTokScraperContext {
  query: TikTokScraperOptions;
  options: ScraperOptions;
  state: {
    apiConfig: ApiConfiguration | null;
    adsCollected: TikTokAdData[];
    errors: Error[];
    lastProcessedId?: string;
    isCompleted: boolean;
  };
}
