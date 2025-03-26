export interface AdData {
  adArchiveId: string;
  adId: string | null;
  pageId: string;
  pageName: string;
  snapshot: {
    body?: { text?: string };
    images?: Array<{ url: string }>;
    videos?: Array<{ url: string }>;
    [key: string]: any;
  };
  startDate: number;
  endDate: number;
  status: string;
  publisherPlatform: string[];
  rawData: any;
}
