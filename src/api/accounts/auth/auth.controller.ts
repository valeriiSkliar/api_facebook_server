// src/api/accounts/auth/auth.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TikTokAuthService } from '@src/authenticators/tik-tok/tiktok-auth-service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: TikTokAuthService) {}

  @Get('sessions')
  async getSessions() {
    try {
      // Получаем все активные сессии из базы данных
      const sessions = await this.getActiveSessions();
      return {
        success: true,
        sessions,
      };
    } catch (error) {
      this.logger.error('Failed to get sessions', error);
      throw new HttpException(
        'Failed to get sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-session')
  async createSession() {
    try {
      const result = await this.authService.getOrCreateSession();
      if (!result.success) {
        throw new HttpException(
          'Failed to create session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return result;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw new HttpException(
        'Failed to create session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-all-sessions')
  async createAllSessions() {
    try {
      this.logger.log('Starting creation of sessions for all accounts');
      const result = await this.authService.createSessionsForAllAccounts();
      return result;
    } catch (error) {
      this.logger.error('Failed to create sessions for all accounts', error);
      throw new HttpException(
        'Failed to create sessions for all accounts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-tiktok-sessions')
  async createTikTokSessions() {
    try {
      this.logger.log('Starting creation of sessions for TikTok accounts');
      const result = await this.authService.createSessionsForTikTokAccounts();
      return result;
    } catch (error) {
      this.logger.error('Failed to create sessions for TikTok accounts', error);
      throw new HttpException(
        'Failed to create sessions for TikTok accounts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh/:id')
  async refreshSession(@Param('id') id: string) {
    try {
      const sessionId = parseInt(id, 10);
      if (isNaN(sessionId)) {
        throw new HttpException('Invalid session ID', HttpStatus.BAD_REQUEST);
      }

      const success = await this.authService.refreshSession(sessionId);
      if (!success) {
        throw new HttpException(
          'Failed to refresh session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: `Session ${sessionId} refreshed successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to refresh session ${id}`, error);
      throw new HttpException(
        'Failed to refresh session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh-all')
  async refreshAllSessions() {
    try {
      this.logger.log('Starting refresh of all expiring sessions');
      const result = await this.authService.refreshAllExpiringSessions();
      return result;
    } catch (error) {
      this.logger.error('Failed to refresh expiring sessions', error);
      throw new HttpException(
        'Failed to refresh expiring sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('invalidate/:id')
  async invalidateSession(@Param('id') id: string) {
    try {
      const sessionId = parseInt(id, 10);
      if (isNaN(sessionId)) {
        throw new HttpException('Invalid session ID', HttpStatus.BAD_REQUEST);
      }

      const success = await this.authService.invalidateSession(sessionId);
      if (!success) {
        throw new HttpException(
          'Failed to invalidate session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: `Session ${sessionId} invalidated successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to invalidate session ${id}`, error);
      throw new HttpException(
        'Failed to invalidate session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Вспомогательный метод для получения активных сессий из базы данных
   */
  private async getActiveSessions() {
    const sessions = await this.authService['prisma'].session.findMany({
      where: {
        status: 'ACTIVE',
        is_valid: true,
        expires_at: {
          gt: new Date(),
        },
      },
      orderBy: {
        last_activity_timestamp: 'desc',
      },
      include: {
        emailAccount: {
          include: {
            tiktok_account: true,
          },
        },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      email: session.email,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_timestamp,
      tiktokAccounts:
        session.emailAccount?.tiktok_account?.map((account) => ({
          id: account.id,
          username: account.username,
          status: account.status,
          lastLogin: account.last_login_timestamp,
        })) || [],
    }));
  }
}
