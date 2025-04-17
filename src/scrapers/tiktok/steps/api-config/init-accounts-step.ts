/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/database/prisma.service';
import {
  SessionWithRelations,
  TiktokApiConfigContext,
} from '../../pipelines/api-config/tiktok-api-config-types';
import { TiktokApiConfigStep } from './api-config-step';

/**
 * Step responsible for initializing TikTok accounts
 * Gets active accounts from the database and adds them to the context
 */
@Injectable()
export class InitAccountsStep extends TiktokApiConfigStep {
  constructor(
    protected readonly name: string,
    protected readonly logger: Logger,
    private readonly prisma: PrismaService,
  ) {
    super(name, logger);
  }

  async execute(context: TiktokApiConfigContext): Promise<boolean> {
    this.logger.log(`Executing ${this.name}`);

    try {
      // Find active TikTok accounts with valid emails
      const activeAccounts = await this.prisma.tikTokAccount.findMany({
        where: {
          status: 'ACTIVE',
          is_active: true,
        },
        include: {
          email_account: true,
        },
      });

      if (activeAccounts.length === 0) {
        this.logger.warn('No active TikTok accounts found');
        return false;
      }

      this.logger.log(`Found ${activeAccounts.length} active TikTok accounts`);

      // Find active sessions for these accounts
      const accountEmails = activeAccounts.map(
        (account) => account.email_account.email_address,
      );

      const activeSessions: SessionWithRelations[] =
        await this.prisma.session.findMany({
          where: {
            email: {
              in: accountEmails,
            },
            status: 'ACTIVE',
            is_valid: true,
            expires_at: {
              gt: new Date(), // Not expired
            },
          },
          include: {
            emailAccount: true,
            proxy: true,
            cookies: true,
            origins: {
              include: {
                localStorage: true,
              },
            },
          },
        });

      this.logger.log(
        `Found ${activeSessions.length} active sessions for accounts`,
      );

      // Create a mapping of email to session
      const emailToSessionMap = new Map();
      for (const session of activeSessions) {
        emailToSessionMap.set(session.email, session);
      }

      // Prepare accounts with session info
      const accountsWithSessions = activeAccounts.map((account) => {
        const email = account.email_account.email_address;
        const session = emailToSessionMap.get(email);

        return {
          id: account.id,
          username: account.username,
          email: email,
          emailId: account.email_id,
          password: account.password,
          emailPassword: account.email_account.password,
          imapPassword: account.email_account.imap_password || '',
          lastLogin: account.last_login_timestamp || undefined,
          session: session || undefined,
          connectionDetails: account.email_account.connection_details,
        };
      });

      // Filter to accounts with valid sessions
      const accountsWithValidSessions = accountsWithSessions.filter(
        (account) => account.session !== null && account.session !== undefined,
      );

      // Set accounts in context
      context.state.activeAccounts = accountsWithSessions;
      context.state.accountsWithValidSessions = accountsWithValidSessions;

      this.logger.log(
        `Initialized ${accountsWithValidSessions.length} accounts with valid sessions out of ${accountsWithSessions.length} total accounts`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Error in ${this.name}:`, error);
      return false;
    }
  }
}
