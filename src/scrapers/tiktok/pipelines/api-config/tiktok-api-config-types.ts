// src/scrapers/tiktok/pipelines/api-config/tiktok-api-config-types.ts
import {
  IBaseScraperContext,
  IBaseScraperOptions,
  IBaseScraperQuery,
  IBaseScraperResult,
  IBaseScraperState,
  IGenericScraperStep,
} from '@src/scrapers/common/interfaces';
import { Page } from 'playwright';
import { ApiConfig } from './api-config.interface';

// --- Query ---
// Define what input the pipeline needs
export type TiktokApiConfigQuery = IBaseScraperQuery;

// --- Options ---
// Define configuration options for the pipeline
export interface TiktokApiConfigOptions extends IBaseScraperOptions {
  // Add specific options for API config handling if needed
  forceRefresh?: boolean;
}

// --- State ---
// Define the state managed during pipeline execution
export interface TiktokApiConfigState extends IBaseScraperState {
  retrievedConfig?: ApiConfig | null; // To store the result
  sessionData?: any; // If session data is needed
  // Use 'configsCollected' instead of 'adsCollected' for clarity
  configsCollected: ApiConfig[];
  /** List of accounts and their session data to process */
  accountsToProcess?: Array<{ accountId: number; sessionData: any }>;
  /**
   * Prepared browser tabs for accounts, created in OpenTabsStep
   */
  sessionTabs?: Array<{
    accountId: number;
    browserId: string;
    tabId: string;
    page?: Page; // Playwright Page instance
  }>;
}

// --- Context ---
// Combine Query, Options, and State into the context
export type TiktokApiConfigContext = IBaseScraperContext<
  TiktokApiConfigQuery,
  TiktokApiConfigOptions,
  TiktokApiConfigState
>;

// --- Step ---
// Define the interface for steps in this specific pipeline
export type TiktokApiConfigStep = IGenericScraperStep<TiktokApiConfigContext>;

export interface TiktokApiConfigBase {
  id: string;
  timestamp: string;
  associatedId?: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string | null;
  };
}
// --- Result ---
// Define the final output of the pipeline
export interface TiktokApiConfigResult extends IBaseScraperResult<ApiConfig> {
  // Use 'configs' instead of 'ads' for clarity
  configs?: ApiConfig[]; // Optional: might return collected configs
  finalConfig?: ApiConfig | null; // Optional: the primary config retrieved
}
