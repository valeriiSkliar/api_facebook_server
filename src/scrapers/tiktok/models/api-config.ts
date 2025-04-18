import { ApiConfiguration, Prisma } from '@prisma/client';

export interface TikTokApiHeaders {
  lang: string;
  accept: string;
  cookie: string;
  'web-id': string;
  referer: string;
  'sec-ch-ua': string;
  timestamp: string;
  'user-sign': string;
  'user-agent': string;
  'sec-ch-ua-mobile': string;
  'sec-ch-ua-platform': string;
}

export interface TikTokApiConfig extends ApiConfiguration {
  url: string;
  method: string;
  parameters: ApiConfiguration['parameters'];
  headers: Prisma.JsonValue;
  postData?: string;
  timestamp: string;
}
