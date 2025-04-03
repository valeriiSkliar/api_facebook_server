import { Module } from '@nestjs/common';
import { SessionScheduleService, SessionRefreshService } from '@src/services';
import { PrismaModule } from '@src/prisma/prisma.module';
import { BrowserPoolModule } from '@src/services/browser-pool/browser-pool.module';

@Module({
  imports: [PrismaModule, BrowserPoolModule],
  providers: [SessionScheduleService, SessionRefreshService],
  exports: [SessionScheduleService, SessionRefreshService],
})
export class SessionModule {}
