import { TerminationCoreModule } from '../termination/termination.core.module';
import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../notifications/notifications.core.module';
import { DisputesService } from './disputes.service';
import { DisputesDataModule } from './disputes.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { MilestonesCoreModule } from '../milestones/milestones.core.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';
import { UsersDataModule } from '../users/users.data.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    NotificationsCoreModule,
    DisputesDataModule,
    TasksAccessModule,
    MilestonesCoreModule,
    LedgerCoreModule,
    AuditRequestsCoreModule,
    UsersDataModule,
    TerminationCoreModule,
  ],
  providers: [DisputesService, UnitOfWork],
  exports: [DisputesService, DisputesDataModule],
})
export class DisputesCoreModule {}
