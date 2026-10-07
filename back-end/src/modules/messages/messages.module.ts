import { MessagesCoreModule } from './messages.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { MessagesController } from './messages.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';

@Module({
  imports: [MessagesCoreModule],
  controllers: [MessagesController],
  exports: [MessagesCoreModule],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequireAuthMiddleware).forRoutes(MessagesController);
  }
}
