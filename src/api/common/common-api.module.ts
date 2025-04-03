import { Module, MiddlewareConsumer } from '@nestjs/common';
import { RequestController } from './controllers/request-controller';
import { RequestManagerService } from '../../services/request-manager-service';
import { AuthMiddleware } from './middleware/auth.middleware';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { BrowserPoolModule } from '../../services/browser-pool/browser-pool.module';
import { QueueService } from '../../services/queue-service';

@Module({
  imports: [PrismaModule, RedisModule, BrowserPoolModule],
  controllers: [RequestController],
  providers: [RequestManagerService, QueueService],
  exports: [RequestManagerService],
})
export class CommonApiModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('requests');
  }
}
