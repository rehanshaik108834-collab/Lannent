import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { canViewAnyRecord } from '../../common/guards/viewer.util';
import { ROLES } from '../../common/constants/roles';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ProposalsRepository } from './proposals.repository';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgerService } from '../ledger/ledger.service';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * ProposalsService — Business Logic Layer
 *
 * Handles hiring, invitation acceptance/decline, and escrow creation.
 * Delegates all data-access operations to ProposalsRepository.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly notifier: NotificationsService,
    private readonly proposalsRepository: ProposalsRepository,
    private tasksService: TasksAccessService,
    private transactionsService: TransactionsService,
    private ledger: LedgerService,
    private milestonesService: MilestonesRepository,
    private readonly uow: UnitOfWork,
    private readonly accounts: UsersService,
  ) {}

  findAll(query?: { taskId?: string; workerId?: string; type?: string }) {
    return this.proposalsRepository.findAll(query);
  }

  findById(id: string) {
    const prop = this.proposalsRepository.findById(id);
    if (!prop)
      throw new NotFoundException(`Proposal with id "${id}" not found`);
    return prop;
  }

  // ── Viewer-scoped reads ────────────────────────────────────────────────────

  /** A proposal or invitation concerns its worker and the project's client. */
  private canView(prop: any, actor: Actor): boolean {
    if (canViewAnyRecord(actor.role) || prop.workerId === actor.id) return true;
    const task = this.safeTask(prop.taskId);
    return !!task && task.clientId === actor.id;
  }

  findAllFor(
    actor: Actor,
    query: { taskId?: string; workerId?: string; type?: string },
  ) {
    return this.findAll(query).filter((p: any) => this.canView(p, actor));
  }

  findByIdFor(id: string, actor: Actor) {
    const prop = this.findById(id);
    if (!this.canView(prop, actor)) {
      throw new ForbiddenException('You do not have access to this proposal.');
    }
    return prop;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * A worker proposes on an open project, or the project's client invites a
   * worker. The author is always the actor. The worker's displayed profile
   * (name, avatar, rating, completed projects, location) comes from their
   * account, not from the request body.
   */
  create(dto: CreateProposalDto, actor: Actor) {
    const type = dto.type || 'proposal';
    const task = this.tasksService.findById(dto.taskId);
    if (task.status !== 'open') {
      throw new BadRequestException(
        'This project is not open — cannot submit proposals or invitations.',
      );
    }

    let workerId: string;
    if (type === 'proposal') {
      if (actor.role !== ROLES.WORKER)
        throw new ForbiddenException('Only workers can submit proposals.');
      if (dto.workerId && dto.workerId !== actor.id) {
        throw new BadRequestException(
          'workerId must be your own account when you submit a proposal.',
        );
      }
      workerId = actor.id;
    } else {
      if (task.clientId !== actor.id) {
        throw new ForbiddenException(
          'Only the client who owns this project can invite workers to it.',
        );
      }
      if (!dto.workerId)
        throw new BadRequestException(
          'Name the worker you are inviting (workerId).',
        );
      workerId = dto.workerId;
    }

    const worker = this.users().findById(workerId);
    if (worker.role !== ROLES.WORKER || worker.status !== 'active') {
      throw new BadRequestException(`${worker.name} is not an active worker.`);
    }
    const duplicate = this.findAll({ taskId: task.id, workerId }).find(
      (p: any) => ['pending', 'hired'].includes(p.status),
    );
    if (duplicate) {
      throw new ConflictException(
        type === 'proposal'
          ? 'You already have an open proposal on this project.'
          : `${worker.name} already has an open proposal or invitation on this project.`,
      );
    }

    const created = this.proposalsRepository.insert({
      createdAt: new Date().toISOString().slice(0, 10),
      skills: dto.skills || worker.skills || [],
      ...dto,
      id: this.proposalsRepository.generateId(),
      type,
      status: 'pending',
      workerId,
      workerName: worker.name,
      avatar: worker.avatar,
      avatarColor: worker.avatarColor,
      rating: worker.rating,
      completedProjects: worker.completedProjects,
      location: worker.location,
    });

    if (type === 'proposal') {
      this.notifier.notify(
        task.clientId,
        'proposal',
        `New proposal from ${worker.name || 'a worker'}`,
        `${task.title} — Bid: ${dto.bidPrice ?? ''}, Timeline: ${dto.timeline ?? ''}`,
      );
    } else {
      this.notifier.notify(
        workerId,
        'invitation',
        'You have been invited to a project',
        `${task.title || 'Project'} · just now`,
      );
    }
    return created;
  }

  /**
   * The only generic change is closing a pending proposal: its worker
   * withdraws it, or the project's client rejects it (or withdraws an
   * invitation). Hiring and acceptance are separate actions.
   */
  update(id: string, dto: UpdateProposalDto, actor: Actor) {
    const prop = this.findById(id);
    const task = this.tasksService.findById(prop.taskId);
    if (prop.status !== 'pending') {
      throw new ConflictException(
        `This ${prop.type || 'proposal'} is already ${prop.status}.`,
      );
    }
    const isWorker = prop.workerId === actor.id;
    const isClient = task.clientId === actor.id;
    const allowed =
      (dto.status === 'withdrawn' &&
        ((isWorker && prop.type !== 'invitation') ||
          (isClient && prop.type === 'invitation'))) ||
      (dto.status === 'rejected' && isClient && prop.type !== 'invitation');
    if (!allowed) {
      throw new ForbiddenException(
        "A worker may withdraw their own proposal; the project's client may reject a proposal or withdraw an invitation.",
      );
    }
    return this.proposalsRepository.update(id, { status: dto.status });
  }

  /**
   * Assigns the worker and funds project escrow through the ledger.
   * Callers must hold a unit of work, so a failure leaves nothing funded,
   * assigned or marked hired.
   */
  private assignAndFund(prop: any) {
    const task = this.tasksService.findById(prop.taskId);
    this.ledger.fundProjectEscrow(
      task.id,
      task.clientId,
      task.budget,
      task.title,
    );
    this.tasksService.update(prop.taskId, {
      workerId: prop.workerId,
      status: 'in-progress',
    });

    // Every milestone on this project is payable to the hired worker, whatever
    // workerId it was created with.
    for (const ms of this.milestonesService.findAll({ taskId: task.id })) {
      if (ms.workerId !== prop.workerId) {
        this.milestonesService.update(ms.id, { workerId: prop.workerId });
      }
    }
    // This proposal is hired; every other one on the project is rejected.
    this.proposalsRepository.updateAllByTaskId(prop.taskId, prop.id);
  }

  private assertHireable(prop: any) {
    if (prop.status !== 'pending') {
      throw new ConflictException(
        `This ${prop.type || 'proposal'} is already ${prop.status}.`,
      );
    }
    const task = this.tasksService.findById(prop.taskId);
    if (task.status !== 'open') {
      throw new BadRequestException(
        'This project is not open — cannot hire workers.',
      );
    }
    return task;
  }

  /** The project's client hires the worker behind a proposal. Funds escrow. */
  hireWorker(proposalId: string, actor: Actor) {
    const prop = this.findById(proposalId);
    if (prop.type === 'invitation') {
      throw new BadRequestException(
        'An invitation is accepted by the invited worker, not hired.',
      );
    }
    const task = this.assertHireable(prop);
    if (task.clientId !== actor.id) {
      throw new ForbiddenException(
        'Only the client who owns this project can hire for it.',
      );
    }
    this.uow.run([ProposalsRepository, ...SETTLEMENT_STORES], () =>
      this.assignAndFund(prop),
    );
    return this.proposalsRepository.findById(proposalId);
  }

  /** The invited worker accepts. The client's wallet funds escrow at this point. */
  acceptInvitation(proposalId: string, actor: Actor) {
    const prop = this.findById(proposalId);
    if (prop.type !== 'invitation')
      throw new BadRequestException('This is not an invitation.');
    if (prop.workerId !== actor.id) {
      throw new ForbiddenException(
        'Only the invited worker can accept this invitation.',
      );
    }
    this.assertHireable(prop);
    this.uow.run([ProposalsRepository, ...SETTLEMENT_STORES], () =>
      this.assignAndFund(prop),
    );
    return this.proposalsRepository.findById(proposalId);
  }

  declineInvitation(proposalId: string, actor: Actor) {
    const prop = this.findById(proposalId);
    if (prop.type !== 'invitation')
      throw new BadRequestException('This is not an invitation.');
    if (prop.workerId !== actor.id) {
      throw new ForbiddenException(
        'Only the invited worker can decline this invitation.',
      );
    }
    if (prop.status !== 'pending') {
      throw new ConflictException(`This invitation is already ${prop.status}.`);
    }
    return this.proposalsRepository.update(proposalId, { status: 'rejected' });
  }

  private safeTask(taskId: string) {
    try {
      return this.tasksService.findById(taskId);
    } catch {
      return null;
    }
  }

  private users(): UsersService {
    return this.accounts;
  }

  resetToSeed() {
    this.proposalsRepository.resetToSeed();
  }
}
