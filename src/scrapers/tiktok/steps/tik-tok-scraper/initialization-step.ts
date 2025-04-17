import { AuthStepType } from '@src/scrapers/common/interfaces';
import { TiktokScraperStep } from './tiktok-scraper-step';
import {
  TiktokScraperContext,
  TiktokScraperState,
} from '../../tiktok-scraper-types';
import {
  IScraperStateStorage,
  ScraperState,
} from '@src/core/storage/scraper-state/i-scraper-state-storage';
import { Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SCRAPER_STATE_STORAGE } from '@src/core/storage/scraper-state/scraper-state-storage.token';

export class InitializationStep extends TiktokScraperStep {
  private readonly stepType: AuthStepType;

  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    @Inject(SCRAPER_STATE_STORAGE)
    private readonly stateStorage: IScraperStateStorage,
  ) {
    super(name, logger);
  }

  getType(): AuthStepType {
    return this.stepType;
  }

  /**
   * Execute the initialization step
   * @param context TikTok scraper context
   * @returns Promise resolving to true if initialization was successful
   */
  async execute(context: TiktokScraperContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    try {
      // Generate a unique task ID if not present
      if (!context.state.taskId) {
        context.state.taskId = uuidv4();
        this.logger.log(`Generated new task ID: ${context.state.taskId}`);
      }

      // Check if we should restore from a saved state
      if (
        context.options.resumePreviousTask &&
        context.options.previousTaskId
      ) {
        this.logger.log(
          `Attempting to restore state for task: ${context.options.previousTaskId}`,
        );
        const restored = await this.restoreState(
          context,
          context.options.previousTaskId,
        );

        if (restored) {
          this.logger.log(
            `Successfully restored state for task: ${context.options.previousTaskId}`,
          );
          // Use the previous task ID
          context.state.taskId = context.options.previousTaskId;
        } else {
          this.logger.warn(
            `Failed to restore state for task: ${context.options.previousTaskId}, starting fresh`,
          );
          // Initialize the state with default values
          this.initializeNewState(context);
        }
      } else if (context.options.forceRestart) {
        this.logger.log(`Force restart requested, starting with fresh state`);
        this.initializeNewState(context);
      } else {
        this.logger.log(`Starting with fresh state`);
        this.initializeNewState(context);
      }

      // Save the initial state
      await this.saveCurrentState(context);

      // Mark the task as running
      await this.stateStorage.markAsRunning(context.state.taskId);

      return true;
    } catch (error) {
      this.logger.error(`Error in initialization step:`, error);
      return false;
    }
  }

  /**
   * Initialize a new state with default values
   */
  private initializeNewState(context: TiktokScraperContext): void {
    context.state = {
      taskId: uuidv4(),
      startTime: new Date(),
      apiErrors: [],
      failedMaterials: [],
      processedMaterialIds: [],
      failedMaterialIds: [],
      currentPage: 1,
      hasMoreResults: true,
      errors: [],
      forceStop: false,
      adsCollected: [],
    };
  }

  /**
   * Restore state from storage
   */
  private async restoreState(
    context: TiktokScraperContext,
    taskId: string,
  ): Promise<boolean> {
    try {
      const savedState = await this.stateStorage.getState<any>(taskId);

      if (!savedState) {
        return false;
      }

      // Restore pagination state
      context.state.currentPage = savedState.currentPage;
      context.state.hasMoreResults = savedState.hasMoreResults;

      // Restore processed and failed materials
      context.state.processedMaterialIds =
        savedState.processedMaterialIds || [];
      context.state.failedMaterialIds = savedState.failedMaterialIds || [];

      // Set the start time from the saved state
      context.state.startTime = new Date(savedState.startTime);

      this.logger.log(
        `Restored state with ${context.state.processedMaterialIds.length} processed materials and page ${context.state.currentPage}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Error restoring state for task ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Save the current state to storage
   */
  private async saveCurrentState(context: TiktokScraperContext): Promise<void> {
    // Map the context state to our storage format
    const stateToSave: ScraperState<TiktokScraperState> = {
      taskId: context.state.taskId,
      query: context.query,
      options: context.options,
      currentPage: context.state.currentPage ?? 1,
      hasMoreResults: context.state.hasMoreResults ?? true,
      processedMaterialIds: context.state.processedMaterialIds || [],
      failedMaterialIds: context.state.failedMaterialIds || [],
      lastUpdated: new Date(),
      startTime: context.state.startTime || new Date(),
      retryCount: 0,
      maxRetries: context.options.retryAttempts || 3,
      isRunning: true,
      isCompleted: false,
    };

    await this.stateStorage.saveState(stateToSave);
  }

  /**
   * Clean up resources used by this step
   * @param context TikTok scraper context
   */
  async cleanup(): Promise<void> {
    this.logger.log(
      '[TiktokInitializationStep.cleanup] Skipping cleanup for externally managed resources',
    );

    return Promise.resolve();
  }
}
