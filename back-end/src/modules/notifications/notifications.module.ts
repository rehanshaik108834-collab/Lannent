import { NotificationsCoreModule } from './notifications.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';

@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
  exports: [NotificationsCoreModule],
})
export class NotificationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequireAuthMiddleware).forRoutes(NotificationsController);
  }
}
