// src/authenticators/tik-tok/tiktok-auth-service.ts

import { PrismaService } from '@src/database';
import { Injectable, Logger } from '@nestjs/common';
import { TikTokAuthenticator } from './tik-tok-authenticator';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { Env } from '@src/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Email } from '@prisma/client';

interface TikTokAccount {
  id: number;
  username: string;
  password: string;
  email_account: {
    id: number;
    email_address: string;
    created_at: Date;
    status: string;
    provider: string;
    imap_password: string;
    connection_details: any;
    username: string;
    password: string;
    last_check_timestamp: Date | null;
    is_associated: boolean;
    updated_at: Date;
  };
}

@Injectable()
export class TikTokAuthService {
  private readonly logger = new Logger(TikTokAuthService.name);
  private readonly sessionStoragePath: string;

  constructor(
    private readonly authenticator: TikTokAuthenticator,
    private readonly prisma: PrismaService,
  ) {
    this.sessionStoragePath =
      process.env.SESSION_STORAGE_PATH || './storage/sessions';
    this.ensureSessionStorageExists();
  }

  /**
   * Ensure the session storage directory exists
   */
  private async ensureSessionStorageExists(): Promise<void> {
    try {
      await fs.ensureDir(this.sessionStoragePath);
      this.logger.log(
        `Session storage directory ensured at: ${this.sessionStoragePath}`,
      );
    } catch (error) {
      this.logger.error('Failed to create session storage directory', {
        error: error instanceof Error ? error.message : String(error),
        path: this.sessionStoragePath,
      });
    }
  }

  /**
   * Find active session or create new one if needed
   */
  async getOrCreateSession(): Promise<{
    success: boolean;
    sessionId?: number;
    email?: string;
  }> {
    try {
      // Find active session
      const activeSession = await this.prisma.session.findFirst({
        where: {
          status: 'ACTIVE',
          is_valid: true,
          expires_at: {
            gt: new Date(), // Not expired
          },
        },
        orderBy: {
          last_activity_timestamp: 'desc',
        },
        include: {
          emailAccount: true,
        },
      });

      // If we have an active session, return its details
      if (activeSession) {
        this.logger.log('Found active session', {
          sessionId: activeSession.id,
          email: activeSession.email,
        });

        return {
          success: true,
          sessionId: activeSession.id,
          email: activeSession.email,
        };
      }

      // No active session, create a new one
      this.logger.log('No active session found, creating new one');
      const newSession = await this.createNewSession();

      return newSession;
    } catch (error) {
      this.logger.error('Error in getOrCreateSession', {
        error: error instanceof Error ? error.message : String(error),
      });

      return { success: false };
    }
  }

  /**
   * Create a new TikTok session
   */
  async createNewSession(): Promise<{
    success: boolean;
    sessionId?: number;
    email?: string;
  }> {
    try {
      // Find an available email account
      const emailAccount = await this.prisma.email.findFirst({
        where: {
          status: 'ACTIVE',
          is_associated: false, // Not already associated with an active session
        },
      });

      if (!emailAccount) {
        this.logger.error(
          'No available email accounts found for creating session',
        );
        return { success: false };
      }

      // Create a session file path
      const sessionFileName = `tiktok_${emailAccount.email_address.replace(/[@.]/g, '_')}.json`;
      const sessionPath = path.join(this.sessionStoragePath, sessionFileName);

      // Create authentication credentials
      const credentials: AuthCredentials = {
        email: emailAccount.email_address,
        password: emailAccount.password || Env.TIKTOK_PASSWORD,
        imap_password: (emailAccount.imap_password as string) || '',
        sessionPath,
      };

      // Run the authenticator
      await this.authenticator.runAuthenticator(credentials);

      // Create session record in database
      const newSession = await this.prisma.session.create({
        data: {
          email: emailAccount.email_address,
          status: 'ACTIVE',
          is_valid: true,
          storage_path: sessionPath,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          created_at: new Date(),
          last_activity_timestamp: new Date(),
          session_data: {},
        },
      });

      // Update the email account to show it's associated with a session
      await this.prisma.email.update({
        where: { id: emailAccount.id },
        data: { is_associated: true, updated_at: new Date() },
      });

      this.logger.log('New session created successfully', {
        sessionId: newSession.id,
        email: newSession.email,
      });

      return {
        success: true,
        sessionId: newSession.id,
        email: newSession.email,
      };
    } catch (error) {
      this.logger.error('Failed to create new session', {
        error: error instanceof Error ? error.message : String(error),
      });

      return { success: false };
    }
  }

  /**
   * Create TikTok sessions for all available email accounts
   * @returns Array of created session details
   */
  async createSessionsForAllAccounts(): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    sessions: Array<{ sessionId: number; email: string; success: boolean }>;
  }> {
    try {
      // Find all available active email accounts that are not associated with a session
      const emailAccounts = await this.prisma.email.findMany({
        where: {
          status: 'ACTIVE',
          is_associated: false,
        },
      });

      if (emailAccounts.length === 0) {
        this.logger.log(
          'No available email accounts found for creating sessions',
        );
        return {
          success: true,
          totalProcessed: 0,
          successCount: 0,
          failedCount: 0,
          sessions: [],
        };
      }

      this.logger.log(
        `Found ${emailAccounts.length} email accounts to create sessions for`,
      );

      const sessionResults: Array<{
        sessionId: number;
        email: string;
        success: boolean;
      }> = [];
      let successCount = 0;
      let failedCount = 0;

      // Process each email account sequentially to create sessions
      for (const emailAccount of emailAccounts) {
        try {
          const result = await this.createSessionForAccount(emailAccount);
          sessionResults.push(result);

          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          this.logger.error(
            `Error creating session for account ${emailAccount.email_address}`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );

          sessionResults.push({
            sessionId: 0,
            email: emailAccount.email_address,
            success: false,
          });

          failedCount++;
        }
      }

      return {
        success: successCount > 0,
        totalProcessed: emailAccounts.length,
        successCount,
        failedCount,
        sessions: sessionResults,
      };
    } catch (error) {
      this.logger.error('Error in createSessionsForAllAccounts', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        sessions: [],
      };
    }
  }

  /**
   * Create a session for a specific email account
   */
  private async createSessionForAccount(emailAccount: Email): Promise<{
    sessionId: number;
    email: string;
    success: boolean;
  }> {
    try {
      this.logger.log(
        `Creating session for email account: ${emailAccount.email_address}`,
      );

      // Create a session file path
      const sessionFileName = `tiktok_${emailAccount.email_address.replace(/[@.]/g, '_')}.json`;
      const sessionPath = path.join(this.sessionStoragePath, sessionFileName);

      // Create authentication credentials
      const credentials: AuthCredentials = {
        email: emailAccount.email_address,
        password: emailAccount.password || Env.TIKTOK_PASSWORD,
        imap_password: (emailAccount.imap_password as string) || '',
        sessionPath,
      };

      // Run the authenticator
      await this.authenticator.runAuthenticator(credentials);

      // Create session record in database
      const newSession = await this.prisma.session.create({
        data: {
          email: emailAccount.email_address,
          status: 'ACTIVE',
          is_valid: true,
          storage_path: sessionPath,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          created_at: new Date(),
          last_activity_timestamp: new Date(),
          session_data: {},
        },
      });

      // Update the email account to show it's associated with a session
      await this.prisma.email.update({
        where: { id: emailAccount.id },
        data: { is_associated: true, updated_at: new Date() },
      });

      this.logger.log(
        `Session created successfully for ${emailAccount.email_address}`,
        {
          sessionId: newSession.id,
        },
      );

      return {
        success: true,
        sessionId: newSession.id,
        email: emailAccount.email_address,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create session for ${emailAccount.email_address}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      return {
        success: false,
        sessionId: 0,
        email: emailAccount.email_address,
      };
    }
  }

  /**
   * Create sessions for TikTok accounts with associated email accounts
   * Will create a session for each TikTok account that has an associated email
   * which doesn't already have an active session
   */
  async createSessionsForTikTokAccounts(): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    sessions: Array<{
      sessionId: number;
      email: string;
      tiktokUsername: string;
      success: boolean;
    }>;
  }> {
    try {
      // Find all active TikTok accounts with their associated email accounts
      const tiktokAccounts = await this.prisma.tikTokAccount.findMany({
        where: {
          status: 'ACTIVE',
          is_active: true,
        },
        include: {
          email_account: true,
        },
      });

      if (tiktokAccounts.length === 0) {
        this.logger.log(
          'No active TikTok accounts found for creating sessions',
        );
        return {
          success: true,
          totalProcessed: 0,
          successCount: 0,
          failedCount: 0,
          sessions: [],
        };
      }

      // Filter to only include TikTok accounts whose email doesn't already have an active session
      const accountsToProcess: TikTokAccount[] = [];
      for (const account of tiktokAccounts) {
        const existingSession = await this.prisma.session.findFirst({
          where: {
            email: account.email_account.email_address,
            status: 'ACTIVE',
            is_valid: true,
            expires_at: {
              gt: new Date(),
            },
          },
        });

        if (!existingSession) {
          accountsToProcess.push(account);
        }
      }

      this.logger.log(
        `Found ${accountsToProcess.length} TikTok accounts to create sessions for`,
      );

      const sessionResults: Array<{
        sessionId: number;
        email: string;
        tiktokUsername: string;
        success: boolean;
      }> = [];
      let successCount = 0;
      let failedCount = 0;

      // Process each TikTok account sequentially to create sessions
      for (const tiktokAccount of accountsToProcess) {
        try {
          const emailAccount = tiktokAccount.email_account;

          // Create a session file path
          const sessionFileName = `tiktok_${emailAccount.email_address.replace(/[@.]/g, '_')}_${tiktokAccount.username.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
          const sessionPath = path.join(
            this.sessionStoragePath,
            sessionFileName,
          );

          // Create authentication credentials
          const credentials: AuthCredentials = {
            email: emailAccount.email_address,
            password: tiktokAccount.password, // Use TikTok account password
            imap_password: emailAccount.imap_password || '',
            sessionPath,
          };

          // Run the authenticator
          await this.authenticator.runAuthenticator(credentials);

          // Create session record in database
          const newSession = await this.prisma.session.create({
            data: {
              email: emailAccount.email_address,
              status: 'ACTIVE',
              is_valid: true,
              storage_path: sessionPath,
              last_activity_timestamp: new Date(),
              created_at: new Date(),
              session_data: {
                tiktokUsername: tiktokAccount.username,
                tiktokAccountId: tiktokAccount.id,
              },
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            },
          });

          // Update the TikTok account's last login timestamp
          await this.prisma.tikTokAccount.update({
            where: { id: tiktokAccount.id },
            data: {
              last_login_timestamp: new Date(),
              last_auth_success: new Date(),
            },
          });

          sessionResults.push({
            success: true,
            sessionId: newSession.id,
            email: emailAccount.email_address,
            tiktokUsername: tiktokAccount.username,
          });

          successCount++;

          this.logger.log(
            `Session created successfully for TikTok account ${tiktokAccount.username}`,
            {
              sessionId: newSession.id,
              email: emailAccount.email_address,
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to create session for TikTok account ${tiktokAccount.username}`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );

          sessionResults.push({
            success: false,
            sessionId: 0,
            email: tiktokAccount.email_account.email_address,
            tiktokUsername: tiktokAccount.username,
          });

          failedCount++;
        }
      }

      return {
        success: successCount > 0,
        totalProcessed: accountsToProcess.length,
        successCount,
        failedCount,
        sessions: sessionResults,
      };
    } catch (error) {
      this.logger.error('Error in createSessionsForTikTokAccounts', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        sessions: [],
      };
    }
  }

  /**
   * Refresh an existing session to extend its validity
   */
  async refreshSession(sessionId: number): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { emailAccount: true },
      });

      if (!session || !session.is_valid) {
        this.logger.warn(`Session ${sessionId} not found or invalid`);
        return false;
      }

      this.logger.log(`Refreshing session ${sessionId}`);

      // Create credentials for the session
      const credentials: AuthCredentials = {
        email: session.email,
        password: session.emailAccount?.password || Env.TIKTOK_PASSWORD,
        imap_password: (session.emailAccount?.imap_password as string) || '',
        sessionPath: session.storage_path,
      };

      // Run the authenticator to refresh the session
      await this.authenticator.runAuthenticator(credentials);

      // Update session in database
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          last_activity_timestamp: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Extend by 24 hours
        },
      });

      this.logger.log(`Session ${sessionId} refreshed successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to refresh session ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Refresh all active but near-expiry sessions
   */
  async refreshAllExpiringSessions(): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    sessions: Array<{ sessionId: number; email: string; success: boolean }>;
  }> {
    try {
      // Find all active sessions that will expire in less than 2 hours
      const expiryThreshold = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

      const expiringSessions = await this.prisma.session.findMany({
        where: {
          status: 'ACTIVE',
          is_valid: true,
          expires_at: {
            lt: expiryThreshold,
            gt: new Date(), // Not already expired
          },
        },
        include: {
          emailAccount: true,
        },
        orderBy: {
          expires_at: 'asc', // Process the most urgent ones first
        },
      });

      if (expiringSessions.length === 0) {
        this.logger.log('No expiring sessions found that need refresh');
        return {
          success: true,
          totalProcessed: 0,
          successCount: 0,
          failedCount: 0,
          sessions: [],
        };
      }

      this.logger.log(
        `Found ${expiringSessions.length} sessions that need to be refreshed`,
      );

      const refreshResults: Array<{
        sessionId: number;
        email: string;
        success: boolean;
      }> = [];
      let successCount = 0;
      let failedCount = 0;

      // Process each session sequentially
      for (const session of expiringSessions) {
        try {
          const success = await this.refreshSession(session.id);

          refreshResults.push({
            sessionId: session.id,
            email: session.email,
            success,
          });

          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          this.logger.error(`Error refreshing session ${session.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });

          refreshResults.push({
            sessionId: session.id,
            email: session.email,
            success: false,
          });

          failedCount++;
        }
      }

      return {
        success: successCount > 0,
        totalProcessed: expiringSessions.length,
        successCount,
        failedCount,
        sessions: refreshResults,
      };
    } catch (error) {
      this.logger.error('Error in refreshAllExpiringSessions', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        sessions: [],
      };
    }
  }

  /**
   * Check if a session is valid and refresh if needed
   */
  async validateSession(sessionId: number): Promise<boolean> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`Session ${sessionId} not found`);
        return false;
      }

      // Check if session is about to expire (less than 1 hour remaining)
      const expiryThreshold = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      if (session.expires_at < expiryThreshold) {
        this.logger.log(`Session ${sessionId} is close to expiry, refreshing`);
        return await this.refreshSession(sessionId);
      }

      // Session is valid and not close to expiry
      return true;
    } catch (error) {
      this.logger.error(`Error validating session ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Invalidate a session (mark as not valid)
   */
  async invalidateSession(sessionId: number): Promise<boolean> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          is_valid: false,
          status: 'INVALID',
        },
      });

      this.logger.log(`Session ${sessionId} invalidated`);
      return true;
    } catch (error) {
      this.logger.error(`Error invalidating session ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }
}
