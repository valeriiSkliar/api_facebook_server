// src/scrapers/tiktok/pipelines/api-config/tiktok-api-config-types.ts
import {
  IBaseScraperContext,
  IBaseScraperOptions,
  IBaseScraperQuery,
  IBaseScraperResult,
  IBaseScraperState,
  IGenericScraperStep,
} from '@src/scrapers/common/interfaces';
import { ApiConfig } from '@src/modules/api-config'; // Assuming ApiConfig interface exists
import { Page } from 'playwright';

// --- Query ---
// Define what input the pipeline needs
export interface TiktokApiConfigQuery extends IBaseScraperQuery {
  accountId: number;
  // Add other relevant query parameters if needed
}

// --- Options ---
// Define configuration options for the pipeline
export interface TiktokApiConfigOptions extends IBaseScraperOptions {
  // Add specific options for API config handling if needed
  forceRefresh?: boolean;
}

// --- State ---
// Define the state managed during pipeline execution
export interface TiktokApiConfigState extends IBaseScraperState {
  accountId: number;
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
export interface TiktokApiConfigContext
  extends IBaseScraperContext<
    TiktokApiConfigQuery,
    TiktokApiConfigOptions,
    TiktokApiConfigState
  > {
  someProperty: string;
}

// --- Step ---
// Define the interface for steps in this specific pipeline
export interface TiktokApiConfigStep
  extends IGenericScraperStep<TiktokApiConfigContext> {
  someProperty: string;
}

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
