export interface AdData {
  adArchiveId: string;
  adId: string | null;
  pageId: string;
  pageName: string;
  snapshot: {
    body?: { text?: string } | null;
    images?: Array<{ url?: string }>;
    videos?: Array<{
      thumbnail_url?: null;
      url?: string;
      duration?: number;
      width?: number;
      height?: number;
    }>;
    page_categories?: string[];
    [key: string]: any;
  };
  startDate: number;
  endDate: number;
  status: string;
  publisherPlatform: string[];
  rawData: any;
}
