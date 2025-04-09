export interface TikTokAdData {
  id: string;
  ad_title: string;
  brand_name: string;
  cost: number;
  ctr: number;
  favorite: boolean;
  industry_key: string;
  is_search: boolean;
  like: number;
  objective_key: string;
  tag?: number;
  video_info: VideoInfo;
}

export interface VideoInfo {
  cover: string;
  duration: number;
  height: number;
  vid: string;
  video_url: VideoURL;
  width: number;
}

export interface VideoURL {
  '1080p'?: string;
  '360p'?: string;
  '480p'?: string;
  '540p'?: string;
  '720p'?: string;
}

export interface TikTokPaginationData {
  has_more: boolean;
  page: number;
  size: number;
  total_count: number;
}
