import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { UsersDataModule } from '../users/users.data.module';
import { TasksDataModule } from '../tasks/tasks.data.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { ProposalsDataModule } from '../proposals/proposals.data.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';
import { AuditReportsDataModule } from '../audit-reports/audit-reports.data.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { TransactionsDataModule } from '../transactions/transactions.data.module';
import { ExpertApplicationsDataModule } from '../expert-applications/expert-applications.data.module';
import { NotificationsDataModule } from '../notifications/notifications.data.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { FilesCoreModule } from '../files/files.core.module';

import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { AdminAuditMiddleware } from '../../common/middleware/admin-audit.middleware';
import { SeedGuardMiddleware } from '../../common/middleware/seed-guard.middleware';

@Module({
  imports: [
    UsersDataModule,
    TasksDataModule,
    MilestonesDataModule,
    ProposalsDataModule,
    AuditRequestsDataModule,
    AuditReportsDataModule,
    DisputesDataModule,
    TransactionsDataModule,
    ExpertApplicationsDataModule,
    NotificationsDataModule,
    LedgerCoreModule,
    FilesCoreModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, AdminAuditMiddleware, SeedGuardMiddleware)
      .forRoutes(SeedController);
  }
}
