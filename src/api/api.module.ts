import {
  Module,
  MiddlewareConsumer,
  RequestMethod,
  NestModule,
} from '@nestjs/common';
import { FacebookApiModule } from './facebook/facebook.module';
import { HealthModule } from './health/health.module';
import { EmailAccountModule } from './accounts/email-account/email-account.module';
import { TiktokAccountModule } from './accounts/tiktok-account/tiktok-account.module';
import { RequestManagerModule } from '@src/api/requests/requests.module';
import { RequestController } from './requests/request-controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ScraperRecoveryModule } from '@src/scrapers/common/services/scraper-recovery.module';
// import { AuthModule } from './accounts/auth/auth.module';
@Module({
  imports: [
    FacebookApiModule,
    HealthModule,
    TiktokAccountModule,
    EmailAccountModule,
    RequestManagerModule,
    ScraperRecoveryModule,
    // AuthModule,
  ],
  controllers: [RequestController],
  exports: [FacebookApiModule],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'requests', method: RequestMethod.ALL },
        { path: 'requests/*', method: RequestMethod.ALL },
        { path: 'api/scraper-recovery', method: RequestMethod.ALL },
      );
  }
}
