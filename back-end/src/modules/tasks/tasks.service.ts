import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksAccessService } from './tasks-access.service';
import type { TaskRecord } from './tasks.types';
import { TasksRepository } from './tasks.repository';
import { LedgerService } from '../ledger/ledger.service';
import { AuditRequestsService } from '../audit-requests/audit-requests.service';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { TERMINAL } from '../audit-requests/audit-request.constants';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { stripUnchangedProtectedFields } from '../../common/policies/protected-fields';
import { CURRENCY, formatInr, fromPaise, toPaise } from '../../common/money/inr';
import { ROLES } from '../../common/constants/roles';
import type { Actor } from '../../common/decorators/current-actor.decorator';

/**
 * Fields a generic project PATCH may not change. Status and assignment move
 * through hiring, approval, cancellation and termination; the audit settings
 * are fixed when the project is created.
 */
const WORKFLOW_FIELDS = [
  'status',
  'workerId',
  'progress',
  'clientId',
  'currency',
  'auditEnabled',
  'auditExpertId',
  'auditFee',
  'auditDomain',
] as const;

/**
 * TasksService — Business Logic Layer
 *
 * Handles validation and error handling.
 * Delegates all data-access operations to TasksRepository.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly access: TasksAccessService,
    private ledger: LedgerService,
    private auditRequests: AuditRequestsService,
    private readonly uow: UnitOfWork,
    private readonly engagements: AuditRequestsRepository,
    private readonly milestones: MilestonesRepository,
    private readonly proposals: ProposalsRepository,
  ) {}

  // ── Viewer-scoped reads (HTTP) ──────────────────────────────────────────────

  /**
   * Who may see a project. Open projects are discoverable by any signed-in
   * account. Anything else (drafts, work in progress, finished or cancelled
   * projects) is visible to its client, its worker, a reviewer engaged on it,
   * and oversight roles.
   */
  canView(task: TaskRecord, actor: Actor): boolean {
    return this.access.canView(task, actor);
  }

  /** Applies the viewer's visibility first, then the caller's filters. */
  findAllFor(
    actor: Actor,
    filters: { clientId?: string; workerId?: string; status?: string },
  ) {
    return this.tasksRepository
      .findAll(filters)
      .filter((t) => this.canView(t, actor));
  }

  findByIdFor(id: string, actor: Actor) {
    return this.access.findByIdFor(id, actor);
  }

  private assertOwner(task: any, actor: Actor, action: string) {
    if (task.clientId !== actor.id) {
      throw new ForbiddenException(
        `Only the client who owns this project can ${action}.`,
      );
    }
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Creates a project for the signed-in client, with its initial milestones.
   *
   * The client is the actor, never a body field: a mismatching clientId is
   * rejected. Amounts are INR; milestone budgets must add up exactly (in
   * paise) to the project budget. The project, its milestones and any audit
   * engagement are created in one unit of work, so a refused milestone or
   * reviewer leaves nothing behind.
   */
  createFor(dto: CreateTaskDto, actor: Actor) {
    if (dto.clientId && dto.clientId !== actor.id) {
      throw new BadRequestException(
        'clientId must be your own account; projects are created for the signed-in client.',
      );
    }
    if (dto.currency && dto.currency !== CURRENCY) {
      throw new BadRequestException(
        `Lannent uses ${CURRENCY} only; "${dto.currency}" is not supported.`,
      );
    }
    const budget = toPaise(dto.budget); // rejects more than two decimal places
    const initial = dto.milestones ?? [];
    if (initial.length) {
      const allocated = initial.reduce((sum, m) => sum + toPaise(m.budget), 0);
      if (allocated !== budget) {
        throw new BadRequestException(
          `Milestone budgets add up to ${formatInr(fromPaise(allocated))}, but the project budget is ` +
            `${formatInr(fromPaise(budget))}. They must match exactly.`,
        );
      }
    }
    const { milestones: _milestones, ...fields } = dto;
    return this.uow.run([TasksRepository, MilestonesRepository, AuditRequestsRepository], () => {
      const task = this.create({ ...fields, clientId: actor.id, currency: CURRENCY });
      if (!task) throw new NotFoundException('The project was not created.');
      const created = initial.map((m) =>
        this.milestones.insert({
          id: this.milestones.generateId(),
          taskId: task.id,
          title: m.title.trim(),
          description: m.description?.trim() ?? '',
          budget: fromPaise(toPaise(m.budget)),
          status: 'pending',
          submittedAt: null,
          approvedAt: null,
          deliverable: null,
          workerId: null,
          dueDate: m.dueDate || null,
          priority: 'Medium',
          progress: 0,
        }),
      );
      return { ...task, milestones: created };
    });
  }

  /**
   * Edits project details for the owning client. Status, assignment and audit
   * settings are not editable here. The budget can change only while the
   * project is open, unassigned and unfunded, because hiring funds escrow
   * from it.
   */
  updateByOwner(id: string, dto: UpdateTaskDto, actor: Actor) {
    const task = this.findById(id);
    this.assertOwner(task, actor, 'edit it');
    const changes: any = stripUnchangedProtectedFields(
      dto,
      task,
      WORKFLOW_FIELDS,
      (field) =>
        field === 'status'
          ? 'Project status changes through hiring, approval or cancellation, not by editing the project.'
          : `"${field}" cannot be changed by editing the project.`,
    );
    if (changes.budget !== undefined && changes.budget !== task.budget) {
      toPaise(changes.budget);
      const escrow = this.ledger.getEscrow(id);
      if (task.status !== 'open' || task.workerId || escrow.projectHeld > 0) {
        throw new ConflictException(
          'The budget can only change while the project is open and nobody has been hired.',
        );
      }
    }
    const updated = this.tasksRepository.update(id, changes);
    if (!updated) throw new NotFoundException(`Task with id "${id}" not found`);
    return updated;
  }

  /**
   * Deletes a project that never started: open, unassigned, and holding no
   * money. Nothing is refunded, because nothing was paid; a budget is not
   * money held. Funded, assigned or historically settled projects are kept
   * and must be cancelled or terminated instead, so their records survive.
   */
  deleteFor(id: string, actor: Actor) {
    const task = this.findById(id);
    if (actor.role !== ROLES.SUPERUSER)
      this.assertOwner(task, actor, 'delete it');

    const escrow = this.ledger.getEscrow(id);
    const milestones = this.milestones;
    const paidOut = milestones
      .filterByTaskId(id)
      .some((m: any) => this.ledger.getMilestoneRelease(m.id));
    if (task.status === 'draft') {
      throw new ConflictException(
        'A draft project is withdrawn with "cancel draft", which also refunds any audit escrow.',
      );
    }
    if (
      task.status !== 'open' ||
      task.workerId ||
      escrow.projectHeld > 0 ||
      escrow.auditHeld > 0 ||
      paidOut
    ) {
      throw new ConflictException(
        'Only an open project with nobody hired and no money held can be deleted. Started or funded projects are cancelled instead, so their history is kept.',
      );
    }

    const proposals = this.proposals;
    return this.uow.run(
      [TasksRepository, MilestonesRepository, ProposalsRepository],
      () => {
        for (const p of proposals.findAll({ taskId: id })) {
          if (p.status === 'pending')
            proposals.update(p.id, { status: 'rejected' });
        }
        const removedMilestones = milestones.deleteByTaskId(id);
        this.delete(id);
        return { deleted: true, removedMilestones, refunded: 0 };
      },
    );
  }

  // ── Internal operations (trusted callers) ──────────────────────────────────

  findAll(query?: Parameters<TasksAccessService['findAll']>[0]) {
    return this.access.findAll(query);
  }

  findById(id: string) {
    return this.access.findById(id);
  }

  /** Internal creation for an already-authorised client. HTTP requests use createFor. */
  create(dto: CreateTaskDto & { clientId: string }) {
    // A project that requires a technical audit is not fully created until an
    // expert has accepted and their fee is in escrow. Until then it is a draft:
    // invisible in browse listings and un-hireable.
    const task: TaskRecord = {
      id: this.tasksRepository.generateId(),
      status: dto.auditEnabled ? 'draft' : 'open',
      progress: 0,
      workerId: null,
      createdAt: new Date().toISOString().slice(0, 10),
      currency: CURRENCY,
      skills: dto.skills || [],
      auditEnabled: dto.auditEnabled || false,
      ...dto,
    };
    this.tasksRepository.insert(task);

    // An audited project opens its expert engagement immediately, carrying the
    // client's opening offer. The project stays a draft until an expert accepts.
    if (task.auditEnabled) {
      // The client must name the reviewer. Without one the engagement belongs to
      // nobody, so no reviewer can ever see it and the project stays a draft
      // forever.
      if (!dto.auditExpertId) {
        this.tasksRepository.update(task.id, { status: 'cancelled' });
        throw new BadRequestException(
          'Select an Expert Reviewer for the technical audit before publishing.',
        );
      }
      try {
        this.auditRequests.create({
          kind: 'project-audit',
          taskId: task.id,
          clientId: task.clientId,
          // The client picks one reviewer; only they can see this engagement.
          expertId: dto.auditExpertId,
          category: task.category,
          severity: 'Medium',
          project: task.title,
          status: 'preview-sent',
          openingOffer: dto.auditFee,
          dueDate: task.deadline,
        });
      } catch (e) {
        // An invalid reviewer must not leave a draft with no engagement.
        this.tasksRepository.update(task.id, { status: 'cancelled' });
        throw e;
      }
    }

    return this.tasksRepository.findById(task.id);
  }

  /** Releases a draft project once its audit is funded and accepted. */
  publishDraft(id: string) {
    return this.access.publishDraft(id);
  }

  /**
   * Internal workflow write (hiring, progress rollup). HTTP requests go
   * through updateByOwner instead.
   */
  update(id: string, changes: Partial<TaskRecord>) {
    return this.access.update(id, changes);
  }

  /**
   * Abandons a draft project and returns any audit escrow to the client.
   * Used when the client gives up before an expert accepts.
   */
  cancelDraft(id: string, actor: Actor) {
    const task = this.findById(id);
    this.assertOwner(task, actor, 'cancel it');
    if (task.status !== 'draft') {
      throw new BadRequestException(
        'Only a draft project can be cancelled this way.',
      );
    }
    const engagements = this.engagements;
    // Refund, engagement closure and the project's status commit together.
    return this.uow.run([AuditRequestsRepository, ...SETTLEMENT_STORES], () => {
      const held = this.ledger.getEscrow(id);
      let refund: any = null;
      if (held.auditHeld > 0) {
        refund = this.ledger.refundAuditEscrow({
          taskId: id,
          clientId: task.clientId,
          amount: held.auditHeld,
          reason: `Draft project cancelled — ${task.title}`,
        });
      }
      for (const engagement of engagements.findAll({ taskId: id })) {
        if (!TERMINAL.includes(engagement.status)) {
          engagements.update(engagement.id, { status: 'cancelled' });
        }
      }
      return {
        task: this.tasksRepository.update(id, { status: 'cancelled' }),
        refund,
      };
    });
  }

  delete(id: string) {
    const deleted = this.tasksRepository.deleteById(id);
    if (!deleted) throw new NotFoundException(`Task with id "${id}" not found`);
    return { deleted: true };
  }

  resetToSeed() {
    this.tasksRepository.resetToSeed();
  }
}
