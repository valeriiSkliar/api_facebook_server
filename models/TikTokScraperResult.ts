import { TikTokAdData } from './TikTokAdData';

export interface TikTokScraperResult {
  ads: TikTokAdData[];
  totalAds: number;
  successfullyProcessed: number;
  failedToProcess: number;
  errors: Error[];
  startTime: Date;
  endTime: Date;
  executionTimeMs: number;
}
