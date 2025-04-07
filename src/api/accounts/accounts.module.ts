import { Module } from '@nestjs/common';
import { EmailAccountModule } from './email-account/email-account.module';
import { TiktokAccountModule } from './tiktok-account/tiktok-account.module';

@Module({
  imports: [EmailAccountModule, TiktokAccountModule],
  exports: [EmailAccountModule, TiktokAccountModule],
})
export class AccountsModule {}
