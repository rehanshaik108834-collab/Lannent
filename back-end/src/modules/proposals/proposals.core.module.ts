import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsDataModule } from './proposals.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { TransactionsCoreModule } from '../transactions/transactions.core.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { UsersCoreModule } from '../users/users.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    ProposalsDataModule,
    TasksAccessModule,
    TransactionsCoreModule,
    LedgerCoreModule,
    MilestonesDataModule,
    UsersCoreModule,
  ],
  providers: [ProposalsService, UnitOfWork],
  exports: [ProposalsService, ProposalsDataModule],
})
export class ProposalsCoreModule {}
