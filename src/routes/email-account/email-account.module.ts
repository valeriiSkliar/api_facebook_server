import { Module, Logger } from '@nestjs/common';
import { EmailAccountService } from './email-account.service';
import { EmailAccountController } from './email-account.controller';
import { PrismaModule } from '@src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAccountController],
  providers: [EmailAccountService, Logger],
})
export class EmailAccountModule {}
