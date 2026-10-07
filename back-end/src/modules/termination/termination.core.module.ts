import { Module } from '@nestjs/common';
import { TasksDataModule } from '../tasks/tasks.data.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';
import { LedgerCoreModule } from '../ledger/ledger.core.module';
import { NotificationsCoreModule } from '../notifications/notifications.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { ProjectTerminationService } from './project-termination.service';

/**
 * Contract termination. Depends only on leaf data, the ledger and
 * notifications, so milestone and dispute workflows can call it after they
 * settle without creating a module cycle.
 */
@Module({
  imports: [
    TasksDataModule,
    MilestonesDataModule,
    DisputesDataModule,
    AuditRequestsDataModule,
    LedgerCoreModule,
    NotificationsCoreModule,
  ],
  providers: [ProjectTerminationService, UnitOfWork],
  exports: [ProjectTerminationService],
})
export class TerminationCoreModule {}
