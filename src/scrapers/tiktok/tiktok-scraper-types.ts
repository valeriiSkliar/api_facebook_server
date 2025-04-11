import {
  IBaseScraperQuery,
  IBaseScraperOptions,
  IBaseScraperState,
  IBaseScraperContext,
  IBaseScraperResult,
} from '@src/scrapers/common/interfaces';
import { TiktokLibraryPeriod } from './models/tiktok-library-query';
import {
  TiktokLibraryCountryCode,
  TiktokLibraryOrderBy,
  TiktokLibraryAdFormat,
  TiktokLibraryLike,
  TiktokLibraryAdLanguage,
} from './models/tiktok-library-query';
import { TikTokAdData, TikTokPaginationData } from './models/tiktok-ad-data';
import { TikTokApiConfig } from './models/api-config';
import { AxiosError } from 'axios';

export interface TiktokScraperApiError {
  materialId: string;
  error: AxiosError;
  endpoint: string;
  timestamp: Date;
}

export interface TiktokScraperQuery extends IBaseScraperQuery {
  queryString: string;
  period: TiktokLibraryPeriod;
  orderBy: TiktokLibraryOrderBy;
  countryCode?: TiktokLibraryCountryCode[];
  languages?: TiktokLibraryAdLanguage[];
  adFormat?: TiktokLibraryAdFormat;
  like?: TiktokLibraryLike;
  adLanguages?: TiktokLibraryAdLanguage[];
}

// Interface to track failed materials
export interface FailedMaterial {
  materialId: string;
  attempts: number;
  lastError: string;
  timestamp: Date;
}

export interface TiktokScraperState extends IBaseScraperState {
  // Task ID for tracking in state storage
  taskId: string;
  startTime: Date;

  // Existing state properties
  apiErrors: TiktokScraperApiError[];
  failedMaterials: FailedMaterial[]; // Track failed materials with retry information

  // Material tracking
  processedMaterialIds: string[];
  failedMaterialIds: string[];

  sessionToken?: string;
  apiConfig?: TikTokApiConfig | null;
  rawApiResponse?: TikTokApiResponse;
  materialsIds?: string[];
  permissionError?: boolean;
}

export interface TiktokScraperOptions extends IBaseScraperOptions {
  // Added properties for state recovery
  resumePreviousTask?: boolean;
  previousTaskId?: string;
  forceRestart?: boolean;
  processingFailedMaterialsOnly?: boolean;

  // Existing options
  retryAttempts: number;
  userAgent?: string;
  timeout?: number;
}

export type TiktokMaterial = TikTokAdData;

export interface TiktokScraperContext
  extends IBaseScraperContext<
    TiktokScraperQuery,
    TiktokScraperOptions,
    TiktokScraperState
  > {
  someProperty?: string;
}

export interface TiktokScraperResult
  extends IBaseScraperResult<TiktokMaterial> {
  pagination?: TikTokPaginationData;
}

export interface TikTokApiResponse {
  code: number;
  data: {
    materials: TiktokMaterial[];
    pagination: TikTokPaginationData;
  };
  msg: string;
  request_id: string;
}
