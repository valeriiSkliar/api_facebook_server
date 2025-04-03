import { Module, forwardRef } from '@nestjs/common';
import { BrowserPoolModule } from '@src/services/browser-pool/browser-pool.module';
import { PrismaModule } from '@src/prisma/prisma.module';
import { AuthService, TikTokAuthenticatorFactory } from '@src/services';
import { SessionModule } from '@src/modules/session.module';

/**
 * Module for authentication services
 * Provides dependencies and exports services for application use
 */
@Module({
  imports: [BrowserPoolModule, PrismaModule, forwardRef(() => SessionModule)],
  providers: [
    AuthService,
    {
      provide: 'IAuthenticatorFactory',
      useClass: TikTokAuthenticatorFactory,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
