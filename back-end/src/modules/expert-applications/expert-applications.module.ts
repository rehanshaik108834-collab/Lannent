import { ExpertApplicationsCoreModule } from './expert-applications.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ExpertApplicationsController } from './expert-applications.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { AdminAuditMiddleware } from '../../common/middleware/admin-audit.middleware';

import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
@Module({
  imports: [ExpertApplicationsCoreModule],
  controllers: [ExpertApplicationsController],
  exports: [ExpertApplicationsCoreModule],
})
export class ExpertApplicationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, AdminAuditMiddleware)
      .exclude(
        { path: 'expert-applications', method: RequestMethod.POST },
        { path: 'expert-applications/status', method: RequestMethod.GET },
      )
      .forRoutes(ExpertApplicationsController);
  }
}
