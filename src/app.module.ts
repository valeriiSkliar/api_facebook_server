import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './services/session-manager/auth/auth-module';
import { ApiModule } from './api/api.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    AuthModule,
    ApiModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
