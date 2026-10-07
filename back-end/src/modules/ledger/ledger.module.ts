import { LedgerCoreModule } from './ledger.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { TasksAccessModule } from '../tasks/tasks-access.module';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { AdminAuditMiddleware } from '../../common/middleware/admin-audit.middleware';

@Module({
  imports: [LedgerCoreModule, TasksAccessModule],
  controllers: [LedgerController],
  exports: [LedgerCoreModule],
})
export class LedgerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, AdminAuditMiddleware)
      .forRoutes(LedgerController);
  }
}
