import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesDataModule } from './messages.data.module';
import { TasksDataModule } from '../tasks/tasks.data.module';
import { UsersDataModule } from '../users/users.data.module';
import { ProposalsDataModule } from '../proposals/proposals.data.module';
import { AuditRequestsDataModule } from '../audit-requests/audit-requests.data.module';

/** Workflow composition. Imports leaf data and lower-level services only. */
@Module({
  imports: [
    MessagesDataModule,
    TasksDataModule,
    UsersDataModule,
    ProposalsDataModule,
    AuditRequestsDataModule,
  ],
  providers: [MessagesService],
  exports: [MessagesService, MessagesDataModule],
})
export class MessagesCoreModule {}
