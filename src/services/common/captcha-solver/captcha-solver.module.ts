import { Module } from '@nestjs/common';
import { SadCaptchaSolverService } from './sad-captcha-solver-service';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from '@src/config';
import { Logger } from '@nestjs/common';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SadCaptchaSolverService,
      useFactory: () => {
        return new SadCaptchaSolverService(
          new Logger(SadCaptchaSolverService.name),
          AppConfig.SAD_CAPTCHA_API_KEY,
        );
      },
    },
  ],
  exports: [SadCaptchaSolverService],
})
export class CaptchaSolverModule {}
