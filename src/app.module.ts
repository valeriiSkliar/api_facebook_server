import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ScraperModule } from './modules/scraper.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
@Module({
  imports: [ScraperModule, RedisModule],
  controllers: [],
  providers: [AppService, RedisService],
})
export class AppModule {}
