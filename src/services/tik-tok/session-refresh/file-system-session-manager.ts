/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger, Injectable } from '@nestjs/common';
import { ISessionManager } from '@src/scrapers/common/interfaces';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { Session } from '@src/core/common/models/session';
import { PrismaService } from '@src/database';

/**
 * File system based session manager implementation
 * Stores and retrieves session data from the file system
 */
@Injectable()
export class FileSystemSessionManager implements ISessionManager {
  private readonly logger = new Logger(FileSystemSessionManager.name);
  private readonly sessionStoragePath: string;

  /**
   * Creates a new FileSystemSessionManager instance
   * @param prisma PrismaService instance
   */
  constructor(private readonly prisma: PrismaService) {
    this.sessionStoragePath =
      process.env.SESSION_STORAGE_PATH || './storage/sessions';
    this.initializeStorage();
  }

  /**
   * Creates a new session for the given credentials
   * @param credentials Authentication credentials
   * @returns Promise resolving to the created session
   */
  async createSession(credentials: AuthCredentials): Promise<Session> {
    this.logger.log('Creating new session', { email: credentials.email });

    // Generate a unique session ID
    const sessionId = `tiktok_${credentials.email}_${Date.now()}`;

    // Create session object with default values
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24); // Default expiration: 24 hours

    const session: Session = {
      id: sessionId,
      userId: credentials.email, // Using email as user ID
      cookies: [],
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      createdAt: now,
      expiresAt,
      lastUsedAt: now,
      proxyConfig: credentials.proxyConfig,
    };

    // Save the session to storage
    await this.saveSession(session);

    this.logger.log('Session created successfully', { sessionId });
    return session;
  }

  /**
   * Retrieves a session by its ID
   * @param sessionId ID of the session to retrieve
   * @returns Promise resolving to the session or null if not found
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      this.logger.log('Retrieving session', { sessionId });

      const sessionFilePath = this.getSessionFilePath(sessionId);

      // Check if session file exists
      if (!(await fs.pathExists(sessionFilePath))) {
        this.logger.log('Session not found', { sessionId });
        return null;
      }

      // Read and parse session data
      const sessionData = await fs.readJson(sessionFilePath);

      // Convert date strings back to Date objects
      const session: Session = {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: new Date(sessionData.expiresAt),
        lastUsedAt: new Date(sessionData.lastUsedAt),
      };

      // Check if session has expired
      if (session.expiresAt < new Date()) {
        this.logger.log('Session has expired', {
          sessionId,
          expiresAt: session.expiresAt.toISOString(),
        });
        return null;
      }

      this.logger.log('Session retrieved successfully', { sessionId });
      return session;
    } catch (error) {
      this.logger.error('Error retrieving session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Saves a session to persistent storage
   * @param session Session to save
   * @returns Promise resolving when the session is saved
   */
  async saveSession(session: Session): Promise<void> {
    try {
      this.logger.log('Saving session', { sessionId: session.id });

      const sessionFilePath = this.getSessionFilePath(session.id);

      // Ensure the directory exists
      await fs.ensureDir(path.dirname(sessionFilePath));

      // Write session data to file
      await fs.writeJson(sessionFilePath, session, { spaces: 2 });

      this.logger.log('Session saved successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Error saving session', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Deletes a session by its ID
   * @param sessionId ID of the session to delete
   * @returns Promise resolving when the session is deleted
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      this.logger.log('Deleting session', { sessionId });

      const sessionFilePath = this.getSessionFilePath(sessionId);

      // Check if session file exists
      if (!(await fs.pathExists(sessionFilePath))) {
        this.logger.log('Session not found for deletion', { sessionId });
        return;
      }

      // Delete the session file
      await fs.remove(sessionFilePath);

      this.logger.log('Session deleted successfully', { sessionId });
    } catch (error) {
      this.logger.error('Error deleting session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Lists all available sessions
   * @returns Promise resolving to an array of sessions
   */
  async listSessions(): Promise<Session[]> {
    try {
      this.logger.log('Listing all sessions');

      // Ensure the directory exists
      await fs.ensureDir(this.sessionStoragePath);

      // Get all session files
      const sessionFiles = await fs.readdir(this.sessionStoragePath);
      const jsonFiles = sessionFiles.filter((file) => file.endsWith('.json'));

      this.logger.log(`Found ${jsonFiles.length} session files`);

      // Read and parse each session file
      const sessions: Session[] = [];
      const now = new Date();

      for (const file of jsonFiles) {
        try {
          const sessionFilePath = path.join(this.sessionStoragePath, file);
          const sessionData = await fs.readJson(sessionFilePath);

          // Convert date strings back to Date objects
          const session: Session = {
            ...sessionData,
            createdAt: new Date(sessionData.createdAt),
            expiresAt: new Date(sessionData.expiresAt),
            lastUsedAt: new Date(sessionData.lastUsedAt),
          };

          // Only include non-expired sessions
          if (session.expiresAt > now) {
            sessions.push(session);
          } else {
            this.logger.debug('Skipping expired session', {
              sessionId: session.id,
            });
          }
        } catch (fileError) {
          this.logger.debug(`Error reading session file ${file}`, {
            error:
              fileError instanceof Error
                ? fileError.message
                : String(fileError),
          });
          // Continue with other files
        }
      }

      this.logger.log(`Retrieved ${sessions.length} valid sessions`);
      return sessions;
    } catch (error) {
      this.logger.error('Error listing sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Gets the file path for a session
   * @param sessionId Session ID
   * @returns File path
   * @private
   */
  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionStoragePath, `${sessionId}.json`);
  }

  /**
   * Initializes the storage directory
   * @private
   */
  private async initializeStorage(): Promise<void> {
    try {
      this.logger.log('Initializing session storage', {
        path: this.sessionStoragePath,
      });
      await fs.ensureDir(this.sessionStoragePath);
      this.logger.log('Session storage initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing session storage', {
        path: this.sessionStoragePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
