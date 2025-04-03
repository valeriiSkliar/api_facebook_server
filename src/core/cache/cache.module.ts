import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisModule } from '@core/storage/redis/redis.module';
import { PrismaModule } from '@src/prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
