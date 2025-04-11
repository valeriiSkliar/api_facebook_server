import { Module } from '@nestjs/common';
import { ErrorReportingService } from './services/error-reporting-service';
import { PrismaModule } from '@src/database';

@Module({
  imports: [PrismaModule],
  providers: [ErrorReportingService],
  exports: [ErrorReportingService],
})
export class ReportingModule {}
