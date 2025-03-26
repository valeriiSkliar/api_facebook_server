import { AdData } from './AdData';

export interface ScraperResult {
  success: boolean;
  ads: AdData[];
  totalCount: number;
  executionTime: number;
  outputPath?: string;
  errors: Error[];
}
