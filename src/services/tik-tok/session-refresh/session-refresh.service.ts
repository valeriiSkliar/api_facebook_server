import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { AuthCredentials } from '@src/models/tik-tok/AuthCredentials';
import { Log } from 'crawlee';
import { IAuthenticator } from '@src/interfaces/tik-tok/IAuthenticator';
import { Env } from '@lib/Env';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EmailAccount } from '@src/models/tik-tok/email-account';
import { AuthenticatorFactory } from '@src/implementations/factories/tik-tok';
import { BrowserPoolService } from '@src/services/browser-pool/browser-pool-service';
import { TabManager } from '@src/services/browser-pool/tab-manager';
@Injectable()
export class SessionRefreshService {
  private readonly logger = new Logger(SessionRefreshService.name);
  private readonly crawleeLogger: Log;
  constructor(
    private readonly prisma: PrismaService,
    private readonly browserPoolService: BrowserPoolService,
    private readonly tabManager: TabManager,
  ) {
    this.crawleeLogger = new Log({ prefix: 'SessionRefreshService' });
  }

  /**
   * Find the most recent active session and refresh it
   */
  async refreshActiveSession(): Promise<boolean> {
    try {
      this.logger.log('Looking for an active session to refresh');

      // Get the most recent active session
      const activeSession = await this.prisma.session.findFirst({
        where: {
          status: 'ACTIVE',
          is_valid: true,
        },
        orderBy: {
          last_activity_timestamp: 'desc',
        },
        include: {
          emailAccount: true,
        },
      });

      if (!activeSession) {
        this.logger.warn('No active session found for refresh');
        return await this.createNewSession();
      }

      // Create the session storage path if it doesn't exist
      const sessionStoragePath =
        process.env.SESSION_STORAGE_PATH || './storage/sessions';
      await fs.ensureDir(sessionStoragePath);

      // Run the authenticator to refresh the session
      this.logger.log(`Refreshing session for email: ${activeSession.email}`);

      const credentials: AuthCredentials = {
        email: activeSession.email,
        password: Env.TIKTOK_PASSWORD,
        sessionPath: activeSession.storage_path,
      };

      const authenticator = this.createAuthenticator(
        activeSession.emailAccount as EmailAccount,
      );
      await authenticator.runAuthenticator(credentials);

      // Mark the session as updated in the database
      await this.prisma.session.update({
        where: { id: activeSession.id },
        data: {
          last_activity_timestamp: new Date(),
        },
      });

      this.logger.log(`Session refresh completed for: ${activeSession.email}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to refresh session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Create a completely new session when no valid ones exist
   */
  private async createNewSession(): Promise<boolean> {
    try {
      this.logger.log('Creating a new TikTok session');

      // Get the first available email account
      const emailAccount = await this.prisma.email.findFirst({
        where: {
          status: 'ACTIVE',
        },
      });

      if (!emailAccount) {
        this.logger.error('No active email accounts found');
        return false;
      }

      // Create the session storage path
      const sessionStoragePath =
        process.env.SESSION_STORAGE_PATH || './storage/sessions';
      await fs.ensureDir(sessionStoragePath);
      const sessionPath = path.join(
        sessionStoragePath,
        `tiktok_${emailAccount.email_address}.json`,
      );

      // Create credentials and run authenticator
      const credentials: AuthCredentials = {
        email: emailAccount.email_address,
        password: emailAccount.password,
        sessionPath: sessionPath,
      };

      const authenticator = this.createAuthenticator(
        emailAccount as EmailAccount,
      );
      await authenticator.runAuthenticator(credentials);

      this.logger.log(`New session created for: ${emailAccount.email_address}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Create an authenticator instance for the session
   */
  private createAuthenticator(emailAccount: EmailAccount): IAuthenticator {
    return AuthenticatorFactory.createTikTokAuthenticator(
      this.logger,
      {
        sessionStoragePath:
          process.env.SESSION_STORAGE_PATH || './storage/sessions',
        captchaSolverApiKey: Env.SAD_CAPTCHA_API_KEY,
        crawlerOptions: {
          headless: Env.IS_PRODUCTION,
        },
      },
      emailAccount,
      this.browserPoolService,
      this.tabManager,
    );
  }
}
