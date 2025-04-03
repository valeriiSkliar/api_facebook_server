import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisModule } from '@core/storage/redis/redis.module';
import { PrismaModule } from '@core/storage/prisma';

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
