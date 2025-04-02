import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ScraperModule } from './modules/scraper.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RequestModule } from './modules/request-module';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionModule } from './modules/session.module';
import { TiktokAccountModule } from './routes/tiktok-account/tiktok-account.module';
import { EmailAccountModule } from './routes/email-account/email-account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    ScraperModule,
    RequestModule,
    ScheduleModule.forRoot(),
    SessionModule,
    TiktokAccountModule,
    EmailAccountModule,
  ],
  controllers: [],
  providers: [AppService, RedisService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
