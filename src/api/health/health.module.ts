import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller';
import { AppService } from '../../app.service';

@Module({
  controllers: [HealthController],
  providers: [AppService],
})
export class HealthModule {}
