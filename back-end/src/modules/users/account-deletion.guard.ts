import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { DisputesRepository } from '../disputes/disputes.repository';
import { MessagesRepository } from '../messages/messages.repository';

type AccountRemovalRequest = {
  params: { id: string };
  user?: { id: string; role: string };
};

/** Preserve money and workflow participants. Used accounts are suspended, never erased. */
@Injectable()
export class AccountDeletionGuard implements CanActivate {
  constructor(
    private readonly users: UsersRepository,
    private readonly tasks: TasksRepository,
    private readonly transactions: TransactionsRepository,
    private readonly proposals: ProposalsRepository,
    private readonly audits: AuditRequestsRepository,
    private readonly disputes: DisputesRepository,
    private readonly messages: MessagesRepository,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AccountRemovalRequest>();
    if (request.user?.role !== 'superuser')
      throw new ForbiddenException(
        'Only operations can remove unused accounts.',
      );
    const id = request.params.id;
    const user = this.users.findById(id);
    if (!user) throw new NotFoundException('Account not found.');
    const referenced =
      this.tasks
        .findAll()
        .some((row) => row.clientId === id || row.workerId === id) ||
      this.transactions.findAll({ userId: id }).length > 0 ||
      this.proposals.findAll().some((row) => row.workerId === id) ||
      this.audits
        .findAll()
        .some(
          (row) =>
            row.clientId === id || row.workerId === id || row.expertId === id,
        ) ||
      this.disputes
        .findAll()
        .some(
          (row) =>
            row.raisedBy === id || row.againstId === id || row.expertId === id,
        ) ||
      this.messages.findAll({ userId: id }).length > 0;
    if (user.walletBalance !== 0 || referenced)
      throw new ConflictException(
        'This account has funds or workflow history. Suspend it instead of deleting it.',
      );
    return true;
  }
}
