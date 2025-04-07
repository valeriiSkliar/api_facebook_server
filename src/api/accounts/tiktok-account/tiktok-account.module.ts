import { Module } from '@nestjs/common';
import { TiktokAccountService } from './tiktok-account.service';
import { TiktokAccountController } from './tiktok-account.controller';
import { PrismaModule } from '@src/database';

@Module({
  imports: [PrismaModule],
  controllers: [TiktokAccountController],
  providers: [TiktokAccountService],
  exports: [TiktokAccountService],
})
export class TiktokAccountModule {}
