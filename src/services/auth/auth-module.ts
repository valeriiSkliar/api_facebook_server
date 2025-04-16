import { Module } from '@nestjs/common';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/database';
import {
  AuthService,
  SessionRefreshService,
  SessionScheduleService,
} from '@src/services';
import { TikTokAuthService } from '@src/authenticators/tik-tok/tiktok-auth-service';
import { TikTokAuthModule } from '@src/authenticators/tik-tok/tik-tok-auth.module';
import { TikTokAuthenticatorFactory } from '@src/authenticators/tik-tok/factories/tik-tok-authenticator-factory';
import { EmailModule } from '@src/services/common/email/email.module';
import { TabManagerModule } from '@src/core/browser/tab-manager/tab-manager.module';
import { CaptchaSolverModule } from '@src/services/common/captcha-solver/captcha-solver.module';
import { SessionManagerModule } from '@src/services/tik-tok/session-refresh/session-manager.module';
// import { SessionModule } from '@src/modules/session.module';

@Module({
  imports: [
    BrowserPoolModule,
    PrismaModule,
    TikTokAuthModule,
    EmailModule,
    TabManagerModule,
    CaptchaSolverModule,
    SessionManagerModule,
  ],
  providers: [
    SessionScheduleService,
    SessionRefreshService,
    AuthService,
    TikTokAuthService,
    {
      provide: 'IAuthenticatorFactory',
      useClass: TikTokAuthenticatorFactory,
    },
  ],
  exports: [
    SessionScheduleService,
    SessionRefreshService,
    AuthService,
    TikTokAuthService,
  ],
})
export class AuthModule {}
