import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../notifications/notifications.core.module';
import { AuditReportsService } from './audit-reports.service';
import { AuditReportsDataModule } from './audit-reports.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';
import { MilestonesCoreModule } from '../milestones/milestones.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    NotificationsCoreModule,
    AuditReportsDataModule,
    TasksAccessModule,
    AuditRequestsCoreModule,
    MilestonesCoreModule,
  ],
  providers: [AuditReportsService, UnitOfWork],
  exports: [AuditReportsService, AuditReportsDataModule],
})
export class AuditReportsCoreModule {}
