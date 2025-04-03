// export * from './ScraperResponseDto';
export * from './facebook-ad-data-dto';
export * from './facebook-ad-library-query-dto';
export * from './facebook-scraper-response-dto';
export * from './facebook-scraper-options-dto';
export * from './facebook-scraper-result-dto';

// Временный интерфейс, чтобы код компилировался
export interface FacebookScraperRequestDto {
  query: {
    queryString: string;
    [key: string]: any;
  };
  options: any;
}
