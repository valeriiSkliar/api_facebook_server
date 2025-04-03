import { Module, MiddlewareConsumer, forwardRef } from '@nestjs/common';
import { RequestController } from './controllers/request-controller';
import { RequestManagerService } from '../../services/request-manager-service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { CoreModule } from '../../core/core.module';
import { QueueModule } from '@core/queue/queue.module';

@Module({
  imports: [forwardRef(() => CoreModule), QueueModule],
  controllers: [RequestController],
  providers: [RequestManagerService],
  exports: [RequestManagerService],
})
export class CommonApiModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('requests');
  }
}
