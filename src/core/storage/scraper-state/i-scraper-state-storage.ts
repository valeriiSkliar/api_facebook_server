// src/core/storage/scraper-state/i-scraper-state-storage.ts

import { IBaseScraperQuery } from '@src/scrapers/common/interfaces/base-scraper-query';
import { IBaseScraperOptions } from '@src/scrapers/common/interfaces/base-scraper-options';

/**
 * Interface representing the state of a scraper that can be saved and restored
 */
export interface ScraperState<T = unknown> {
  /** Unique identifier for this scraping task */
  taskId: string;

  /** The original query used for the scraping task */
  query: IBaseScraperQuery;

  /** The options specified for this scraping task */
  options?: Partial<IBaseScraperOptions>;

  /** The current page number being processed (0-based) */
  currentPage: number;

  /** Whether there are more results to fetch */
  hasMoreResults: boolean;

  /** IDs of materials that have been successfully processed */
  processedMaterialIds: string[];

  /** IDs of materials that failed processing */
  failedMaterialIds: string[];

  /** Timestamp when the state was last updated */
  lastUpdated: Date;

  /** Timestamp when the scraping task was started */
  startTime: Date;

  /** Number of retry attempts for the current page */
  retryCount: number;

  /** Maximum retry count allowed */
  maxRetries: number;

  /** Whether the task is currently running */
  isRunning: boolean;

  /** Whether the task was completed successfully */
  isCompleted: boolean;

  /** The error message if the task failed */
  errorMessage?: string;

  /** Any additional data needed for the specific scraper */
  additionalData?: T;
}

/**
 * Interface for storage mechanisms that persist scraper state
 */
export interface IScraperStateStorage {
  /**
   * Saves the state of a scraper
   * @param state The state to save
   * @param ttl Optional Time-to-live in seconds
   */
  saveState<T>(state: ScraperState<T>, ttl?: number): Promise<void>;

  /**
   * Retrieves a scraper state by its task ID
   * @param taskId The unique identifier for the scraping task
   * @returns The scraper state or null if not found
   */
  getState<T>(taskId: string): Promise<ScraperState<T> | null>;

  /**
   * Updates specific fields in a scraper state
   * @param taskId The unique identifier for the scraping task
   * @param updates Partial state containing only the fields to update
   * @returns Whether the update was successful
   */
  updateState<T>(
    taskId: string,
    updates: Partial<ScraperState<T>>,
  ): Promise<boolean>;

  /**
   * Deletes a scraper state
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the deletion was successful
   */
  deleteState(taskId: string): Promise<boolean>;

  /**
   * Lists all stored scraper states
   * @param filter Optional filter criteria
   * @returns Array of scraper states
   */
  listStates<T>(filter?: Partial<ScraperState<T>>): Promise<ScraperState<T>[]>;

  /**
   * Gets all incomplete (non-finished) scraper states
   * @returns Array of incomplete scraper states
   */
  getIncompleteStates<T>(): Promise<ScraperState<T>[]>;

  /**
   * Marks a scraper state as running
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the update was successful
   */
  markAsRunning(taskId: string): Promise<boolean>;

  /**
   * Marks a scraper state as completed
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the update was successful
   */
  markAsCompleted(taskId: string): Promise<boolean>;

  /**
   * Marks a scraper state as failed
   * @param taskId The unique identifier for the scraping task
   * @param errorMessage The error message explaining why it failed
   * @returns Whether the update was successful
   */
  markAsFailed(taskId: string, errorMessage: string): Promise<boolean>;

  /**
   * Get task IDs that have been inactive for a specified period
   * @param inactiveThresholdMinutes Minutes of inactivity to consider a task stalled
   * @returns Array of task IDs that are stalled
   */
  getStalledTasks(inactiveThresholdMinutes?: number): Promise<string[]>;
}
