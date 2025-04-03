import { Module, Logger } from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { EmailAccountController } from './email-account.controller';
import { PrismaModule } from '@core/storage/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAccountController],
  providers: [EmailAccountService, Logger],
})
export class EmailAccountModule {}
