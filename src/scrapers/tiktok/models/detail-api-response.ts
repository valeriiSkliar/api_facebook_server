/**
 * Represents a single objective within the ad data.
 */
interface Objective {
  /** The label identifying the campaign objective (e.g., "campaign_objective_conversion"). */
  label: string;
  /** A numerical value associated with the objective. */
  value: number;
}

/**
 * Represents the URLs for different video resolutions.
 * Allows for keys like '720p', '1080p', etc.
 */
interface VideoUrls {
  /** Key represents the resolution (e.g., "720p"), value is the URL string. */
  [resolution: string]: string;
}

/**
 * Contains information about the video asset associated with the ad.
 */
interface VideoInfo {
  /** The unique identifier for the video. */
  vid: string;
  /** The duration of the video in seconds. */
  duration: number;
  /** The URL of the video's cover image. */
  cover: string;
  /** An object containing URLs for the video in different resolutions. */
  video_url: VideoUrls;
  /** The width of the video in pixels. */
  width: number;
  /** The height of the video in pixels. */
  height: number;
}

/**
 * Represents the detailed data payload for a single advertisement.
 */
export interface DetailMaterial {
  /** The title text of the advertisement. */
  ad_title: string;
  /** The brand name displayed in the advertisement. */
  brand_name: string;
  /** The number of comments associated with the ad. */
  comment: number;
  /** The cost associated with the ad (unit might vary). */
  cost: number;
  /** An array of ISO 3166-1 alpha-2 country codes where the ad is targeted. */
  country_code: string[];
  /** The Click-Through Rate of the ad. */
  ctr: number;
  /** Indicates if the ad has been marked as a favorite by the user. */
  favorite: boolean;
  /** Indicates if a summary is available for the ad. */
  has_summary: boolean;
  /** Text highlighted within the ad content (if applicable). */
  highlight_text: string;
  /** The unique identifier for the advertisement. Stored as a string. */
  id: string;
  /** A key representing the industry category of the ad. */
  industry_key: string;
  /** Indicates if this ad originates from a search context. */
  is_search: boolean;
  /** A list of keywords associated with the ad. Can contain different languages. */
  keyword_list: string[];
  /** The destination URL when the ad is clicked. */
  landing_page: string;
  /** The number of likes associated with the ad. */
  like: number;
  /** A key representing the primary objective of the ad campaign. */
  objective_key: string;
  /** An array detailing the various objectives set for the ad campaign. */
  objectives: Objective[];
  /** An array of labels related to ad patterns. (Type inferred as string[] based on naming, though the example is empty). */
  pattern_label: string[]; // NOTE: Example is empty, assuming string[] based on name. Could be unknown[] if unsure.
  /** The number of shares associated with the ad. */
  share: number;
  /** The source platform or manager where the ad originated (e.g., "TikTok Ads Manager"). */
  source: string;
  /** A numerical key representing the source. */
  source_key: number;
  /** A numerical tag associated with the ad. */
  tag: number;
  /** Detailed information about the video used in the ad. */
  video_info: VideoInfo;
  /** Indicates if the ad includes a voice-over. */
  voice_over: boolean;
}

/**
 * Represents the overall structure of the API response.
 */
export interface DetailApiResponse {
  /** The status code of the response (0 usually indicates success). */
  code: number; // Typically 0 for success, use number for other possible codes
  /** A message corresponding to the status code (e.g., "OK"). */
  msg: string;
  /** A unique identifier for the specific API request. */
  request_id: string;
  /** The main data payload containing advertisement details. */
  data: DetailMaterial;
}

// Example Usage (demonstration):
const apiResponseExample: DetailApiResponse = {
  code: 0,
  msg: 'OK',
  request_id: '202504091244369DDCB966B56073C30D29',
  data: {
    ad_title: '𝐏𝐚𝐡𝐚𝐫𝐞 𝐈𝐦𝐩𝐞𝐜𝐚𝐛𝐢𝐥𝐞 î𝐧𝐭𝐫-𝐨 𝐂𝐥𝐢𝐩𝐚̆! 𝐂𝐨𝐦𝐚𝐧𝐝𝐚 𝐚𝐜𝐮𝐦!',
    brand_name: '💥 𝐑𝐞𝐝𝐮𝐜𝐞𝐫𝐞 𝟑𝟎% 𝐝𝐨𝐚𝐫 𝐀𝐬𝐭𝐚𝐳𝐢!👆',
    comment: 165,
    cost: 2,
    country_code: [
      'AU',
      'SA',
      'OM',
      'SE',
      'SG',
      'ZA',
      'AE',
      'US',
      'IQ',
      'KW',
      'IL',
      'DE',
      'MX',
      'GB',
      'AT',
      'BE',
      'DK',
      'FI',
      'NO',
      'CH',
      'NL',
      'IE',
      'ES',
      'CA',
      'HU',
      'BR',
      'TR',
      'QA',
      'KR',
      'EG',
      'MA',
      'FR',
      'PE',
      'CO',
      'RO',
      'PT',
      'NZ',
      'IT',
      'JO',
      'BH',
    ],
    ctr: 0.06,
    favorite: false,
    has_summary: false,
    highlight_text: '',
    id: '7086764569679544322',
    industry_key: 'label_24116000000',
    is_search: false,
    keyword_list: [
      'high pressure glass washer',
      'حمض المعدة',
      'eliminate stubborn stains easily',
      'انسوا الام الركبة و المفاصل',
      'spedizione gratuita per questa settimana',
    ],
    landing_page: 'https://cumparsigur.ro/products/spalator-pahare-cu-presiune',
    like: 9431,
    objective_key: 'campaign_objective_conversion',
    objectives: [
      { label: 'campaign_objective_conversion', value: 3 },
      { label: 'campaign_objective_video_view', value: 4 },
      { label: 'campaign_objective_traffic', value: 1 },
      { label: 'campaign_objective_reach', value: 5 },
      { label: 'campaign_objective_lead_generation', value: 8 },
    ],
    pattern_label: [],
    share: 388,
    source: 'TikTok Ads Manager',
    source_key: 1,
    tag: 3,
    video_info: {
      vid: 'v12025gd0000cg0cojrc77ueqeti2pi0',
      duration: 9.545,
      cover:
        'https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068c799-us/a5058820964d4414ae712629f2190e18~tplv-noop.image?x-expires=1744224286&x-signature=l7xJC3XZACis7qwNZKrtn9TTPvM%3D',
      video_url: {
        '720p':
          'https://v16m-default.tiktokcdn.com/6b22942c53cdb6fd2f360bd4189f17da/67f6c01e/video/tos/maliva/tos-maliva-ve-0068c799-us/b75fd1ef11304ae2a7c2ea3c7c1513de/?a=0&bti=NTU4QDM1NGA%3D&ch=0&cr=0&dr=0&lr=tiktok_business&cd=0%7C0%7C0%7C0&cv=1&br=3084&bt=1542&cs=0&ds=3&ft=cApXJCz7ThWHETrISGZmo0P&mime_type=video_mp4&qs=0&rc=OGRmOTM5PGkzZWY1NWc5aUBpM3NsaGg6Zm1majMzZzgzNEAxLi81LzJfNTIxLi9eM2M0YSNmL3FucjRvbC1gLS1kLy9zcw%3D%3D&vvpl=1&l=202504091244369DDCB966B56073C30D29&btag=e000b0000',
      },
      width: 576,
      height: 1024,
    },
    voice_over: false,
  },
};

// You can now use this interface for type checking in TypeScript
console.log(apiResponseExample.data.ad_title);
console.log(apiResponseExample.data.video_info.duration);
console.log(apiResponseExample.data.objectives[0].label);
