import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputesRepository } from './disputes.repository';
import { MilestonesService } from '../milestones/milestones.service';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { LedgerService } from '../ledger/ledger.service';
import { canViewTask, canViewAnyRecord } from '../../common/guards/viewer.util';
import { AuditRequestsService } from '../audit-requests/audit-requests.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { Actor } from '../../common/decorators/current-actor.decorator';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { ProjectTerminationService } from '../termination/project-termination.service';
import {
  formatInr,
  fromPaise,
  splitInHalf,
  toPaise,
} from '../../common/money/inr';
import { UsersRepository } from '../users/users.repository';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { AUDIT_STATUS, NEGOTIABLE } from '../audit-requests/audit-request.constants';

export type DisputeVerdict = 'client-favour' | 'worker-favour' | 'split';

/**
 * DisputesService — Business Logic Layer
 *
 * Handles dispute creation, resolution, and milestone status updates.
 * Delegates all data-access operations to DisputesRepository.
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly disputesRepository: DisputesRepository,
    private milestonesService: MilestonesService,
    private tasksService: TasksAccessService,
    private ledger: LedgerService,
    private auditRequests: AuditRequestsService,
    private readonly log: AppLoggerService,
    private readonly uow: UnitOfWork,
    private readonly users: UsersRepository,
    private readonly termination: ProjectTerminationService,
    private readonly engagements: AuditRequestsRepository,
  ) {}

  findAll(viewer?: { id?: string; role?: string }) {
    const all = this.disputesRepository.findAll();
    if (!viewer || canViewAnyRecord(viewer.role)) return all;
    // Visible to the parties and the reviewer arbitrating it — not to every
    // reviewer on the platform, which is what an unguarded GET allowed.
    return all.filter((d: any) => this.canView(d, viewer));
  }

  findById(id: string, viewer?: { id?: string; role?: string }) {
    const d = this.disputesRepository.findById(id);
    if (!d) throw new NotFoundException(`Dispute with id "${id}" not found`);
    if (viewer && !this.canView(d, viewer)) {
      throw new ForbiddenException(
        'You do not have access to this dispute. Only the people involved can view it.',
      );
    }
    return d;
  }

  private canView(d: any, viewer: { id?: string; role?: string }): boolean {
    const task = d.taskId
      ? this.safe(() => this.tasksService.findById(d.taskId))
      : null;
    return canViewTask(
      viewer.id,
      viewer.role,
      task,
      d.expertId,
      d.raisedBy,
      d.againstId,
    );
  }

  private safe<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }

  /**
   * A party to the project (its client or hired worker) disputes one of its
   * milestones. The raiser is the actor and the other party is derived from
   * the project. Body identity fields that disagree are rejected.
   *
   * The dispute, the milestone's frozen status and the arbitration engagement
   * are recorded together. Opening the engagement stays best-effort: a
   * dispute must exist even if no reviewer can be engaged yet.
   */
  create(dto: CreateDisputeDto, actor: Actor) {
    const task = this.tasksService.findById(dto.taskId);
    const isClient = task.clientId === actor.id;
    if (!isClient && task.workerId !== actor.id) {
      throw new ForbiddenException(
        "Only the project's client or hired worker can raise a dispute about it.",
      );
    }
    if (dto.raisedBy && dto.raisedBy !== actor.id) {
      throw new BadRequestException('raisedBy must be your own account.');
    }
    const againstId = isClient ? task.workerId : task.clientId;
    if (!againstId)
      throw new ConflictException(
        'Nobody has been hired on this project, so there is no one to dispute with.',
      );
    if (dto.againstId && dto.againstId !== againstId) {
      throw new BadRequestException(
        'againstId must be the other party on this project.',
      );
    }

    const ms = dto.milestoneId
      ? this.milestonesService.findById(dto.milestoneId)
      : null;
    if (ms) {
      if (ms.taskId !== task.id)
        throw new BadRequestException(
          'That milestone does not belong to this project.',
        );
      if (['completed', 'cancelled'].includes(ms.status)) {
        throw new ConflictException(
          `That milestone is already ${ms.status}; there is nothing left to dispute.`,
        );
      }
      const active = this.disputesRepository
        .findAll()
        .find((d: any) => d.milestoneId === ms.id && d.status !== 'resolved');
      if (active)
        throw new ConflictException(
          `That milestone is already under dispute (${active.id}).`,
        );
    }
    // Check the reviewer before recording anything, so a dispute never stores
    // an expertId that could not take the case.
    if (dto.expertId)
      this.auditRequests.assertAssignableExpert(dto.expertId, task.category);

    const users = this.users;
    const dispute: any = {
      id: this.disputesRepository.generateId(),
      taskId: task.id,
      milestoneId: ms?.id || undefined,
      raisedBy: actor.id,
      raisedByName: users.findById(actor.id)?.name,
      againstId,
      againstName: users.findById(againstId)?.name,
      reason: dto.reason,
      amount: ms ? formatInr(ms.budget) : dto.amount,
      project: task.title,
      milestone: ms?.title || dto.milestone,
      expertId: dto.expertId || null,
      status: 'open',
      verdict: null,
      resolution: null,
      createdAt: new Date().toISOString().slice(0, 10),
      resolvedAt: null,
    };

    return this.uow.run(
      [DisputesRepository, MilestonesRepository, AuditRequestsRepository],
      () => {
        this.disputesRepository.insert(dispute);
        // Freezes approval and payout of this milestone until the verdict.
        if (ms) this.milestonesService.update(ms.id, { status: 'disputed' });

        try {
          const engagement = this.auditRequests.create({
            kind: 'dispute-audit',
            taskId: task.id,
            milestoneId: dispute.milestoneId || undefined,
            clientId: task.clientId,
            workerId: task.workerId || undefined,
            disputeId: dispute.id,
            // Assigned to the reviewer the raiser chose; no other reviewer sees it.
            expertId: dispute.expertId || undefined,
            category: task.category,
            severity: 'High',
            project: task.title,
            milestone: dispute.milestone,
            status: 'preview-sent',
          });
          this.disputesRepository.update(dispute.id, {
            auditRequestId: engagement.id,
          });
        } catch (e) {
          this.log.warn(
            'disputes.create',
            `dispute ${dispute.id} recorded without an audit engagement (task ${task.id}, reviewer ${dispute.expertId})`,
            e,
          );
        }
        return this.disputesRepository.findById(dispute.id);
      },
    );
  }

  /**
   * Records the assigned reviewer's verdict and settles the disputed milestone.
   *
   *  - client-favour: the money stays in escrow and the work goes back to the
   *    worker for revision. The client approves the revised work as usual.
   *  - worker-favour: the milestone is paid once, net of the worker's fee.
   *  - split: the worker gets half the milestone rounded down to the paisa
   *    (fees apply to that share only); the client gets the rest back.
   *
   * Verdict, money movement, milestone status and project progress commit
   * together; if any step fails, nothing changes. Repeating the recorded
   * verdict returns it without moving money; a different verdict is refused.
   */
  resolve(id: string, dto: ResolveDisputeDto, actor: Actor) {
    const dispute = this.findById(id);
    if (!dispute.expertId) {
      throw new ConflictException(
        'No reviewer is assigned to this dispute yet.',
      );
    }
    if (actor.id !== dispute.expertId) {
      throw new ForbiddenException(
        'Only the reviewer assigned to this dispute can give its verdict.',
      );
    }
    if (dto.expertId && dto.expertId !== actor.id) {
      throw new BadRequestException(
        'The expertId sent does not match the signed-in reviewer.',
      );
    }

    const verdict = dto.verdict as DisputeVerdict;
    if (dispute.status === 'resolved') {
      if (dispute.verdict === verdict) return { ...dispute, replayed: true };
      throw new ConflictException(
        `This dispute was already resolved as ${dispute.verdict}; that verdict cannot be replaced.`,
      );
    }

    const resolved = this.uow.run([DisputesRepository, AuditRequestsRepository, ...SETTLEMENT_STORES], () => {
      const settlement = dispute.milestoneId
        ? this.settleMilestone(dispute, verdict)
        : null;
      this.closeUnfundedEngagement(dispute.auditRequestId);
      return {
        ...this.disputesRepository.update(id, {
          status: 'resolved',
          verdict,
          resolution: dto.resolution,
          resolvedAt: new Date().toISOString().slice(0, 10),
          settlement,
        }),
        replayed: false,
      };
    });
    // A verdict may have been the last thing a pending termination waited for.
    this.termination.reevaluateAfterSettlement(dispute.taskId);
    return resolved;
  }

  /**
   * A verdict ends the arbitration. An engagement whose fee was never funded
   * has nothing left to do and is closed; a funded one stays open so the
   * reviewer can file their report and be paid from audit escrow.
   */
  private closeUnfundedEngagement(engagementId?: string) {
    if (!engagementId) return;
    const engagement = this.engagements.findById(engagementId);
    if (engagement && [...NEGOTIABLE, AUDIT_STATUS.AGREED].includes(engagement.status)) {
      this.engagements.update(engagementId, { status: AUDIT_STATUS.CANCELLED });
    }
  }

  /** Applies a verdict to the disputed milestone. Callers must hold a unit of work. */
  private settleMilestone(dispute: any, verdict: DisputeVerdict) {
    const ms = this.milestonesService.findById(dispute.milestoneId);
    const task = this.tasksService.findById(dispute.taskId);
    if (ms.taskId !== task.id) {
      throw new ConflictException(
        'The disputed milestone does not belong to the disputed project.',
      );
    }
    if (['completed', 'cancelled'].includes(ms.status)) {
      throw new ConflictException(
        `The disputed milestone is already ${ms.status}; there is nothing to settle.`,
      );
    }
    const parties = { taskId: task.id, clientId: task.clientId };

    if (verdict === 'client-favour') {
      // Funded rework: nothing is refunded; the worker revises and resubmits.
      this.milestonesService.markRevisionNeeded(ms.id);
      return { kind: 'funded-rework', held: ms.budget };
    }

    if (verdict === 'worker-favour') {
      const release = this.ledger.releaseMilestone({
        ...parties,
        milestoneId: ms.id,
        workerId: ms.workerId!,
        amount: ms.budget,
        description: `Dispute resolved in worker's favour — ${ms.title}`,
      });
      this.milestonesService.markCompleted(ms.id);
      this.milestonesService.rollUpTaskProgress(task.id);
      return { kind: 'paid', release };
    }

    const shares = splitInHalf(toPaise(ms.budget));
    const release =
      shares.worker > 0
        ? this.ledger.releaseMilestone({
            ...parties,
            milestoneId: ms.id,
            workerId: ms.workerId!,
            amount: fromPaise(shares.worker),
            description: `Dispute split — worker's share of ${ms.title}`,
          })
        : null;
    const refund =
      shares.client > 0
        ? this.ledger.refundToClient({
            ...parties,
            amount: fromPaise(shares.client),
            reason: `Dispute split — client's share of ${ms.title}`,
          })
        : null;
    this.milestonesService.markCompleted(ms.id);
    this.milestonesService.rollUpTaskProgress(task.id);
    return { kind: 'split', release, refund };
  }

  resetToSeed() {
    this.disputesRepository.resetToSeed();
  }
}
