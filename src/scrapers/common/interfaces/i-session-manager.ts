import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import { Session } from '@src/core/common/models/session';

/**
 * Interface for session management
 * Defines the contract for any session manager implementation
 */
export interface ISessionManager {
  /**
   * Creates a new session with the provided credentials
   * @param credentials User credentials for session creation
   * @returns Promise resolving to the created session
   */
  createSession(credentials: AuthCredentials): Promise<Session>;

  /**
   * Retrieves a session by its ID
   * @param sessionId ID of the session to retrieve
   * @returns Promise resolving to the session or null if not found
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Saves a session to persistent storage
   * @param session Session to save
   * @returns Promise resolving when save is complete
   */
  saveSession(session: Session): Promise<void>;

  /**
   * Deletes a session by its ID
   * @param sessionId ID of the session to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Lists all available sessions
   * @returns Promise resolving to an array of sessions
   */
  listSessions(): Promise<Session[]>;
}
