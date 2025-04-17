// src/scrapers/tiktok/pipelines/api-config/tiktok-api-config-types.ts
import {
  IBaseScraperContext,
  IBaseScraperOptions,
  IBaseScraperQuery,
  IBaseScraperResult,
  IBaseScraperState,
  IGenericScraperStep,
} from '@src/scrapers/common/interfaces';
import { ApiConfig } from './api-config.interface';
import {
  Session,
  Email,
  Proxy,
  SessionCookie,
  SessionOrigin,
  SessionLocalStorage,
} from '@prisma/client';
import { Page, BrowserContext } from 'playwright';

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
  // New properties for account session management
  accountsWithValidSessions?: SessionWithRelations[];
  browserContexts?: BrowserSessionContext[];
  currentAccountIndex?: number;
  processingAccounts: Set<number>;
  restoredSessionContexts?: {
    sessionId: string;
    email: string;
    context: BrowserContext;
  }[];
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

/**
 * Interfaces for TikTok account session management
 */

export interface BrowserSessionContext {
  accountId: number;
  username: string;
  email: string;
  browserId: string;
  tabId: string;
  page: Page;
  ready: boolean;
}

export type SessionWithRelations = Session & {
  emailAccount: Email;
  proxy: Proxy | null;
  cookies: SessionCookie[];
  origins: (SessionOrigin & {
    localStorage: SessionLocalStorage[];
  })[];
};
