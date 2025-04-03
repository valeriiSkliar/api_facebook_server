import { Module } from '@nestjs/common';
import { BrowserPoolModule } from '@core/browser/browser-pool/browser-pool.module';
import { PrismaModule } from '@core/storage/prisma';
import {
  AuthService,
  SessionRefreshService,
  SessionScheduleService,
  TikTokAuthenticatorFactory,
} from '@src/services';
// import { SessionModule } from '@src/modules/session.module';

@Module({
  imports: [BrowserPoolModule, PrismaModule, PrismaModule],
  providers: [
    SessionScheduleService,
    SessionRefreshService,
    AuthService,
    {
      provide: 'IAuthenticatorFactory',
      useClass: TikTokAuthenticatorFactory,
    },
  ],
  exports: [SessionScheduleService, SessionRefreshService],
})
export class AuthModule {}
