// src/core/storage/scraper-state/redis-scraper-state-storage.ts

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@core/storage/redis/redis.service';
import { IScraperStateStorage, ScraperState } from './i-scraper-state-storage';

@Injectable()
export class RedisScraperStateStorage implements IScraperStateStorage {
  private readonly logger = new Logger(RedisScraperStateStorage.name);
  private readonly STATE_PREFIX = 'scraper:state:';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private readonly redisService: RedisService) {}

  /**
   * Saves the state of a scraper
   * @param state The state to save
   * @param ttl Optional Time-to-live in seconds (defaults to 7 days)
   */
  async saveState<T>(state: ScraperState<T>, ttl?: number): Promise<void> {
    try {
      const key = `${this.STATE_PREFIX}${state.taskId}`;
      const expiry = ttl || this.DEFAULT_TTL;

      // Ensure lastUpdated is set to the current time
      state.lastUpdated = new Date();

      await this.redisService.set(key, state, expiry);
      this.logger.debug(`Saved scraper state for task ${state.taskId}`);
    } catch (error) {
      this.logger.error(
        `Error saving scraper state for task ${state.taskId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Retrieves a scraper state by its task ID
   * @param taskId The unique identifier for the scraping task
   * @returns The scraper state or null if not found
   */
  async getState<T>(taskId: string): Promise<ScraperState<T> | null> {
    try {
      const key = `${this.STATE_PREFIX}${taskId}`;
      return await this.redisService.get<ScraperState<T>>(key);
    } catch (error) {
      this.logger.error(
        `Error getting scraper state for task ${taskId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Updates specific fields in a scraper state
   * @param taskId The unique identifier for the scraping task
   * @param updates Partial state containing only the fields to update
   * @returns Whether the update was successful
   */
  async updateState<T>(
    taskId: string,
    updates: Partial<ScraperState<T>>,
  ): Promise<boolean> {
    try {
      const key = `${this.STATE_PREFIX}${taskId}`;
      const existingState = await this.redisService.get<ScraperState<T>>(key);

      if (!existingState) {
        this.logger.warn(
          `Cannot update state for task ${taskId}: State not found`,
        );
        return false;
      }

      // Merge updates with existing state
      const updatedState = {
        ...existingState,
        ...updates,
        lastUpdated: new Date(),
      };

      // Get TTL of existing key
      const ttl = await this.redisService.ttl(key);
      const expiry = ttl > 0 ? ttl : this.DEFAULT_TTL;

      await this.redisService.set(key, updatedState, expiry);
      return true;
    } catch (error) {
      this.logger.error(
        `Error updating scraper state for task ${taskId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Deletes a scraper state
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the deletion was successful
   */
  async deleteState(taskId: string): Promise<boolean> {
    try {
      const key = `${this.STATE_PREFIX}${taskId}`;
      await this.redisService.del(key);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting scraper state for task ${taskId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Lists all stored scraper states
   * @param filter Optional filter criteria
   * @returns Array of scraper states
   */
  async listStates<T>(
    filter?: Partial<ScraperState<T>>,
  ): Promise<ScraperState<T>[]> {
    try {
      const keys = await this.redisService.keys(`${this.STATE_PREFIX}*`);
      const states: ScraperState<T>[] = [];

      for (const key of keys) {
        const state = await this.redisService.get<ScraperState<T>>(key);
        if (state) {
          // Apply filtering if filter is provided
          if (filter) {
            let matchesFilter = true;
            for (const [key, value] of Object.entries(filter)) {
              if (state[key as keyof ScraperState<T>] !== value) {
                matchesFilter = false;
                break;
              }
            }
            if (matchesFilter) {
              states.push(state);
            }
          } else {
            states.push(state);
          }
        }
      }

      return states;
    } catch (error) {
      this.logger.error('Error listing scraper states:', error);
      return [];
    }
  }

  /**
   * Gets all incomplete (non-finished) scraper states
   * @returns Array of incomplete scraper states
   */
  async getIncompleteStates<T>(): Promise<ScraperState<T>[]> {
    return this.listStates<T>({ isCompleted: false });
  }

  /**
   * Marks a scraper state as running
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the update was successful
   */
  async markAsRunning(taskId: string): Promise<boolean> {
    return this.updateState(taskId, {
      isRunning: true,
      lastUpdated: new Date(),
    });
  }

  /**
   * Marks a scraper state as completed
   * @param taskId The unique identifier for the scraping task
   * @returns Whether the update was successful
   */
  async markAsCompleted(taskId: string): Promise<boolean> {
    return this.updateState(taskId, {
      isRunning: false,
      isCompleted: true,
      lastUpdated: new Date(),
    });
  }

  /**
   * Marks a scraper state as failed
   * @param taskId The unique identifier for the scraping task
   * @param errorMessage The error message explaining why it failed
   * @returns Whether the update was successful
   */
  async markAsFailed(taskId: string, errorMessage: string): Promise<boolean> {
    return this.updateState(taskId, {
      isRunning: false,
      isCompleted: false,
      errorMessage,
      lastUpdated: new Date(),
    });
  }

  /**
   * Get task IDs that have been inactive for a specified period
   * @param inactiveThresholdMinutes Minutes of inactivity to consider a task stalled
   * @returns Array of task IDs that are stalled
   */
  async getStalledTasks(
    inactiveThresholdMinutes: number = 30,
  ): Promise<string[]> {
    try {
      const allRunningStates = await this.listStates<unknown>({
        isRunning: true,
        isCompleted: false,
      });
      const stalledTaskIds: string[] = [];

      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - inactiveThresholdMinutes);

      for (const state of allRunningStates) {
        const lastUpdatedTime = new Date(state.lastUpdated);
        if (lastUpdatedTime < cutoffTime) {
          stalledTaskIds.push(state.taskId);
        }
      }

      return stalledTaskIds;
    } catch (error) {
      this.logger.error('Error getting stalled tasks:', error);
      return [];
    }
  }
}
