import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { AuthCredentials } from '@src/models/tik-tok/AuthCredentials';
import { Log } from 'crawlee';
import { Env } from '@lib/Env';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AuthService } from '@src/services/auth/AuthService';

@Injectable()
export class SessionRefreshService {
  private readonly logger = new Logger(SessionRefreshService.name);
  private readonly crawleeLogger: Log;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
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

      // Use the high-level AuthService to refresh the session
      const success = await this.authService.refreshSession(credentials);

      if (success) {
        // Mark the session as updated in the database
        await this.prisma.session.update({
          where: { id: activeSession.id },
          data: {
            last_activity_timestamp: new Date(),
          },
        });

        this.logger.log(
          `Session refresh completed for: ${activeSession.email}`,
        );
      } else {
        this.logger.warn(`Session refresh failed for: ${activeSession.email}`);
      }

      return success;
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

      // Use the high-level AuthService to authenticate
      const success = await this.authService.authenticate(credentials);

      if (success) {
        this.logger.log(
          `New session created for: ${emailAccount.email_address}`,
        );
      } else {
        this.logger.warn(
          `Failed to create new session for: ${emailAccount.email_address}`,
        );
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
