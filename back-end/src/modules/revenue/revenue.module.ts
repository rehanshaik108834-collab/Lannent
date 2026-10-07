import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { TransactionsCoreModule } from '../transactions/transactions.core.module';
import { UsersCoreModule } from '../users/users.core.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { AdminAuditMiddleware } from '../../common/middleware/admin-audit.middleware';

@Module({
  imports: [
    LedgerCoreModule,
    TransactionsCoreModule,
    UsersCoreModule,
    TasksAccessModule,
    AuditRequestsCoreModule,
  ],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, AdminAuditMiddleware)
      .forRoutes(RevenueController);
  }
}
