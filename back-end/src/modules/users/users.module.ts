import { UsersDataModule } from './users.data.module';
import { AccountDeletionGuard } from './account-deletion.guard';
import { TasksDataModule } from '../tasks/tasks.data.module';
import { TransactionsDataModule } from '../transactions/transactions.data.module';
import { ProposalsDataModule } from '../proposals/proposals.data.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { MessagesDataModule } from '../messages/messages.data.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { UsersCoreModule } from '../users/users.core.module';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { UsersController } from './users.controller';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { MoneyTrailMiddleware } from '../../common/middleware/money-trail.middleware';

@Module({
  imports: [
    UsersCoreModule,
    UsersDataModule,
    LedgerCoreModule,
    TasksDataModule,
    TransactionsDataModule,
    ProposalsDataModule,
    AuditRequestsDataModule,
    DisputesDataModule,
    MessagesDataModule,
  ],
  controllers: [UsersController],
  providers: [AccountDeletionGuard],
  exports: [UsersCoreModule],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, MoneyTrailMiddleware)
      .exclude(
        { path: 'users', method: RequestMethod.POST },
      )
      .forRoutes(UsersController);
  }
}
