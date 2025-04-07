import { Module, Logger } from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { PrismaModule } from '@src/database';
import { EmailAccountController } from '@src/api/accounts/email-account/email-account.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAccountController],
  providers: [EmailAccountService, Logger],
  exports: [EmailAccountService],
})
export class EmailAccountModule {}
