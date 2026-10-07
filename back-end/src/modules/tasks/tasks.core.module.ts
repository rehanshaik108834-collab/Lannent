import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksDataModule } from './tasks.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { ProposalsDataModule } from '../proposals/proposals.data.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    TasksDataModule,
    TasksAccessModule,
    LedgerCoreModule,
    AuditRequestsCoreModule,
    MilestonesDataModule,
    ProposalsDataModule,
  ],
  providers: [TasksService, UnitOfWork],
  exports: [TasksService, TasksDataModule],
})
export class TasksCoreModule {}
