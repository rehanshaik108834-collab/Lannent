import { TerminationCoreModule } from '../termination/termination.core.module';
import { Module } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { MilestonesDataModule } from './milestones.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { UsersCoreModule } from '../users/users.core.module';
import { TransactionsCoreModule } from '../transactions/transactions.core.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';
import { NotificationsCoreModule } from '../notifications/notifications.core.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    MilestonesDataModule,
    TasksAccessModule,
    UsersCoreModule,
    TransactionsCoreModule,
    LedgerCoreModule,
    AuditRequestsCoreModule,
    NotificationsCoreModule,
    DisputesDataModule,
    TerminationCoreModule,
  ],
  providers: [MilestonesService, UnitOfWork],
  exports: [MilestonesService, MilestonesDataModule],
})
export class MilestonesCoreModule {}
