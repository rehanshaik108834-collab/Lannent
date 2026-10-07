import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { TasksRepository } from '../tasks/tasks.repository';
import { stripUnchangedProtectedFields } from '../../common/policies/protected-fields';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { CreateAuditRequestDto } from './dto/create-audit-request.dto';
import { UpdateAuditRequestDto } from './dto/update-audit-request.dto';
import {
  CreateOfferDto,
  AcceptAuditDto,
  DeclineAuditDto,
} from './dto/audit-offer.dto';
import type { AuditRequestRecord } from './audit-requests.types';
import type { AuditStatus } from './audit-request.constants';
import { AuditRequestsRepository } from './audit-requests.repository';
import {
  AUDIT_STATUS,
  AUDIT_KIND,
  NEGOTIABLE,
  TERMINAL,
} from './audit-request.constants';
import {
  canViewTask,
  assertCanViewTask,
  canViewAnyRecord,
} from '../../common/guards/viewer.util';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { UsersService } from '../users/users.service';
import { DisputesRepository } from '../disputes/disputes.repository';
import { LedgerService } from '../ledger/ledger.service';

/**
 * AuditRequestsService — the Expert Reviewer engagement.
 *
 * An audit is hired, priced and paid here: the expert previews the work before
 * committing, both sides exchange offers until they agree, the client funds the
 * agreed fee into escrow, and the expert is paid from it when the report lands.
 */
@Injectable()
export class AuditRequestsService {
  constructor(
    private readonly auditRequestsRepository: AuditRequestsRepository,
    private tasks: TasksAccessService,
    private milestones: MilestonesRepository,
    private users: UsersService,
    private disputes: DisputesRepository,
    private ledger: LedgerService,
    private readonly uow: UnitOfWork,
  ) {}

  findAll(
    query?: {
      expertId?: string;
      status?: string;
      taskId?: string;
      kind?: string;
    },
    viewer?: { id?: string; role?: string },
  ) {
    const all = this.auditRequestsRepository
      .findAll(query)
      .map((ar: any) => this.withProgress(ar));
    if (!viewer || canViewAnyRecord(viewer.role)) return all;
    // An engagement is only visible to its assigned reviewer and the parties to
    // the work. Previously every reviewer saw every project's audit.
    return all
      .filter((ar: any) =>
        canViewTask(
          viewer.id,
          viewer.role,
          this.taskOf(ar),
          ar.expertId,
          ar.clientId,
          ar.workerId,
        ),
      )
      .map((ar: any) => this.withProgress(ar));
  }

  findById(id: string, viewer?: { id?: string; role?: string }) {
    const ar = this.auditRequestsRepository.findById(id);
    if (!ar)
      throw new NotFoundException(`Audit request with id "${id}" not found`);
    if (viewer) {
      assertCanViewTask(
        viewer.id,
        viewer.role,
        this.taskOf(ar),
        ar.expertId,
        ar.clientId,
        ar.workerId,
      );
    }
    return this.withProgress(ar);
  }

  /** Best-effort task lookup for scoping; a missing task must not throw here. */
  private taskOf(ar: any) {
    return ar?.taskId ? this.safe(() => this.tasks.findById(ar.taskId)) : null;
  }

  create(dto: CreateAuditRequestDto & { clientId: string }) {
    const { openingOffer, ...rest } = dto;
    // Spread the payload FIRST, then apply defaults. The reverse order — which
    // this codebase uses widely — lets a key that is present but undefined
    // clobber its own default, producing an engagement with no status at all.
    const ar: AuditRequestRecord = {
      ...rest,
      id: this.auditRequestsRepository.generateId(),
      kind: dto.kind || AUDIT_KIND.PROJECT,
      status: (dto.status || AUDIT_STATUS.PREVIEW_SENT) as AuditStatus,
      severity: dto.severity || 'Medium',
      createdAt: new Date().toISOString().slice(0, 10),
      expertId: dto.expertId || null,
      disputeId: dto.disputeId || null,
      milestoneId: dto.milestoneId || null,
      workerId: dto.workerId || null,
      agreedAmount: null as number | null,
      offers: [],
      // Which milestones this engagement has already reported on. An audit is
      // per-milestone even though the engagement is per-project, so this is
      // what stops a milestone being audited twice and what decides when the
      // whole engagement is finished.
      auditedMilestoneIds: [] as string[],
    };
    if (ar.expertId) this.assertAssignableExpert(ar.expertId, dto.category);
    this.auditRequestsRepository.insert(ar);

    // A client can open with a price so experts see a number in their queue.
    if (openingOffer) {
      this.addOffer(ar.id, {
        amount: openingOffer,
        offeredBy: 'client',
        note: 'Opening offer',
      });
    }
    return this.auditRequestsRepository.findById(ar.id)!;
  }

  update(id: string, dto: UpdateAuditRequestDto) {
    const updated = this.auditRequestsRepository.update(id, dto);
    if (!updated)
      throw new NotFoundException(`Audit request with id "${id}" not found`);
    return updated;
  }

  /**
   * Everything the expert needs to judge the job before accepting it — the
   * project, its milestones, the client, and for a dispute audit the claim
   * itself. Previously an expert accepted with no visibility at all.
   */
  preview(id: string, viewer?: { id?: string; role?: string }) {
    const ar = this.findById(id, viewer);
    const task = this.safe(() => this.tasks.findById(ar.taskId));
    const client = this.safe(() => this.users.findById(ar.clientId));
    const worker = ar.workerId
      ? this.safe(() => this.users.findById(ar.workerId))
      : null;
    const milestones = ar.taskId
      ? this.safe(() => this.milestones.findAll({ taskId: ar.taskId })) || []
      : [];
    const dispute = ar.disputeId
      ? this.safe(() => this.disputes.findById(ar.disputeId))
      : null;
    const focus = ar.milestoneId
      ? milestones.find((m: any) => m.id === ar.milestoneId)
      : null;

    return {
      auditRequest: ar,
      kind: ar.kind,
      project: task
        ? {
            id: task.id,
            title: task.title,
            description: task.description,
            category: task.category,
            budget: task.budget,
            currency: task.currency,
            deadline: task.deadline,
            skills: task.skills,
            status: task.status,
            progress: task.progress,
          }
        : null,
      client: client
        ? {
            id: client.id,
            name: client.name,
            company: client.company,
            avatar: client.avatar,
            avatarColor: client.avatarColor,
          }
        : null,
      worker: worker
        ? {
            id: worker.id,
            name: worker.name,
            rating: worker.rating,
            skills: worker.skills,
            avatar: worker.avatar,
            avatarColor: worker.avatarColor,
          }
        : null,
      milestones: milestones.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        budget: m.budget,
        status: m.status,
        deliverable: m.deliverable,
      })),
      focusMilestone: focus || null,
      dispute: dispute
        ? {
            id: dispute.id,
            reason: dispute.reason,
            raisedByName: dispute.raisedByName,
            againstName: dispute.againstName,
            amount: dispute.amount,
            status: dispute.status,
          }
        : null,
      offers: ar.offers || [],
      agreedAmount: ar.agreedAmount,
    };
  }

  /** Records an offer or counter-offer. Either side may open or counter. */
  addOffer(id: string, dto: CreateOfferDto) {
    const ar = this.findById(id);
    this.assertNegotiable(ar);

    // A new offer supersedes any outstanding one.
    (ar.offers || []).forEach((o: any) => {
      if (o.status === 'pending') o.status = 'countered';
    });

    const offer = {
      id: 'of_' + Date.now() + '_' + ((ar.offers?.length || 0) + 1),
      offeredBy: dto.offeredBy,
      amount: dto.amount,
      note: dto.note || '',
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    ar.offers = [...(ar.offers || []), offer];
    ar.status = AUDIT_STATUS.NEGOTIATING;
    return this.auditRequestsRepository.update(id, ar);
  }

  /** Accepts an outstanding offer, fixing the fee. The other side must accept. */
  acceptOffer(id: string, offerId: string, acceptedBy: string) {
    const ar = this.findById(id);
    this.assertNegotiable(ar);

    const offer = (ar.offers || []).find((o: any) => o.id === offerId);
    if (!offer)
      throw new NotFoundException(
        `Offer "${offerId}" not found on this audit request.`,
      );
    if (offer.status !== 'pending') {
      throw new BadRequestException(
        `That offer is no longer open (status: ${offer.status}).`,
      );
    }
    if (offer.offeredBy === acceptedBy) {
      throw new BadRequestException(
        'You cannot accept your own offer — wait for the other side.',
      );
    }

    offer.status = 'accepted';
    ar.agreedAmount = offer.amount;
    ar.status = AUDIT_STATUS.AGREED;
    return this.auditRequestsRepository.update(id, ar);
  }

  /** Client moves the agreed fee into escrow. Nothing can start before this. */
  fund(id: string) {
    const ar = this.findById(id);
    if (ar.status !== AUDIT_STATUS.AGREED) {
      throw new BadRequestException(
        `Escrow can only be funded once a fee is agreed (current status: ${ar.status}).`,
      );
    }
    if (!ar.agreedAmount)
      throw new BadRequestException('No agreed amount to fund.');

    this.ledger.fundAuditEscrow(
      ar.taskId,
      ar.clientId,
      ar.agreedAmount,
      'technical audit',
    );
    ar.status = AUDIT_STATUS.ESCROW_FUNDED;
    return this.auditRequestsRepository.update(id, ar);
  }

  /**
   * Expert takes the engagement. For a project audit this is what releases the
   * project from draft — the client's project only goes live once an expert has
   * committed and the fee is in escrow.
   */
  accept(id: string, dto: { expertId: string }) {
    const ar = this.findById(id);
    if (ar.status !== AUDIT_STATUS.ESCROW_FUNDED) {
      throw new BadRequestException(
        `An audit can only be accepted once its fee is in escrow (current status: ${ar.status}).`,
      );
    }
    // The payee must be an eligible reviewer for this project's category.
    this.assertAssignableExpert(dto.expertId, ar.category);
    // The reviewer accepting must be the one the client assigned.
    if (ar.expertId && ar.expertId !== dto.expertId) {
      throw new BadRequestException(
        'This audit is assigned to a different Expert Reviewer.',
      );
    }

    ar.expertId = dto.expertId;
    ar.status = AUDIT_STATUS.IN_PROGRESS;
    this.auditRequestsRepository.update(id, ar);

    if (ar.kind === AUDIT_KIND.PROJECT) {
      this.safe(() => this.tasks.publishDraft(ar.taskId));
    }
    return this.auditRequestsRepository.findById(id);
  }

  /**
   * The reviewer withdraws. If the client had already funded the fee and it
   * was never paid out, it goes back to the client in the same unit of work —
   * otherwise it would sit in audit escrow with no engagement to release it.
   * The client can then choose another reviewer.
   */
  decline(id: string, dto: DeclineAuditDto) {
    const ar = this.findById(id);
    if (TERMINAL.includes(ar.status)) {
      throw new BadRequestException(`This audit is already ${ar.status}.`);
    }
    const fundedStatuses: string[] = [
      AUDIT_STATUS.ESCROW_FUNDED,
      AUDIT_STATUS.IN_PROGRESS,
      AUDIT_STATUS.REPORT_SUBMITTED,
    ];
    const funded = fundedStatuses.includes(ar.status);
    return this.uow.run([AuditRequestsRepository, ...SETTLEMENT_STORES], () => {
      if (funded && !ar.feePaid && ar.agreedAmount) {
        this.ledger.refundAuditEscrow({
          taskId: ar.taskId,
          clientId: ar.clientId,
          amount: ar.agreedAmount,
          reason: 'Reviewer declined the audit',
        });
      }
      return this.auditRequestsRepository.update(id, {
        status: AUDIT_STATUS.DECLINED,
        declineReason: dto.reason || undefined,
        // Release the assignment so the client can pick someone else.
        declinedBy: ar.expertId ?? undefined,
        expertId: null,
      } as Partial<AuditRequestRecord>);
    });
  }

  /**
   * Called by AuditReportsService once a report is filed. Pays the expert and
   * moves the engagement on.
   *
   * The fee is agreed once for the whole project audit and is released once,
   * when the audit is actually finished — every milestone on the task has a
   * report. Until then it stays in escrow.
   *
   * Before this, the first report both paid the expert in full and closed the
   * engagement, so a four-milestone project showed a finished audit after one
   * milestone and held nothing against the three still unreviewed.
   */
  settle(id: string, milestoneId?: string) {
    const ar = this.auditRequestsRepository.findById(id);
    if (!ar)
      throw new NotFoundException(`Audit request with id "${id}" not found`);

    const fileable = [
      AUDIT_STATUS.IN_PROGRESS,
      AUDIT_STATUS.REPORT_SUBMITTED,
      // A paid engagement is still open for the milestones it has not covered.
      AUDIT_STATUS.PAID,
    ];
    if (!fileable.includes(ar.status as any)) {
      throw new BadRequestException(
        `A report can only be filed against an audit in progress (current status: ${ar.status}).`,
      );
    }

    // Record coverage before deciding whether the engagement is finished.
    this.recordMilestoneAudited(id, milestoneId);
    const fresh = this.auditRequestsRepository.findById(id);
    if (!fresh)
      throw new NotFoundException(`Audit request with id "${id}" not found`);

    const progress = this.auditProgress(fresh);
    // A dispute audit covers the one claim it was raised for, so it finishes
    // with its report. A project audit finishes only when nothing is left.
    const finished =
      fresh.kind !== AUDIT_KIND.PROJECT || !progress || progress.complete;

    if (!finished) {
      // The fee stays in escrow. It buys the whole project audit, so paying it
      // out after the first of four reports would leave the client with nothing
      // held while three milestones were still unreviewed.
      this.auditRequestsRepository.update(id, {
        ...fresh,
        status: AUDIT_STATUS.IN_PROGRESS,
      });
      return {
        auditRequest: this.withProgress(
          this.auditRequestsRepository.findById(id),
        ),
        payout: {
          pending: true,
          reason:
            'The audit fee is released once every milestone has a report.',
          audited: progress.audited,
          total: progress.total,
          remaining: progress.pendingMilestoneIds,
        },
      };
    }

    if (!fresh.expertId || fresh.agreedAmount === null)
      throw new BadRequestException(
        'Audit payout requires an assigned reviewer and agreed fee.',
      );
    const expertId = fresh.expertId;
    const firstPayout = !fresh.feePaid;
    const payout = this.ledger.releaseAuditFee({
      auditRequestId: fresh.id,
      taskId: fresh.taskId,
      expertId: fresh.expertId,
      amount: fresh.agreedAmount,
    });
    fresh.feePaid = true;
    fresh.paidAt = fresh.paidAt || new Date().toISOString().slice(0, 10);
    fresh.status = AUDIT_STATUS.PAID;
    this.auditRequestsRepository.update(id, fresh);

    // Credit the expert's review count — once per engagement, not per report.
    if (firstPayout) {
      this.safe(() => {
        const expert = this.users.findById(expertId);
        this.users.update(expertId, {
          reviewsDone: (expert?.reviewsDone || 0) + 1,
        });
      });
    }

    return {
      auditRequest: this.withProgress(
        this.auditRequestsRepository.findById(id),
      ),
      payout,
    };
  }

  // ── Per-milestone audit progress ──────────────────────────────────────────

  /**
   * How far through the project this engagement is.
   *
   * The engagement is priced and paid once for the whole project, but the work
   * is done milestone by milestone. Filing the first report used to end the
   * engagement, which showed the client and the reviewer a "Completed" audit
   * while later milestones had never been looked at. Completion is now a fact
   * about coverage: every milestone on the task has a report.
   */
  auditProgress(ar: any) {
    if (!ar || ar.kind !== AUDIT_KIND.PROJECT) return null;
    const milestones = ar.taskId
      ? this.safe(() => this.milestones.findAll({ taskId: ar.taskId })) || []
      : [];
    const audited: string[] = ar.auditedMilestoneIds || [];

    const auditedIds = milestones
      .filter((m: any) => audited.includes(m.id))
      .map((m: any) => m.id);
    const pending = milestones.filter((m: any) => !audited.includes(m.id));
    // Submitted and waiting on the reviewer, versus not yet handed over at all.
    const awaitingReview = pending.filter((m: any) =>
      ['submitted', 'review', 'disputed'].includes(m.status),
    );

    return {
      total: milestones.length,
      audited: auditedIds.length,
      auditedMilestoneIds: auditedIds,
      awaitingReview: awaitingReview.length,
      awaitingReviewMilestoneIds: awaitingReview.map((m: any) => m.id),
      pendingMilestoneIds: pending.map((m: any) => m.id),
      // No milestones means nothing left to audit, rather than never finished —
      // otherwise the fee could never be released.
      complete: pending.length === 0,
    };
  }

  /** Read shape: the stored row plus its computed coverage. */
  private withProgress(ar: any) {
    if (!ar) return ar;
    const progress = this.auditProgress(ar);
    return progress ? { ...ar, auditProgress: progress } : ar;
  }

  /** True once a report has been filed for this milestone under this engagement. */
  isMilestoneAudited(ar: any, milestoneId?: string): boolean {
    if (!ar || !milestoneId) return false;
    return (ar.auditedMilestoneIds || []).includes(milestoneId);
  }

  /**
   * Records that a milestone has been reported on. Called when a report is
   * filed; idempotent, so re-filing the same report does not double-count.
   */
  recordMilestoneAudited(id: string, milestoneId?: string) {
    if (!milestoneId) return null;
    const ar = this.auditRequestsRepository.findById(id);
    if (!ar) return null;
    const audited: string[] = ar.auditedMilestoneIds || [];
    if (!audited.includes(milestoneId)) {
      ar.auditedMilestoneIds = [...audited, milestoneId];
      this.auditRequestsRepository.update(id, ar);
    }
    return this.auditRequestsRepository.findById(id);
  }

  /**
   * The live project audit for a task, if there is one. An engagement stays
   * live after it has been paid while milestones remain unaudited — the fee
   * covers the project, not the first milestone that happens to arrive.
   */
  activeProjectAudit(taskId: string) {
    const candidates = this.auditRequestsRepository
      .findAll({ taskId, kind: AUDIT_KIND.PROJECT })
      .filter(
        (a: any) =>
          ![AUDIT_STATUS.DECLINED, AUDIT_STATUS.CANCELLED].includes(a.status),
      );
    // An engagement an expert has actually taken on comes first.
    return (
      candidates.find(
        (a: any) => a.expertId && !this.auditProgress(a)?.complete,
      ) ||
      candidates.find((a: any) => a.expertId) ||
      null
    );
  }

  /**
   * A reviewer must exist, be an expert, and be active. When a category is
   * given, their domains must cover it — the client only ever sees
   * domain-matched reviewers, so a mismatch means a tampered request.
   */
  assertAssignableExpert(expertId: string, category?: string) {
    const expert = this.safe(() => this.users.findById(expertId));
    if (!expert)
      throw new BadRequestException(`No user found with id "${expertId}".`);
    if (expert.role !== 'expert')
      throw new BadRequestException(
        `${expert.name} is not an Expert Reviewer.`,
      );
    if (expert.status !== 'active')
      throw new BadRequestException(`${expert.name}'s account is not active.`);
    if (
      category &&
      Array.isArray(expert.domains) &&
      expert.domains.length &&
      !expert.domains.includes(category)
    ) {
      throw new BadRequestException(
        `${expert.name} does not review ${category} work.`,
      );
    }
    return expert;
  }

  private assertNegotiable(ar: any) {
    if (!NEGOTIABLE.includes(ar.status)) {
      throw new BadRequestException(
        `Offers can only be exchanged while negotiating (current status: ${ar.status}).`,
      );
    }
  }

  /** Cross-module reads are best-effort — a missing task must not break a preview. */
  private safe<T>(fn: () => T): T | null {
    try {
      return fn();
    } catch {
      return null;
    }
  }

  // ── Actor-checked operations (HTTP) ──────────────────────────────────────
  //
  // The methods above are the transitions; these decide who may trigger them.
  // The client side of an engagement is the project's client, the expert side
  // is the assigned reviewer. Operations cannot act for either.

  /** Which side of the engagement the actor is on, if any. */
  private sideOf(ar: any, actor: Actor): 'client' | 'expert' | null {
    if (actor.id === ar.clientId) return 'client';
    if (ar.expertId && actor.id === ar.expertId) return 'expert';
    return null;
  }

  private requireSide(ar: any, actor: Actor): 'client' | 'expert' {
    const side = this.sideOf(ar, actor);
    if (!side)
      throw new ForbiddenException(
        "Only the project's client and the assigned reviewer can act on this audit.",
      );
    return side;
  }

  /** A client opens a technical audit on their own project. Dispute audits are opened by disputes. */
  createFor(dto: CreateAuditRequestDto, actor: Actor) {
    const task = this.tasks.findById(dto.taskId);
    if (task.clientId !== actor.id) {
      throw new ForbiddenException(
        'Only the client who owns this project can request an audit of it.',
      );
    }
    if (dto.clientId && dto.clientId !== actor.id) {
      throw new BadRequestException('clientId must be your own account.');
    }
    const active = this.auditRequestsRepository
      .findAll({ taskId: task.id, kind: AUDIT_KIND.PROJECT })
      .find((a) => !TERMINAL.includes(a.status));
    if (active) {
      throw new ConflictException(
        'This project already has an active technical audit. A new reviewer can be chosen once it is declined or cancelled.',
      );
    }
    if (dto.kind && dto.kind !== AUDIT_KIND.PROJECT) {
      throw new BadRequestException(
        'Dispute audits are opened by raising a dispute.',
      );
    }
    return this.create({
      ...dto,
      kind: AUDIT_KIND.PROJECT,
      clientId: actor.id,
      status: undefined,
      disputeId: undefined,
      workerId: task.workerId || undefined,
      category: task.category,
    });
  }

  addOfferFor(id: string, dto: CreateOfferDto, actor: Actor) {
    const side = this.requireSide(this.findById(id), actor);
    if (dto.offeredBy && dto.offeredBy !== side) {
      throw new BadRequestException(
        `You are the ${side} on this audit; offeredBy must be "${side}".`,
      );
    }
    return this.addOffer(id, { ...dto, offeredBy: side });
  }

  acceptOfferFor(id: string, offerId: string, actor: Actor) {
    const side = this.requireSide(this.findById(id), actor);
    return this.acceptOffer(id, offerId, side);
  }

  /** The project's client pays the agreed fee into audit escrow. */
  fundFor(id: string, actor: Actor) {
    const ar = this.findById(id);
    if (actor.id !== ar.clientId) {
      throw new ForbiddenException(
        "Only the project's client can fund this audit.",
      );
    }
    return this.uow.run([AuditRequestsRepository, ...SETTLEMENT_STORES], () =>
      this.fund(id),
    );
  }

  /**
   * The reviewer takes the engagement. The payee is the actor: an engagement
   * assigned to someone else cannot be taken, and an unassigned one is taken
   * only by an eligible reviewer.
   */
  acceptFor(id: string, dto: AcceptAuditDto, actor: Actor) {
    const ar = this.findById(id);
    if (dto.expertId && dto.expertId !== actor.id) {
      throw new BadRequestException('expertId must be your own account.');
    }
    if (ar.expertId && ar.expertId !== actor.id) {
      throw new ForbiddenException(
        'This audit is assigned to a different Expert Reviewer.',
      );
    }
    return this.uow.run([AuditRequestsRepository, TasksRepository], () =>
      this.accept(id, { expertId: actor.id }),
    );
  }

  declineFor(id: string, dto: DeclineAuditDto, actor: Actor) {
    const ar = this.findById(id);
    if (!ar.expertId || ar.expertId !== actor.id) {
      throw new ForbiddenException(
        'Only the assigned reviewer can decline this audit.',
      );
    }
    return this.decline(id, dto);
  }

  /**
   * Either side edits descriptive fields. The reviewer, the covered
   * milestone, the parties and the fee change only through their own steps.
   */
  updateFor(id: string, dto: UpdateAuditRequestDto, actor: Actor) {
    const ar = this.findById(id);
    this.requireSide(ar, actor);
    const editable = ['severity', 'dueDate', 'project', 'milestone', 'worker'];
    const locked = Object.keys(dto).filter(
      (field) => !editable.includes(field),
    );
    const changes = stripUnchangedProtectedFields(
      dto,
      ar,
      locked,
      (field) => `"${field}" cannot be changed by editing the audit.`,
    );
    return this.update(id, changes as UpdateAuditRequestDto);
  }

  resetToSeed() {
    this.auditRequestsRepository.resetToSeed();
  }
}
