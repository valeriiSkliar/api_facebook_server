import { Module, forwardRef } from '@nestjs/common';
import {
  SessionScheduleService,
  SessionRefreshService,
  AuthModule,
} from '@src/services';
import { PrismaModule } from '@src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  providers: [SessionScheduleService, SessionRefreshService],
  exports: [SessionScheduleService, SessionRefreshService],
})
export class SessionModule {}
