import { Module } from '@nestjs/common';
import { TasksDataModule } from './tasks.data.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';
import { TasksAccessService } from './tasks-access.service';
@Module({
  imports: [TasksDataModule, AuditRequestsDataModule],
  providers: [TasksAccessService],
  exports: [TasksAccessService],
})
export class TasksAccessModule {}
