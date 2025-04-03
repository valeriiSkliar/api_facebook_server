import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TiktokAccountModule } from './routes/tiktok-account/tiktok-account.module';
import { EmailAccountModule } from './routes/email-account/email-account.module';
import { AuthModule } from './services/auth/auth-module';
import { ApiModule } from './api/api.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    CoreModule,
    AuthModule,
    TiktokAccountModule,
    EmailAccountModule,
    ApiModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
