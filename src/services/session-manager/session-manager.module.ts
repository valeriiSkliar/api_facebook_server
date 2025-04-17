import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/database/prisma.module';
import { SessionStorageService } from './session-storage.service';

@Module({
  imports: [PrismaModule],
  providers: [SessionStorageService],
  exports: [SessionStorageService],
})
export class SessionManagerModule {}
