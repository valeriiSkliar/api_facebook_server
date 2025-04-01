// src/services/browser-pool/types.ts

import { Browser } from 'playwright';

/**
 * Defines the possible states of a browser instance in the pool
 */
export enum BrowserState {
  AVAILABLE = 'AVAILABLE', // Browser is ready for use
  RESERVED = 'RESERVED', // Browser is reserved but not yet in use
  IN_USE = 'IN_USE', // Browser is actively being used
  CLOSING = 'CLOSING', // Browser is in the process of being closed
}

/**
 * Represents a browser instance in the pool
 */
export interface BrowserInstance {
  id: string; // Unique identifier for the browser
  requestId?: string; // ID of the request currently using this browser
  userId?: string; // ID of the user who owns this browser session
  userEmail?: string; // Email of the user who owns this browser session
  createdAt: Date; // When the browser was created
  lastUsedAt: Date; // When the browser was last used
  expiresAt: Date; // When the browser reservation expires
  state: BrowserState; // Current state of the browser
  browser?: Browser; // The actual browser instance (not stored in Redis)
  healthCheck?: Date; // Last time a health check was performed
  healthStatus?: boolean; // Result of the last health check
  metrics?: BrowserMetrics; // Performance metrics for this browser
}

/**
 * Performance metrics for a browser instance
 */
export interface BrowserMetrics {
  creationTime?: number; // Time taken to create the browser in ms
  requestsServed?: number; // Number of requests this browser has served
  averageRequestTime?: number; // Average time to process a request
  errors?: number; // Number of errors encountered
  memoryUsage?: number; // Estimated memory usage if available
}

/**
 * Options for creating a browser
 */
export interface BrowserCreationOptions {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  extraArgs?: string[];
  timeout?: number;
  slowMo?: number;
}

/**
 * Configuration for the browser pool
 */
export interface BrowserPoolConfig {
  minPoolSize?: number; // Minimum number of browsers to keep ready
  maxPoolSize?: number; // Maximum number of browsers allowed
  browserTTL?: number; // Time-to-live for browser in seconds
  healthCheckInterval?: number; // How often to check browser health in ms
  cleanupInterval?: number; // How often to run cleanup in ms
  preWarmingEnabled?: boolean; // Whether to pre-warm browsers during low load
  preWarmThreshold?: number; // Percentage of pool below which to pre-warm
}

/**
 * Result of a browser operation
 */
export interface BrowserOperationResult<T = unknown> {
  success: boolean;
  browserId?: string;
  data?: T;
  error?: Error;
}

/**
 * Callback function type for browser operations
 */
export type BrowserCallback<T> = ({
  browserId,
  browser,
}: {
  browserId: string;
  browser: Browser;
}) => Promise<T>;
