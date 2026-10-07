import { AuditReportsCoreModule } from './audit-reports.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { AuditReportsController } from './audit-reports.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { MoneyTrailMiddleware } from '../../common/middleware/money-trail.middleware';

@Module({
  imports: [AuditReportsCoreModule],
  controllers: [AuditReportsController],
  exports: [AuditReportsCoreModule],
})
export class AuditReportsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, MoneyTrailMiddleware)
      .forRoutes(AuditReportsController);
  }
}
