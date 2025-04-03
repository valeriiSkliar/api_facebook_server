import { Module, Logger } from '@nestjs/common';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import { BrowserPoolModule } from '@src/services/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/prisma/prisma.module';
import { EmailService } from '@src/services/tik-tok/email/EmailService';
import { SadCaptchaSolverService } from '@src/services/tik-tok/captcha-solver/SadCaptchaSolverService';
import { FileSystemSessionManager } from '@src/services/tik-tok/session-refresh/FileSystemSessionManager';
import { Env } from '@lib/Env';
import { PrismaClient } from '@prisma/client';
import { TikTokAuthService } from './tiktok-auth-service';

@Module({
  imports: [BrowserPoolModule, PrismaModule],
  providers: [
    Logger,
    {
      provide: 'ICaptchaSolver',
      useFactory: (logger: Logger) => {
        return new SadCaptchaSolverService(
          logger,
          Env.SAD_CAPTCHA_API_KEY || '',
          'storage/captcha-screenshots',
        );
      },
      inject: [Logger],
    },
    {
      provide: 'ISessionManager',
      useFactory: (logger: Logger) => {
        const sessionStoragePath =
          process.env.SESSION_STORAGE_PATH || './storage/sessions';
        return new FileSystemSessionManager(sessionStoragePath, logger);
      },
      inject: [Logger],
    },
    {
      provide: EmailService,
      useFactory: async (logger: Logger) => {
        // Note: This is a placeholder - in practice, you'd need to get the email account
        // from a database or configuration. This would need to be properly implemented
        // based on your application's needs.
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
        return await new Promise((resolve) => {
          resolve(new EmailService(new PrismaClient(), logger, emailAccount));
        });
      },
      inject: [Logger],
    },
    {
      provide: TikTokAuthenticator,
      useFactory: (
        logger: Logger,
        captchaSolver: SadCaptchaSolverService,
        sessionManager: FileSystemSessionManager,
        browserPoolService,
        tabManager,
        emailService: EmailService,
      ) => {
        return new TikTokAuthenticator(
          logger,
          captchaSolver,
          sessionManager,
          browserPoolService,
          tabManager,
          emailService,
        );
      },
      inject: [
        Logger,
        'ICaptchaSolver',
        'ISessionManager',
        'BrowserPoolService',
        'TabManager',
        EmailService,
      ],
    },
    TikTokAuthService,
  ],
  exports: [TikTokAuthenticator, TikTokAuthService],
})
export class TikTokAuthModule {}
