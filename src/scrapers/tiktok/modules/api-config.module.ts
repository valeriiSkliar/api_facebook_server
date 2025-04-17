import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiConfigurationSchedulerService } from '../services/api-config.scraper/api-configuration-scheduler.service';
import { PrismaModule } from '@src/database/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [ApiConfigurationSchedulerService],
  exports: [ApiConfigurationSchedulerService],
})
export class ApiConfigModule {}
