/**
 * Interface representing a browser cookie
 */
export interface ICookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Interface representing a localStorage origin with its items
 */
export interface IOriginStorage {
  origin: string;
  localStorage: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Interface representing the complete storage state returned by context.storageState()
 * This includes cookies and localStorage data
 */
export interface IStorageState {
  cookies: ICookie[];
  origins: IOriginStorage[];
}

/**
 * Type alias for the storage state returned by Page.context().storageState()
 */
export type StorageState = IStorageState;
