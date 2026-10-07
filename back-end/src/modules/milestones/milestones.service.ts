import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import type { MilestoneRecord } from './milestones.types';
import { MilestonesRepository } from './milestones.repository';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditRequestsService } from '../audit-requests/audit-requests.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { Actor } from '../../common/decorators/current-actor.decorator';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { formatInr, toPaise } from '../../common/money/inr';
import { stripUnchangedProtectedFields } from '../../common/policies/protected-fields';
import { DisputesRepository } from '../disputes/disputes.repository';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';

export { SETTLEMENT_STORES };

import { ProjectTerminationService } from '../termination/project-termination.service';
import type { TaskRecord } from '../tasks/tasks.types';
/** States a worker may submit (or resubmit) work from. */
const SUBMITTABLE = ['pending', 'in-progress', 'revision-needed', 'submitted'];
/** States a client may approve from: work has been handed in and is under review. */
const APPROVABLE = ['submitted', 'review'];
/** Project states in which no new work is accepted. */
const CLOSED_PROJECT = ['completed', 'cancelled'];

/**
 * MilestonesService — Business Logic Layer
 *
 * Handles submission, approval, audit-request creation, and task-completion checks.
 * Delegates all data-access operations to MilestonesRepository.
 */
@Injectable()
export class MilestonesService {
  constructor(
    private readonly milestonesRepository: MilestonesRepository,
    private tasksService: TasksAccessService,
    private usersService: UsersService,
    private transactionsService: TransactionsService,
    private ledger: LedgerService,
    private auditRequestsService: AuditRequestsService,
    private notificationsService: NotificationsService,
    private readonly log: AppLoggerService,
    private readonly uow: UnitOfWork,
    private readonly disputes: DisputesRepository,
    private readonly termination: ProjectTerminationService,
  ) {}

  /**
   * Once a party asks to end the contract, no new work starts. Work already
   * submitted still goes through approval or a dispute.
   */
  private assertNotTerminating(task: Pick<TaskRecord, 'terminationRequest' | 'termination'>, action: string) {
    if (this.termination.isTerminating(task)) {
      throw new ConflictException(
        `A request to end this contract is pending, so ${action} is no longer possible. Approve or dispute work already submitted.`,
      );
    }
  }

  findAll(query?: { taskId?: string }) {
    return this.milestonesRepository.findAll(query);
  }

  findById(id: string) {
    const ms = this.milestonesRepository.findById(id);
    if (!ms) throw new NotFoundException(`Milestone with id "${id}" not found`);
    return ms;
  }

  // ── Viewer-scoped reads (HTTP) ─────────────────────────────────────────────

  /** Milestones are visible to whoever may see their project. */
  findAllFor(actor: Actor, query: { taskId?: string }) {
    const visible = new Map<string, boolean>();
    return this.findAll(query).filter((m: any) => {
      if (!visible.has(m.taskId)) {
        const task = this.safeTask(m.taskId);
        visible.set(m.taskId, !!task && this.tasksService.canView(task, actor));
      }
      return visible.get(m.taskId);
    });
  }

  findByIdFor(id: string, actor: Actor) {
    const ms = this.findById(id);
    this.tasksService.findByIdFor(ms.taskId, actor);
    return ms;
  }

  // ── Generic writes (HTTP) ──────────────────────────────────────────────────

  /**
   * Adds a milestone to a project the actor owns. It starts pending and is
   * payable to the project's hired worker, whatever the body says.
   */
  createFor(dto: CreateMilestoneDto, actor: Actor) {
    const task = this.tasksService.findById(dto.taskId);
    if (task.clientId !== actor.id) {
      throw new ForbiddenException(
        'Only the client who owns this project can add milestones to it.',
      );
    }
    if (CLOSED_PROJECT.includes(task.status)) {
      throw new ConflictException(
        `This project is ${task.status}; it no longer accepts new milestones.`,
      );
    }
    this.assertNotTerminating(task, 'adding milestones');
    if (toPaise(dto.budget) <= 0)
      throw new BadRequestException(
        'A milestone budget must be greater than zero.',
      );
    return this.create({ ...dto, workerId: task.workerId || undefined });
  }

  /**
   * Edits a milestone within what each party is allowed to change.
   *
   *  - The owning client edits its description (title, description, due
   *    date, priority) and, while the project is unfunded, its budget.
   *  - The assigned worker starts work (pending or revision-needed →
   *    in-progress) and reports progress below 100%.
   *
   * Everything else (submission, approval, revision, disputes) has its own
   * action. Legacy forms resend whole records, so unchanged values are ignored.
   */
  updateFor(id: string, dto: UpdateMilestoneDto, actor: Actor) {
    const ms = this.findById(id);
    const task = this.tasksService.findById(ms.taskId);
    const isClient = task.clientId === actor.id;
    const isWorker = !!ms.workerId && ms.workerId === actor.id;
    if (!isClient && !isWorker) {
      throw new ForbiddenException(
        "Only the project's client or the assigned worker can change this milestone.",
      );
    }

    if (isWorker && dto.status !== undefined && dto.status !== ms.status) {
      this.assertNotTerminating(task, 'starting work');
    }
    const editable: string[] = isClient
      ? ['title', 'description', 'dueDate', 'priority', 'budget']
      : ['status', 'progress'];
    const locked = Object.keys(dto).filter(
      (field) => !editable.includes(field),
    );
    const changes: any = stripUnchangedProtectedFields(
      dto,
      ms,
      locked,
      (field) =>
        `"${field}" cannot be changed here${field === 'status' ? '; use submit, approve, request-revision or a dispute' : ''}.`,
    );

    if (
      isClient &&
      changes.budget !== undefined &&
      changes.budget !== ms.budget
    ) {
      toPaise(changes.budget);
      if (
        task.status !== 'open' ||
        task.workerId ||
        this.ledger.getEscrow(task.id).projectHeld > 0
      ) {
        throw new ConflictException(
          'A milestone budget can only change before anyone is hired.',
        );
      }
    }
    if (isWorker) {
      if (changes.status !== undefined && changes.status !== ms.status) {
        if (
          changes.status !== 'in-progress' ||
          !['pending', 'revision-needed'].includes(ms.status)
        ) {
          throw new ConflictException(
            `A worker can only start work on a pending milestone; this one is ${ms.status}.`,
          );
        }
      }
      if (changes.progress !== undefined) {
        const status = changes.status ?? ms.status;
        if (
          status !== 'in-progress' ||
          changes.progress < 0 ||
          changes.progress >= 100
        ) {
          throw new BadRequestException(
            'Progress is reported between 0 and 99 while work is in progress; submit to finish.',
          );
        }
      }
    }
    return this.milestonesRepository.update(id, changes);
  }

  /**
   * The owning client sends submitted work back for changes. The money stays
   * in escrow; the worker revises and resubmits.
   */
  requestRevision(id: string, reason: string, actor: Actor) {
    const ms = this.findById(id);
    const task = this.tasksService.findById(ms.taskId);
    if (actor.id !== task.clientId) {
      throw new ForbiddenException(
        'Only the client who owns this project can request changes.',
      );
    }
    if (!APPROVABLE.includes(ms.status)) {
      throw new ConflictException(
        `Changes can only be requested on submitted work; this milestone is ${ms.status}.`,
      );
    }
    this.assertNotTerminating(task, 'requesting changes');
    this.assertNoActiveDispute(ms.id);

    const updated = this.milestonesRepository.update(id, {
      status: 'revision-needed',
      revisionRequest: {
        reason,
        requestedAt: new Date().toISOString().slice(0, 10),
      },
    });
    this.notifyAfterCommit(ms.workerId || undefined, {
      type: 'revision-requested',
      text: 'Changes requested on your submission',
      subtext: `${ms.title} — ${reason}`,
    });
    return updated;
  }

  // ── Internal writes (trusted callers) ──────────────────────────────────────

  /** Internal creation for an authorised caller. HTTP requests use createFor. */
  create(dto: CreateMilestoneDto) {
    const ms: MilestoneRecord = {
      priority: dto.priority || 'Medium',
      dueDate: dto.dueDate || null,
      ...dto,
      id: this.milestonesRepository.generateId(),
      description: dto.description || '',
      workerId: dto.workerId || null,
      status: 'pending',
      submittedAt: null,
      approvedAt: null,
      deliverable: null,
      progress: 0,
    };
    return this.milestonesRepository.insert(ms);
  }

  /** Internal workflow write (hiring, dispute flags). HTTP requests use updateFor. */
  update(id: string, dto: Record<string, any>) {
    const updated = this.milestonesRepository.update(id, dto);
    if (!updated)
      throw new NotFoundException(`Milestone with id "${id}" not found`);
    return updated;
  }

  private safeTask(taskId: string) {
    try {
      return this.tasksService.findById(taskId);
    } catch {
      return null;
    }
  }

  /**
   * Hands in work for a milestone.
   *
   * Only the milestone's assigned worker may submit, only while the work is
   * open (pending, in progress, sent back for revision, or already submitted
   * and awaiting review), and never while a dispute about it is open.
   */
  submitDeliverable(id: string, deliverable: any, actor: Actor) {
    const ms = this.findById(id);
    const task = this.tasksService.findById(ms.taskId);
    const workerId = ms.workerId || task.workerId;

    if (!workerId || actor.id !== workerId) {
      throw new ForbiddenException(
        'Only the worker assigned to this milestone can submit work for it.',
      );
    }
    if (CLOSED_PROJECT.includes(task.status)) {
      throw new ConflictException(
        `This project is ${task.status}; it no longer accepts submissions.`,
      );
    }
    if (!SUBMITTABLE.includes(ms.status)) {
      throw new ConflictException(
        `Work cannot be submitted for a milestone that is ${ms.status}.`,
      );
    }
    this.assertNotTerminating(task, 'submitting new work');
    this.assertNoActiveDispute(ms.id);

    const updated = this.milestonesRepository.update(id, {
      status: 'submitted',
      submittedAt: new Date().toISOString().slice(0, 10),
      ...(deliverable ? { deliverable } : {}),
    });

    this.handOverToAuditor(updated);
    this.notifyAfterCommit(task.clientId, {
      type: 'milestone-submitted',
      text: 'New deliverable submitted',
      subtext: `${ms.title || 'Milestone'} — ${task.title || 'Project'} · just now`,
    });

    return updated;
  }

  /**
   * Points the project's audit engagement at the milestone that now needs
   * reviewing, and tells the reviewer.
   *
   * Two rules live here:
   *
   *  - **Only the assigned reviewer hears about it.** The page that used to do
   *    this looped over every expert account and notified all of them, so
   *    reviewers with no connection to the project were told about work they
   *    could not open.
   *  - **A milestone is audited once.** If a report already exists for it —
   *    the case when a dispute sends the work back and the worker resubmits —
   *    the engagement is left alone and nobody is notified again.
   */
  private handOverToAuditor(ms: any) {
    try {
      const task = this.tasksService.findById(ms.taskId);
      if (!task?.auditEnabled) return;

      const engagement = this.auditRequestsService.activeProjectAudit(
        ms.taskId,
      );
      if (!engagement || !engagement.expertId) return;

      if (this.auditRequestsService.isMilestoneAudited(engagement, ms.id)) {
        this.log.log(
          'milestones.submit',
          `milestone ${ms.id} was already audited under ${engagement.id}; no second audit raised`,
        );
        return;
      }

      const workerName =
        this.usersService.findById(ms.workerId)?.name || 'Worker';
      this.auditRequestsService.update(engagement.id, {
        milestoneId: ms.id,
        worker: workerName,
        milestone: ms.title,
      });

      this.notificationsService.create({
        userId: engagement.expertId,
        type: 'audit-needed',
        text: 'New deliverable awaiting technical audit',
        subtext: `${ms.title || 'Milestone'} — ${task.title || 'Project'}`,
      } as any);
    } catch (e) {
      // Submission succeeded; only the audit hand-off failed. The reviewer
      // would just never see the milestone, with no clue why.
      this.log.warn(
        'milestones.submit',
        `could not attach milestone ${ms.id} to the active audit engagement`,
        e,
      );
    }
  }

  /**
   * Approves submitted work for the owning client and pays the worker.
   *
   * Preconditions: the actor owns the project; the milestone is submitted or
   * under review; no dispute about it is open; and, when the project has a
   * technical audit, a report covers this exact milestone. The report informs
   * the client's decision; it does not approve anything by itself.
   *
   * Payout, milestone status and project progress commit together. Approving
   * an already-approved milestone moves no money and returns the recorded
   * payout.
   */
  approveDeliverable(id: string, actor: Actor) {
    const ms = this.findById(id);
    const task = this.tasksService.findById(ms.taskId);

    if (actor.id !== task.clientId) {
      throw new ForbiddenException(
        'Only the client who owns this project can approve its work.',
      );
    }

    const recorded = this.ledger.getMilestoneRelease(id);
    if (recorded && ms.status === 'completed') {
      return { ...ms, release: { alreadyReleased: true, ...recorded } };
    }
    if (!APPROVABLE.includes(ms.status)) {
      throw new ConflictException(
        `Only submitted work can be approved; this milestone is ${ms.status}.`,
      );
    }
    this.assertNoActiveDispute(ms.id);
    this.assertAuditCoverage(task, ms);

    const result = this.uow.run(SETTLEMENT_STORES, () => {
      const release = this.ledger.releaseMilestone({
        milestoneId: id,
        taskId: ms.taskId,
        clientId: task.clientId,
        workerId: ms.workerId!,
        amount: ms.budget,
        description: `Payment for ${ms.title}`,
      });
      const approved = this.markCompleted(id);
      this.rollUpTaskProgress(ms.taskId);
      return { ...approved, release };
    });

    this.notifyAfterCommit(ms.workerId || undefined, {
      type: 'milestone-approved',
      text: 'Milestone approved — payment released',
      subtext: `${ms.title} — ${formatInr(result.release.net)} credited`,
    });
    // An approval may have been the last thing a pending termination waited for.
    this.termination.reevaluateAfterSettlement(ms.taskId);
    return result;
  }

  /** Marks a milestone finished and paid. Callers must hold a unit of work. */
  markCompleted(id: string) {
    return this.milestonesRepository.update(id, {
      status: 'completed',
      approvedAt: new Date().toISOString().slice(0, 10),
      progress: 100,
    });
  }

  /** Sends work back to the worker; any escrow stays held. */
  markRevisionNeeded(id: string) {
    return this.milestonesRepository.update(id, { status: 'revision-needed' });
  }

  /**
   * Recomputes a project's progress from its milestones. Throws on failure so
   * that, inside a unit of work, a settlement and its rollup commit together.
   */
  rollUpTaskProgress(taskId: string) {
    const allMilestones = this.milestonesRepository.filterByTaskId(taskId);
    if (!allMilestones.length) return;

    const done = allMilestones.filter((m) =>
      ['completed', 'approved', 'audit-passed', 'done'].includes(m.status),
    ).length;
    const pct = Math.round((done / allMilestones.length) * 100);

    this.tasksService.update(taskId, {
      progress: pct,
      status: pct === 100 ? 'completed' : 'in-progress',
    });
  }

  /** Best-effort rollup for callers outside a settlement. */
  checkTaskCompletion(taskId: string) {
    if (!taskId) return;
    try {
      this.rollUpTaskProgress(taskId);
    } catch (e) {
      this.log.warn(
        'milestones.checkTaskCompletion',
        `could not roll progress up to task ${taskId}`,
        e,
      );
    }
  }

  /** A milestone under dispute is frozen until the reviewer's verdict. */
  private assertNoActiveDispute(milestoneId: string) {
    const disputes = this.disputes;
    const active = disputes
      .findAll()
      .find(
        (d: any) => d.milestoneId === milestoneId && d.status !== 'resolved',
      );
    if (active) {
      throw new ConflictException(
        `This milestone is under dispute (${active.id}); it is frozen until the reviewer gives a verdict.`,
      );
    }
  }

  /** With a technical audit, the client may approve only after this milestone's report is filed. */
  private assertAuditCoverage(task: any, ms: any) {
    if (!task.auditEnabled) return;
    const engagement = this.auditRequestsService.activeProjectAudit(task.id);
    if (
      !engagement ||
      !this.auditRequestsService.isMilestoneAudited(engagement, ms.id)
    ) {
      throw new ConflictException(
        "This project has a technical audit. Wait for the reviewer's report on this milestone before approving it.",
      );
    }
  }

  /** Notifications follow a committed change; failing to send one never undoes it. */
  private notifyAfterCommit(
    userId: string | null | undefined,
    note: { type: string; text: string; subtext: string },
  ) {
    if (!userId) return;
    try {
      this.notificationsService.create({ userId, ...note } as any);
    } catch (e) {
      this.log.warn(
        'milestones.notify',
        `could not notify ${userId} (${note.type})`,
        e,
      );
    }
  }

  resetToSeed() {
    this.milestonesRepository.resetToSeed();
  }
}
