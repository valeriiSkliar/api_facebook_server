import { Module } from '@nestjs/common';
import { SessionScheduleService, SessionRefreshService } from '@src/services';
import { PrismaModule } from '@src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SessionScheduleService, SessionRefreshService],
  exports: [SessionScheduleService, SessionRefreshService],
})
export class SessionModule {}
