import { TerminationCoreModule } from '../termination/termination.core.module';
import { TasksCoreModule } from './tasks.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { TasksController } from './tasks.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { MoneyTrailMiddleware } from '../../common/middleware/money-trail.middleware';

@Module({
  imports: [TasksCoreModule, TerminationCoreModule],
  controllers: [TasksController],
  exports: [TasksCoreModule],
})
export class TasksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, MoneyTrailMiddleware)
      .forRoutes(TasksController);
  }
}
