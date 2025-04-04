import { Module } from '@nestjs/common';
import { FacebookApiModule } from './facebook/facebook.module';
import { HealthModule } from './health/health.module';
import { EmailAccountModule } from './accounts/email-account/email-account.module';
import { TiktokAccountModule } from './accounts/tiktok-account/tiktok-account.module';

@Module({
  imports: [
    FacebookApiModule,
    HealthModule,
    TiktokAccountModule,
    EmailAccountModule,
  ],
  exports: [FacebookApiModule],
})
export class ApiModule {}
