import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import { TiktokApiConfigContext } from '../../pipelines/api-config/tiktok-api-config-types';
import { TiktokApiConfigStep } from './tiktok-api-config-step';

/**
 * Initialization step for TikTok API Config pipeline.
 * Fetches the list of TikTok accounts with valid sessions for which API configurations should be parsed.
 */
export class InitAccountsStep extends TiktokApiConfigStep {
  constructor(
    private readonly prismaService: PrismaService,
    logger: Logger,
  ) {
    super('InitAccountsStep', logger);
  }

  override shouldExecute(context: TiktokApiConfigContext): boolean {
    // Execute only if accounts list is not yet set in state
    return !context.state.accountsToProcess;
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    try {
      // Retrieve active TikTok accounts with valid sessions
      const accounts = await this.prismaService.tikTokAccount.findMany({
        where: {
          is_active: true,
          email_account: {
            sessions: {
              some: { is_valid: true },
            },
          },
        },
        include: {
          email_account: {
            include: {
              sessions: {
                where: { is_valid: true },
                take: 1,
              },
            },
          },
        },
      });
      // Map to accountId and sessionData
      context.state.accountsToProcess = accounts.map((account) => ({
        accountId: account.id,
        sessionData: account.email_account.sessions[0],
      }));
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `[InitAccountsStep] Failed to retrieve accounts: ${error instanceof Error ? error.message : String(error)}`,
      );
      context.state.errors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }
}
