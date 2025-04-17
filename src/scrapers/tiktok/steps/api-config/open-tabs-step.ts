import { Logger } from '@nestjs/common';
import { BrowserPoolService } from '@src/core';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';
import { TiktokApiConfigStep } from './api-config-step';
import { Page } from 'playwright';

/**
 * Step to open browser tabs for TikTok accounts in batches.
 * Uses BrowserPoolService to create tabs (up to a concurrency limit).
 * Stores created tabs in context.state.sessionTabs for subsequent steps.
 */
export class OpenTabsStep extends TiktokApiConfigStep {
  private readonly concurrency = 5;

  constructor(
    name: string,
    protected readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {
    super(name, logger);
  }

  override shouldExecute(context: TiktokApiConfigContext): boolean {
    const accounts = context.state.accountsToProcess;
    return Array.isArray(accounts) && accounts.length > 0;
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    try {
      const accounts = context.state.accountsToProcess!;
      const sessionTabs: Array<{
        accountId: number;
        browserId: string;
        tabId: string;
        page?: Page;
      }> = [];
      for (let i = 0; i < accounts.length; i += this.concurrency) {
        const batch = accounts.slice(i, i + this.concurrency);
        const batchResults = await Promise.all(
          batch.map(async (acc) => {
            const requestId = `api_config_${acc.accountId}_${Date.now()}`;
            const userId = acc.accountId.toString();
            const tabRes =
              await this.browserPoolService.createSystemTabForSession(
                requestId,
                userId,
              );
            if (!tabRes) {
              throw new Error(
                `Failed to create tab for account ${acc.accountId}`,
              );
            }
            return {
              accountId: acc.accountId,
              browserId: tabRes.browserId,
              tabId: tabRes.tabId,
              page: tabRes.page,
            };
          }),
        );
        sessionTabs.push(...batchResults);
      }
      context.state.sessionTabs = sessionTabs;
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `[OpenTabsStep] Error opening tabs: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Cleanup opened pages after pipeline completion or on error.
   */
  async cleanup(context: TiktokApiConfigContext): Promise<void> {
    const tabs = context.state.sessionTabs;
    if (!Array.isArray(tabs)) return;
    for (const t of tabs) {
      if (t.page && typeof t.page.close === 'function') {
        try {
          await t.page.close();
        } catch (e) {
          this.logger.warn(
            `[OpenTabsStep] Failed to close page for tab ${t.tabId}: ${e}`,
          );
        }
      }
    }
  }
}
