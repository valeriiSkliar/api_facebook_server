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
  video_info: {
    vid: string;
    duration: number;
    cover: string;
    video_url: {
      [key: string]: string; // 360p, 480p, 540p, 720p etc
    };
    width: number;
    height: number;
  };
}
