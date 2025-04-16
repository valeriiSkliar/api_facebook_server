import { Module } from '@nestjs/common';
import { EmailService } from './email-service';
import { PrismaModule } from '@src/database';

@Module({
  imports: [PrismaModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
