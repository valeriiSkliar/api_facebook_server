import { Injectable, Logger } from '@nestjs/common';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';
import { BrowserPoolService } from '@core/browser/browser-pool/browser-pool-service';
import { TiktokApiConfigStep } from './api-config-step';

/**
 * Step responsible for opening browser tab for TikTok API config collection
 * Creates a single browser context/tab for collecting API configurations
 */
@Injectable()
export class OpenTabsStep extends TiktokApiConfigStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly browserPoolService: BrowserPoolService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    const { accountsWithValidSessions } = context.state;

    if (!accountsWithValidSessions?.length) {
      this.logger.warn('No accounts with valid sessions found');
      return false;
    }

    this.logger.log(
      `Attempting to open tabs for ${accountsWithValidSessions.length} accounts.`,
    );
    context.state.browserContexts = []; // Initialize as empty array
    let successCount = 0;

    for (const account of accountsWithValidSessions) {
      try {
        const result = await this.browserPoolService.createSystemTabForSession(
          `tiktok_session_${account.id}`,
          account.emailAccount.email_address, // Use email as identifier
        );

        if (!result) {
          this.logger.error(
            `Failed to create browser tab for account ${account.id} (${account.emailAccount.email_address})`,
          );
          continue; // Try next account
        }

        // Store browser context info in state
        context.state.browserContexts.push({
          accountId: account.id,
          username: account.emailAccount.email_address,
          email: account.emailAccount.email_address,
          browserId: result.browserId,
          tabId: result.tabId,
          page: result.page,
          ready: false, // Mark as not ready initially, session restore will set it
        });

        successCount++;
        this.logger.log(
          `Created browser tab ${result.tabId} in browser ${result.browserId.substring(0, 8)} for account ${account.id} (${account.emailAccount.email_address})`,
        );
      } catch (error) {
        this.logger.error(
          `Error creating browser tab for account ${account.id} (${account.emailAccount.email_address}):`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue to the next account even if one fails
      }
    }

    if (successCount > 0) {
      this.logger.log(
        `Successfully created ${successCount} out of ${accountsWithValidSessions.length} requested browser tabs.`,
      );
      return true;
    } else {
      this.logger.error(
        `Failed to create any browser tabs for the ${accountsWithValidSessions.length} accounts.`,
      );
      return false;
    }
  }
}
