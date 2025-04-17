import { Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AuthenticatorContext } from '@src/authenticators/common/models/authenticator-context';
import { AuthCredentials } from '@src/authenticators/common/models/auth-credentials';
import {
  AuthStepType,
  IAuthenticationStep,
} from '@src/scrapers/common/interfaces';
import { SessionStorageService } from '@src/services/session-manager';
import { PrismaService } from '@src/database/prisma.service';
import { IStorageState } from '@src/core/interfaces/browser-cookie.type';

/**
 * Step responsible for saving the current session state after successful authentication
 * Must be executed as a POST_SESSION step after successful login
 */
export class SaveSessionStep implements IAuthenticationStep {
  constructor(
    private readonly logger: Logger,
    private readonly sessionStorageService: SessionStorageService,
    private readonly prisma: PrismaService,
  ) {}

  getType(): AuthStepType {
    // This must be POST_SESSION to properly save the session after authentication
    return AuthStepType.POST_SESSION;
  }

  getName(): string {
    return 'Save Session';
  }

  /**
   * Execute session saving
   * @param context - Current authentication context
   * @param credentials - User credentials containing session path
   * @returns True if session was saved successfully, false otherwise
   */
  async execute(
    context: AuthenticatorContext,
    credentials?: AuthCredentials,
  ): Promise<boolean> {
    if (!context.state.page) {
      this.logger.error('No page found in context when trying to save session');
      return false;
    }

    if (!credentials) {
      this.logger.error('No credentials provided for session saving');
      return false;
    }

    try {
      // Создаем путь к файлу сессии (для совместимости со старым кодом)
      if (!credentials.sessionPath) {
        const sessionDir = './storage/sessions';
        await fs.ensureDir(sessionDir);
        credentials.sessionPath = path.join(
          sessionDir,
          `tiktok_${credentials.email.replace(/[@.]/g, '_')}.json`,
        );
      }

      // Получаем текущее состояние хранилища, включая cookies и localStorage
      const storageState: IStorageState = await context.state.page
        .context()
        .storageState();

      // Для совместимости со старым кодом, сохраняем также в файл
      await fs.ensureDir(path.dirname(credentials.sessionPath));
      await fs.writeJson(credentials.sessionPath, storageState, { spaces: 2 });

      // Находим или создаем запись сессии в базе данных
      let session = await this.prisma.session.findFirst({
        where: {
          email: credentials.email,
          storage_path: credentials.sessionPath,
          is_valid: true,
        },
      });

      if (!session) {
        // Если сессия не найдена, создаем новую
        this.logger.log(`Creating new session record for ${credentials.email}`);
        session = await this.prisma.session.create({
          data: {
            email: credentials.email,
            storage_path: credentials.sessionPath,
            status: 'active',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            last_activity_timestamp: new Date(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            session_data: JSON.parse(JSON.stringify(storageState)), // TODO: need to delete
          },
        });
      }

      // Save session data to database
      this.logger.log(
        `Saving session state to database for session ID: ${session.id}`,
      );

      // Log storageState structure for debugging
      this.logger.debug(
        `StorageState structure: cookies: ${storageState.cookies?.length ?? 0}, origins: ${storageState.origins?.length ?? 0}`,
      );

      if (!storageState.cookies || storageState.cookies.length === 0) {
        this.logger.warn('No cookies found in storage state');
      }

      if (!storageState.origins || storageState.origins.length === 0) {
        this.logger.warn('No localStorage origins found in storage state');
      }

      try {
        await this.sessionStorageService.saveSessionState(
          session.id,
          storageState,
        );
        this.logger.log('Session state saved successfully');
      } catch (error) {
        this.logger.error(
          `Error saving session state details: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue execution even if saving related models fails
      }
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error saving session state: ${errorMessage}`);
      return false;
    }
  }
}
