export interface BaseScraperContext<
  TQuery = unknown,
  TOptions = unknown,
  TAds = unknown,
> {
  query: TQuery;
  options: TOptions;
  //   result: TResult<TAds>;
  state: {
    adsCollected: TAds[];
    errors: Error[];
    forceStop: boolean;
    hasMoreResults?: boolean;
    currentPage?: number;
    outputPath?: string;
    includeAdsInResponse?: boolean;
  };
}
