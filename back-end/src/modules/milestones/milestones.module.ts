import { MilestonesCoreModule } from './milestones.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { MilestonesController } from './milestones.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { MoneyTrailMiddleware } from '../../common/middleware/money-trail.middleware';

@Module({
  imports: [MilestonesCoreModule],
  controllers: [MilestonesController],
  exports: [MilestonesCoreModule],
})
export class MilestonesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, MoneyTrailMiddleware)
      .forRoutes(MilestonesController);
  }
}
