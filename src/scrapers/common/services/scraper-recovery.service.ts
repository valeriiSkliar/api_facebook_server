// src/scrapers/common/services/scraper-recovery.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';
import {
  IScraperStateStorage,
  ScraperState,
} from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { TikTokScraperFactory } from '@src/scrapers/tiktok/factories/tiktok-scraper.factory';
import {
  TiktokScraperContext,
  TiktokScraperQuery,
} from '@src/scrapers/tiktok/tiktok-scraper-types';
import { TiktokStepFactory } from '@src/scrapers/tiktok/factories/tiktok-step.factory';

@Injectable()
export class ScraperRecoveryService {
  private readonly logger = new Logger(ScraperRecoveryService.name);
  private isRecoveryRunning = false;

  constructor(
    @Inject(SCRAPER_STATE_STORAGE)
    private readonly stateStorage: IScraperStateStorage,
    private readonly tiktokScraperFactory: TikTokScraperFactory,
    private readonly tiktokStepFactory: TiktokStepFactory,
  ) {}

  /**
   * Run every 15 minutes to check for and recover incomplete scraping tasks
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async recoverIncompleteTasks() {
    // Prevent multiple recovery operations from running concurrently
    if (this.isRecoveryRunning) {
      this.logger.log('Recovery operation already in progress, skipping');
      return;
    }

    try {
      this.isRecoveryRunning = true;
      this.logger.log('Starting recovery of incomplete scraping tasks');

      // Get stalled tasks (running but inactive for more than 30 minutes)
      const stalledTasks = await this.stateStorage.getStalledTasks(30);
      this.logger.log(`Found ${stalledTasks.length} stalled tasks`);

      if (stalledTasks.length === 0) {
        return;
      }

      // Get incomplete (not finished but not stalled) tasks
      const incompleteTasks =
        await this.stateStorage.getIncompleteStates<unknown>();
      this.logger.log(`Found ${incompleteTasks.length} incomplete tasks`);

      // Get TikTok tasks that can be recovered
      const tiktokTasks = incompleteTasks.filter(
        (task) =>
          // Only select TikTok tasks (based on query properties or task type)
          Object.prototype.hasOwnProperty.call(task.query, 'period') &&
          Object.prototype.hasOwnProperty.call(task.query, 'orderBy'),
      );

      this.logger.log(
        `Found ${tiktokTasks.length} incomplete TikTok scraping tasks to recover`,
      );

      // Recover each task one by one to avoid overloading the API
      for (const task of tiktokTasks) {
        await this.recoverTiktokTask(task);

        // Add a delay between recovering tasks
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    } catch (error: unknown) {
      this.logger.error(
        'Error during task recovery:',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.isRecoveryRunning = false;
    }
  }

  /**
   * Manually recover a specific task by ID
   * @param taskId The ID of the task to recover
   * @returns Whether the recovery was successful
   */
  async recoverTaskById(taskId: string): Promise<boolean> {
    try {
      this.logger.log(`Manually recovering task ${taskId}`);

      // Get the task state
      const taskState = await this.stateStorage.getState<unknown>(taskId);

      if (!taskState) {
        this.logger.warn(`Task ${taskId} not found`);
        return false;
      }

      // Determine task type and recover accordingly
      if (
        Object.prototype.hasOwnProperty.call(taskState.query, 'period') &&
        Object.prototype.hasOwnProperty.call(taskState.query, 'orderBy')
      ) {
        await this.recoverTiktokTask(taskState);
        return true;
      } else {
        this.logger.warn(`Task ${taskId} has an unsupported type`);
        return false;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error recovering task ${taskId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Process failed materials for a specific task
   * @param taskId The ID of the task to process failed materials for
   * @returns Number of successfully processed materials
   */
  async processFailedMaterials(taskId: string): Promise<number> {
    try {
      this.logger.log(`Processing failed materials for task ${taskId}`);

      // Get the task state
      const taskState = await this.stateStorage.getState<unknown>(taskId);

      if (!taskState) {
        this.logger.warn(`Task ${taskId} not found`);
        return 0;
      }

      // If there are no failed materials, nothing to do
      if (
        !taskState.failedMaterialIds ||
        taskState.failedMaterialIds.length === 0
      ) {
        this.logger.log(`No failed materials for task ${taskId}`);
        return 0;
      }

      // For TikTok tasks, use specific recovery
      if (
        Object.prototype.hasOwnProperty.call(taskState.query, 'period') &&
        Object.prototype.hasOwnProperty.call(taskState.query, 'orderBy')
      ) {
        return await this.processTiktokFailedMaterials(taskState);
      } else {
        this.logger.warn(`Task ${taskId} has an unsupported type`);
        return 0;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error processing failed materials for task ${taskId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return 0;
    }
  }

  /**
   * Recover a TikTok scraping task
   */
  private async recoverTiktokTask(task: ScraperState): Promise<void> {
    this.logger.log(`Recovering TikTok task ${task.taskId}`);

    try {
      // Mark the task as running
      await this.stateStorage.markAsRunning(task.taskId);

      // Create a new scraper instance
      const scraper = this.tiktokScraperFactory.createScraper(task.options);

      // Create the context with the saved query and options
      // We need to cast the query to the right type
      const context = this.tiktokScraperFactory.createContext(
        task.query as TiktokScraperQuery,
        {
          ...task.options,
          resumePreviousTask: true,
          previousTaskId: task.taskId,
        },
      );

      // Restore state from saved data
      this.restoreContextState(context, task);

      // Execute the scraper with the restored context
      const result = await scraper.execute(context);

      if (result.success) {
        this.logger.log(`Successfully recovered task ${task.taskId}`);
        await this.stateStorage.markAsCompleted(task.taskId);
      } else {
        this.logger.warn(
          `Recovered task ${task.taskId} completed with errors: ${result.errors.map((e) => e.message).join(', ')}`,
        );
        await this.stateStorage.markAsFailed(
          task.taskId,
          `Recovery completed with errors: ${result.errors.map((e) => e.message).join(', ')}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error recovering task ${task.taskId}:`,
        error instanceof Error ? error.message : String(error),
      );
      await this.stateStorage.markAsFailed(
        task.taskId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Process failed materials for a TikTok task
   */
  private async processTiktokFailedMaterials(
    task: ScraperState,
  ): Promise<number> {
    this.logger.log(
      `Processing ${task.failedMaterialIds.length} failed materials for TikTok task ${task.taskId}`,
    );

    try {
      // Create a context just for processing failed materials
      const context = this.tiktokScraperFactory.createContext(
        task.query as TiktokScraperQuery,
        {
          ...task.options,
          resumePreviousTask: true,
          previousTaskId: task.taskId,
          processingFailedMaterialsOnly: true,
        },
      );

      // Restore basic context state
      this.restoreContextState(context, task);

      // Set up the material IDs to process only the failed ones
      context.state.materialsIds = [...task.failedMaterialIds];

      // Clear the failures tracking
      context.state.failedMaterialIds = [];

      // Create an instance of the Process Materials Step to reuse its logic
      const processStep = this.tiktokStepFactory.createProcessMaterialsStep();

      // Execute only the material processing step
      const success = await processStep.execute(context);

      if (success) {
        // Calculate how many materials were successfully processed
        const successCount =
          task.failedMaterialIds.length -
          context.state.failedMaterialIds.length;

        // Update the task state with the new processed/failed materials
        await this.stateStorage.updateState(task.taskId, {
          processedMaterialIds: [
            ...task.processedMaterialIds,
            ...task.failedMaterialIds.filter(
              (id) => !context.state.failedMaterialIds.includes(id),
            ),
          ],
          failedMaterialIds: context.state.failedMaterialIds,
          lastUpdated: new Date(),
        });

        this.logger.log(
          `Successfully processed ${successCount} out of ${task.failedMaterialIds.length} failed materials for task ${task.taskId}`,
        );
        return successCount;
      } else {
        this.logger.warn(
          `Failed to process failed materials for task ${task.taskId}`,
        );
        return 0;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error processing failed materials for task ${task.taskId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return 0;
    }
  }

  /**
   * Restore context state from saved task state
   */
  private restoreContextState(
    context: TiktokScraperContext,
    savedState: ScraperState,
  ): void {
    // Set task ID
    context.state.taskId = savedState.taskId;

    // Restore pagination state
    context.state.currentPage = savedState.currentPage;
    context.state.hasMoreResults = savedState.hasMoreResults;

    // Restore processed and failed materials tracking
    context.state.processedMaterialIds = savedState.processedMaterialIds || [];
    context.state.failedMaterialIds = savedState.failedMaterialIds || [];

    // Set start time from saved state
    context.state.startTime = new Date(savedState.startTime);

    this.logger.log(
      `Restored context for task ${savedState.taskId} with ${context.state.processedMaterialIds.length} processed materials and ${context.state.failedMaterialIds.length} failed materials`,
    );
  }

  /**
   * Get stats about incomplete tasks
   */
  async getRecoveryStats(): Promise<{
    totalIncompleteTasks: number;
    stalledTasks: number;
    failedTasks: number;
    tiktokTasks: number;
    pendingMaterials: number;
  }> {
    try {
      const incompleteTasks =
        await this.stateStorage.getIncompleteStates<unknown>();
      const stalledTasks = await this.stateStorage.getStalledTasks(30);

      // Get tasks with isCompleted = false and error message exists
      const failedTasks = incompleteTasks.filter((task) => task.errorMessage);

      // Get TikTok tasks
      const tiktokTasks = incompleteTasks.filter(
        (task) =>
          Object.prototype.hasOwnProperty.call(task.query, 'period') &&
          Object.prototype.hasOwnProperty.call(task.query, 'orderBy'),
      );

      // Calculate total pending materials
      const pendingMaterials = tiktokTasks.reduce((total, task) => {
        return total + (task.failedMaterialIds?.length || 0);
      }, 0);

      return {
        totalIncompleteTasks: incompleteTasks.length,
        stalledTasks: stalledTasks.length,
        failedTasks: failedTasks.length,
        tiktokTasks: tiktokTasks.length,
        pendingMaterials,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error getting recovery stats:',
        error instanceof Error ? error.message : String(error),
      );
      return {
        totalIncompleteTasks: 0,
        stalledTasks: 0,
        failedTasks: 0,
        tiktokTasks: 0,
        pendingMaterials: 0,
      };
    }
  }
}
