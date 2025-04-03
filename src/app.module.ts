import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TiktokAccountModule } from './routes/tiktok-account/tiktok-account.module';
import { EmailAccountModule } from './routes/email-account/email-account.module';
import { AuthModule } from './services/auth/auth-module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    ScheduleModule.forRoot(),
    AuthModule,
    TiktokAccountModule,
    EmailAccountModule,
    ApiModule,
  ],
  controllers: [],
  providers: [AppService, RedisService],
})
export class AppModule {}
