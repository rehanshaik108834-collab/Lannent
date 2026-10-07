import { AuditRequestsCoreModule } from './audit-requests.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { AuditRequestsController } from './audit-requests.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { MoneyTrailMiddleware } from '../../common/middleware/money-trail.middleware';

@Module({
  imports: [AuditRequestsCoreModule],
  controllers: [AuditRequestsController],
  exports: [AuditRequestsCoreModule],
})
export class AuditRequestsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, MoneyTrailMiddleware)
      .forRoutes(AuditRequestsController);
  }
}
