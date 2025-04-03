import { Logger } from '@nestjs/common';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import { SadCaptchaSolverService } from '@src/services/tik-tok/captcha-solver/SadCaptchaSolverService';
import { FileSystemSessionManager } from '@src/services/tik-tok/session-refresh/FileSystemSessionManager';
import { BrowserPoolService } from '@src/services/browser-pool/browser-pool-service';
import { TabManager } from '@src/services/browser-pool/tab-manager';
import { EmailService } from '@src/services/tik-tok/email/EmailService';
import {
  IAuthenticator,
  ICaptchaSolver,
  ISessionManager,
} from '@src/interfaces';
import { PrismaClient } from '@prisma/client';
import { Env } from '@lib/Env';
import { AuthenticatorOptions, AuthenticatorContext } from '@src/models';

/**
 * Тип платформы для аутентификации
 */
export enum AuthPlatform {
  TIKTOK = 'tiktok',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  // Другие платформы можно добавить здесь
}

/**
 * Фабрика для создания аутентификаторов различных платформ
 */
export class AuthenticatorFactory {
  /**
   * Создает аутентификатор для указанной платформы
   *
   * @param platform Платформа, для которой создается аутентификатор
   * @param logger Логгер
   * @param browserPoolService Сервис пула браузеров
   * @param tabManager Менеджер вкладок
   * @returns Экземпляр аутентификатора
   */
  static createForPlatform(
    platform: AuthPlatform,
    logger: Logger,
    browserPoolService: BrowserPoolService,
    tabManager: TabManager,
  ): IAuthenticator {
    // Базовые настройки для всех платформ
    const captchaSolverApiKey = Env.SAD_CAPTCHA_API_KEY || '';
    const sessionStoragePath =
      process.env.SESSION_STORAGE_PATH || './storage/sessions';

    switch (platform) {
      case AuthPlatform.TIKTOK:
        return this.createStandardAuthenticator(
          logger,
          browserPoolService,
          tabManager,
          captchaSolverApiKey,
          sessionStoragePath,
        );

      case AuthPlatform.FACEBOOK:
      case AuthPlatform.INSTAGRAM:
        // В будущем здесь будет реализация для других платформ
        logger.warn(
          `Authenticator for platform ${String(platform)} is not yet implemented, using TikTok as fallback`,
        );
        return this.createStandardAuthenticator(
          logger,
          browserPoolService,
          tabManager,
          captchaSolverApiKey,
          sessionStoragePath,
        );

      default:
        logger.warn(
          `Unknown platform: ${String(platform)}, using TikTok as fallback`,
        );
        return this.createStandardAuthenticator(
          logger,
          browserPoolService,
          tabManager,
          captchaSolverApiKey,
          sessionStoragePath,
        );
    }
  }

  /**
   * Создает экземпляр TikTokAuthenticator
   *
   * @param logger Логгер
   * @param captchaSolver Сервис для решения капчи
   * @param sessionManager Менеджер сессий
   * @param browserPoolService Сервис пула браузеров
   * @param tabManager Менеджер вкладок
   * @param emailService Сервис для работы с почтой
   * @returns Экземпляр TikTokAuthenticator
   */
  static createTikTokAuthenticator(
    logger: Logger,
    captchaSolver: SadCaptchaSolverService,
    sessionManager: FileSystemSessionManager,
    browserPoolService: BrowserPoolService,
    tabManager: TabManager,
    emailService: EmailService,
  ): IAuthenticator {
    return new TikTokAuthenticator(
      logger,
      captchaSolver,
      sessionManager,
      browserPoolService,
      tabManager,
      emailService,
    );
  }

  /**
   * Создает экземпляр TikTokAuthenticator с настраиваемыми параметрами
   *
   * @param params Параметры для создания аутентификатора
   * @returns Экземпляр TikTokAuthenticator
   */
  static createCustomAuthenticator(params: {
    logger: Logger;
    captchaSolver: ICaptchaSolver;
    sessionManager: ISessionManager;
    browserPoolService: BrowserPoolService;
    tabManager: TabManager;
    emailService: EmailService;
    prismaClient?: PrismaClient;
    loginUrl?: string;
    sessionStoragePath?: string;
  }): IAuthenticator {
    const authenticator = new TikTokAuthenticator(
      params.logger,
      params.captchaSolver,
      params.sessionManager,
      params.browserPoolService,
      params.tabManager,
      params.emailService,
    );

    // Установка опциональных параметров
    if (params.sessionStoragePath) {
      authenticator.setSessionStoragePath(params.sessionStoragePath);
    }

    return authenticator;
  }

  /**
   * Создает стандартный экземпляр TikTokAuthenticator с минимальным количеством параметров
   *
   * @param logger Логгер
   * @param browserPoolService Сервис пула браузеров
   * @param tabManager Менеджер вкладок
   * @param captchaSolverApiKey Ключ API для решения капчи
   * @param sessionStoragePath Путь для хранения сессий
   * @returns Экземпляр TikTokAuthenticator
   */
  static createStandardAuthenticator(
    logger: Logger,
    browserPoolService: BrowserPoolService,
    tabManager: TabManager,
    captchaSolverApiKey: string,
    sessionStoragePath: string = './storage/sessions',
  ): IAuthenticator {
    const captchaSolver = new SadCaptchaSolverService(
      logger,
      captchaSolverApiKey,
      'storage/captcha-screenshots',
    );

    const sessionManager = new FileSystemSessionManager(
      sessionStoragePath,
      logger,
    );

    // Создаем EmailService из переменных окружения
    const prismaClient = new PrismaClient();
    const emailAccount = {
      id: 1,
      email_address: Env.UKR_NET_EMAIL || '',
      password: Env.UKR_NET_APP_PASSWORD || '',
      connection_details: {
        imap_host: Env.UKR_NET_IMAP_HOST || '',
        imap_port: 993,
        imap_secure: true,
      },
    };

    const emailService = new EmailService(prismaClient, logger, emailAccount);

    return this.createTikTokAuthenticator(
      logger,
      captchaSolver,
      sessionManager,
      browserPoolService,
      tabManager,
      emailService,
    );
  }

  createContext(options?: Partial<AuthenticatorOptions>): AuthenticatorContext {
    return {
      options: this.mergeWithDefaultOptions(options),
      state: {
        errors: [],
        forceStop: false,
        externalBrowser: false,
      },
    };
  }
  private mergeWithDefaultOptions(
    options?: Partial<AuthenticatorOptions>,
  ): AuthenticatorOptions {
    const defaultOptions: AuthenticatorOptions = {
      browser: {
        headless: true,
      },
      network: {
        timeout: 30000,
        retries: 3,
      },
      behavior: {
        applyFilters: false,
        maxRetries: 3,
        waitForResults: true,
        maxWaitTimeoutForStep: 30000,
        cleanUpTimeout: 300000,
      },
      storage: {
        enabled: true,
        format: 'json',
        outputPath: './storage/sessions',
      },
    };

    return {
      ...defaultOptions,
      ...options,
    };
  }
}
