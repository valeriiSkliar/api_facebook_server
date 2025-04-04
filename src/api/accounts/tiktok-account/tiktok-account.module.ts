import { Module } from '@nestjs/common';
import { TiktokAccountService } from './tiktok-account.service';
import { TiktokAccountController } from '../../controllers/tiktok-account.controller';
import { PrismaModule } from '@src/database';

@Module({
  imports: [PrismaModule],
  controllers: [TiktokAccountController],
  providers: [TiktokAccountService],
})
export class TiktokAccountModule {}
