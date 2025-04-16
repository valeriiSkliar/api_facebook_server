import { Module } from '@nestjs/common';
import { TikTokAuthenticator } from './tik-tok-authenticator';
import { TikTokAuthService } from './tiktok-auth-service';
import { PrismaModule } from '@src/database';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { TabManagerModule } from '@src/core/browser/tab-manager/tab-manager.module';
import { EmailModule } from '@src/services/common/email/email.module';
import { CaptchaSolverModule } from '@src/services/common/captcha-solver/captcha-solver.module';
import { SessionManagerModule } from '@src/services/tik-tok/session-refresh/session-manager.module';
import { TikTokAuthenticatorFactory } from './factories/tik-tok-authenticator-factory';

@Module({
  imports: [
    PrismaModule,
    BrowserPoolModule,
    TabManagerModule,
    EmailModule,
    CaptchaSolverModule,
    SessionManagerModule,
  ],
  providers: [
    TikTokAuthenticator,
    TikTokAuthService,
    TikTokAuthenticatorFactory,
  ],
  exports: [TikTokAuthenticator, TikTokAuthService, TikTokAuthenticatorFactory],
})
export class TikTokAuthModule {}
