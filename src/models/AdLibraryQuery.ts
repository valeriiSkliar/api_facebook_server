export interface AdLibraryQuery {
  queryString: string;
  countries: string[];
  activeStatus: 'active' | 'inactive' | 'all';
  adType: 'political_and_issue_ads' | 'all';
  isTargetedCountry: boolean;
  mediaType: 'all' | 'image' | 'video';
  searchType: 'keyword_unordered' | 'keyword_exact_phrase';
  filters?: Record<string, any>; // Extensible filter options
}
