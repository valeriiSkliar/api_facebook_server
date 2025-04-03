import { Module } from '@nestjs/common';
import { FacebookApiModule } from './facebook/facebook.module';
import { CommonApiModule } from './common/common-api.module';
import { HealthModule } from './health/health.module';
import { EmailAccountModule } from './common/email-account/email-account.module';
import { TiktokAccountModule } from './common/tiktok-account/tiktok-account.module';

@Module({
  imports: [
    FacebookApiModule,
    CommonApiModule,
    HealthModule,
    TiktokAccountModule,
    EmailAccountModule,
  ],
  exports: [FacebookApiModule, CommonApiModule],
})
export class ApiModule {}
