export interface BaseScraperResult<TAds = unknown> {
  success: boolean;
  ads: TAds[];
  totalCount: number;
  executionTime: number;
  outputPath?: string;
  errors: Error[];
  includeAdsInResponse?: boolean;
  hasMoreResults?: boolean;
  currentPage?: number;
}
