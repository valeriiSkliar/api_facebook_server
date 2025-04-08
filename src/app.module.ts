import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './services/auth/auth-module';
import { ApiModule } from './api/api.module';
import { CoreModule } from './core/core.module';
import { AppController } from './app.controller';
import { SchedulerModule } from './services/scheduler/scheduler.module';
import { ScraperModule } from './scrapers/scraper.module';

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
    SchedulerModule,
    ScraperModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
