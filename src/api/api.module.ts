import { Module } from '@nestjs/common';
import { FacebookApiModule } from './facebook/facebook.module';
import { CommonApiModule } from './common/common-api.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [FacebookApiModule, CommonApiModule, HealthModule],
  exports: [FacebookApiModule, CommonApiModule],
})
export class ApiModule {}
