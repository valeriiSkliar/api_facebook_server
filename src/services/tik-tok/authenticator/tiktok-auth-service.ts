// src/services/tik-tok/authenticator/TikTokAuthService.ts

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { PrismaService } from '@src/database';
import { Injectable, Logger } from '@nestjs/common';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import { AuthCredentials } from '@src/models/tik-tok/auth-credentials';
import { Env } from '@src/config';
// import { EmailAccount } from '@src/models/tik-tok/email-account';
import * as fs from 'fs-extra';
import * as path from 'path';

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
