import { Module } from '@nestjs/common';
import { FileSystemSessionManager } from './file-system-session-manager';
import { SessionRestoreService } from './SessionRestoreService';
import { PrismaModule } from '@src/database';

@Module({
  imports: [PrismaModule],
  providers: [FileSystemSessionManager, SessionRestoreService],
  exports: [FileSystemSessionManager, SessionRestoreService],
})
export class SessionManagerModule {}
