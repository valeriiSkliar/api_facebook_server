// src/core/storage/scraper-state/scraper-state-storage.token.ts

import { IScraperStateStorage } from './i-scraper-state-storage';

export const SCRAPER_STATE_STORAGE = Symbol('SCRAPER_STATE_STORAGE');

// Type for use with @Inject() decorator
export type ScraperStateStorageToken = IScraperStateStorage;
