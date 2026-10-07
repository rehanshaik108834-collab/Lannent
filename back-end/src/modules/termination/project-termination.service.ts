import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TasksRepository } from '../tasks/tasks.repository';
import type { TaskRecord, TerminationSettlement } from '../tasks/tasks.types';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { DisputesRepository } from '../disputes/disputes.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { TERMINAL } from '../audit-requests/audit-request.constants';
import { LedgerService } from '../ledger/ledger.service';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { NotificationsService } from '../notifications/notifications.service';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import type { Actor } from '../../common/decorators/current-actor.decorator';

/** Milestones whose outcome a termination must wait for: handed in, awaiting the client. */
const AWAITING_DECISION = ['submitted', 'review'];
/** Unfinished work a termination closes without payment. */
const UNFINISHED = ['pending', 'in-progress', 'revision-needed'];

export type TerminationStatus =
  | { state: 'pending'; blockingMilestoneIds: string[]; activeDisputeIds: string[]; task: TaskRecord }
  | { state: 'finalized'; termination: TerminationSettlement; task: TaskRecord };

/**
 * Ending a contract early.
 *
 * 1. Either party requests termination with a reason. From then on no new
 *    work starts: no new submissions, revisions, milestones or hiring.
 * 2. Submitted milestones still need the client's approval or a dispute
 *    verdict, and open disputes still need their reviewer. Nothing is decided
 *    automatically; the request stays pending and names the blockers.
 * 3. Once nothing blocks, finalization closes unfinished milestones, refunds
 *    the project escrow actually held and all unpaid audit escrow to the
 *    client, closes unfinished engagements, and marks the project cancelled.
 *    Paid work, paid audit fees and earned platform fees are kept.
 *
 * Finalization runs in one unit of work and is recorded once; asking again
 * returns the recorded settlement. Approvals and verdicts re-evaluate a
 * pending request after they commit.
 */
@Injectable()
export class ProjectTerminationService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly milestones: MilestonesRepository,
    private readonly disputes: DisputesRepository,
    private readonly engagements: AuditRequestsRepository,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly uow: UnitOfWork,
    private readonly log: AppLoggerService,
  ) {}

  request(taskId: string, reason: string, actor: Actor): TerminationStatus {
    const task = this.findTask(taskId);
    const isClient = task.clientId === actor.id;
    if (!isClient && task.workerId !== actor.id) {
      throw new ForbiddenException('Only the project’s client or hired worker can end this contract.');
    }
    if (task.termination) return this.evaluate(taskId);
    if (!task.workerId) {
      throw new ConflictException(
        'Nobody has been hired, so there is no contract to end. Delete the project or cancel the draft instead.',
      );
    }
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new ConflictException(`This project is already ${task.status}.`);
    }
    if (!reason?.trim()) throw new BadRequestException('Give a reason for ending the contract.');

    if (!task.terminationRequest) {
      this.tasks.update(taskId, {
        terminationRequest: {
          requestedBy: actor.id,
          reason: reason.trim(),
          requestedAt: new Date().toISOString().slice(0, 10),
        },
      });
      const otherParty = isClient ? task.workerId : task.clientId;
      this.notify(otherParty, 'termination-requested', 'The other party asked to end the contract', `${task.title} — ${reason.trim()}`);
    }
    return this.evaluate(taskId);
  }

  /** Current state of a termination; finalizes it if nothing blocks any more. */
  evaluate(taskId: string): TerminationStatus {
    const task = this.findTask(taskId);
    if (task.termination) return { state: 'finalized', termination: task.termination, task };
    if (!task.terminationRequest) throw new ConflictException('No termination has been requested for this project.');

    const blockingMilestoneIds = this.milestones
      .filterByTaskId(taskId)
      .filter((m) => AWAITING_DECISION.includes(m.status))
      .map((m) => m.id);
    const activeDisputeIds = this.disputes
      .findAll()
      .filter((d) => d.taskId === taskId && d.status !== 'resolved')
      .map((d) => d.id);
    if (blockingMilestoneIds.length || activeDisputeIds.length) {
      return { state: 'pending', blockingMilestoneIds, activeDisputeIds, task };
    }

    const finalized = this.uow.run([AuditRequestsRepository, ...SETTLEMENT_STORES], () => this.finalize(task));
    this.notify(task.clientId, 'termination-finalized', 'Contract ended', `${task.title} — unused escrow returned to the client`);
    this.notify(task.workerId, 'termination-finalized', 'Contract ended', task.title);
    return { state: 'finalized', termination: finalized.termination!, task: finalized };
  }

  /** Re-evaluates a pending termination after an approval or verdict; never throws. */
  reevaluateAfterSettlement(taskId: string): void {
    try {
      const task = this.tasks.findById(taskId);
      if (task?.terminationRequest && !task.termination) this.evaluate(taskId);
    } catch (e) {
      this.log.warn('termination.reevaluate', `could not finalize termination of ${taskId}`, e);
    }
  }

  /** Whether new work on this project is blocked by a termination request. */
  isTerminating(task: Pick<TaskRecord, 'terminationRequest' | 'termination'>): boolean {
    return !!task.terminationRequest || !!task.termination;
  }

  private finalize(task: TaskRecord): TaskRecord {
    const reason = `Contract ended — ${task.title}`;
    const cancelledMilestoneIds: string[] = [];
    for (const m of this.milestones.filterByTaskId(task.id)) {
      if (UNFINISHED.includes(m.status)) {
        this.milestones.update(m.id, { status: 'cancelled' });
        cancelledMilestoneIds.push(m.id);
      }
    }

    // Refund what is actually held — never the budget.
    const held = this.ledger.getEscrow(task.id);
    const projectRefunded = held.projectHeld > 0 ? held.projectHeld : 0;
    if (projectRefunded) {
      this.ledger.refundToClient({ taskId: task.id, clientId: task.clientId, amount: projectRefunded, reason });
    }
    const auditRefunded = held.auditHeld > 0 ? held.auditHeld : 0;
    if (auditRefunded) {
      this.ledger.refundAuditEscrow({ taskId: task.id, clientId: task.clientId, amount: auditRefunded, reason });
    }

    // Unfinished engagements close without claiming coverage they never completed.
    const closedEngagementIds: string[] = [];
    for (const engagement of this.engagements.findAll({ taskId: task.id })) {
      if (!TERMINAL.includes(engagement.status)) {
        this.engagements.update(engagement.id, { status: 'cancelled' });
        closedEngagementIds.push(engagement.id);
      }
    }

    const allDone = this.milestones
      .filterByTaskId(task.id)
      .every((m) => ['completed', 'approved', 'audit-passed'].includes(m.status));
    const updated = this.tasks.update(task.id, {
      status: allDone ? 'completed' : 'cancelled',
      termination: {
        finalizedAt: new Date().toISOString().slice(0, 10),
        projectRefunded,
        auditRefunded,
        cancelledMilestoneIds,
        closedEngagementIds,
      },
    });
    if (!updated) throw new NotFoundException(`Task with id "${task.id}" not found`);
    return updated;
  }

  private findTask(id: string): TaskRecord {
    const task = this.tasks.findById(id);
    if (!task) throw new NotFoundException(`Task with id "${id}" not found`);
    return task;
  }

  /** Notifications follow a committed change; failing to send one never undoes it. */
  private notify(userId: string | null, type: string, text: string, subtext: string) {
    if (!userId) return;
    try {
      this.notifications.create({ userId, type, text, subtext });
    } catch (e) {
      this.log.warn('termination.notify', `could not notify ${userId} (${type})`, e);
    }
  }
}
