import { Module } from '@nestjs/common';
import { AuditRequestsService } from './audit-requests.service';
import { AuditRequestsDataModule } from './audit-requests.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { UsersCoreModule } from '../users/users.core.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    AuditRequestsDataModule,
    TasksAccessModule,
    MilestonesDataModule,
    DisputesDataModule,
    UsersCoreModule,
    LedgerCoreModule,
  ],
  providers: [AuditRequestsService, UnitOfWork],
  exports: [AuditRequestsService, AuditRequestsDataModule],
})
export class AuditRequestsCoreModule {}
