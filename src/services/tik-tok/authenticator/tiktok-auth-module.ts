import { Module, Logger } from '@nestjs/common';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import { BrowserPoolModule } from '@src/services/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/prisma/prisma.module';
import { TikTokAuthService } from './tiktok-auth-service';
import { AuthenticatorFactory, AuthPlatform } from './authenticator-factory';

/**
 * Микро-версия модуля аутентификации TikTok с минимальным количеством кода
 */
@Module({
  imports: [BrowserPoolModule, PrismaModule],
  providers: [
    Logger,
    {
      provide: TikTokAuthenticator,
      useFactory: (logger: Logger, browserPoolService, tabManager) => {
        // Используем самый простой способ создания аутентификатора через фабрику
        return AuthenticatorFactory.createForPlatform(
          AuthPlatform.TIKTOK,
          logger,
          browserPoolService,
          tabManager,
        );
      },
      inject: [Logger, 'BrowserPoolService', 'TabManager'],
    },
    TikTokAuthService,
  ],
  exports: [TikTokAuthenticator, TikTokAuthService],
})
export class TikTokAuthModuleMicro {}
