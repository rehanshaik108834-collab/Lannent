import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { AuditReportsRepository } from '../audit-reports/audit-reports.repository';
import { DisputesRepository } from '../disputes/disputes.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { ExpertApplicationsRepository } from '../expert-applications/expert-applications.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { LedgerService } from '../ledger/ledger.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class SeedService {
  constructor(
    private usersService: UsersRepository,
    private tasksService: TasksRepository,
    private milestonesService: MilestonesRepository,
    private proposalsService: ProposalsRepository,
    private auditRequestsService: AuditRequestsRepository,
    private auditReportsService: AuditReportsRepository,
    private disputesService: DisputesRepository,
    private transactionsService: TransactionsRepository,
    private expertApplicationsService: ExpertApplicationsRepository,
    private notificationsService: NotificationsRepository,
    private ledgerService: LedgerService,
    private filesService: FilesService,
  ) {}

  resetAll() {
    this.usersService.resetToSeed();
    this.tasksService.resetToSeed();
    this.milestonesService.resetToSeed();
    this.proposalsService.resetToSeed();
    this.auditRequestsService.resetToSeed();
    this.auditReportsService.resetToSeed();
    this.disputesService.resetToSeed();
    this.transactionsService.resetToSeed();
    this.expertApplicationsService.resetToSeed();
    this.notificationsService.resetToSeed();
    // Last: rebuilds escrow and billings from the freshly reset transaction ledger.
    this.ledgerService.resetToSeed();
    // Clears the metadata and deletes the bytes those records pointed at.
    this.filesService.resetToSeed();
  }
}
