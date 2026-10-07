import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesDataModule } from './files.data.module';
import { TasksAccessModule } from '../tasks/tasks-access.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';
import { MilestonesDataModule } from '../milestones/milestones.data.module';
import { ExpertApplicationsDataModule } from '../expert-applications/expert-applications.data.module';
@Module({
  imports: [
    FilesDataModule,
    TasksAccessModule,
    AuditRequestsDataModule,
    MilestonesDataModule,
    ExpertApplicationsDataModule,
  ],
  providers: [FilesService],
  exports: [FilesService, FilesDataModule],
})
export class FilesCoreModule {}
