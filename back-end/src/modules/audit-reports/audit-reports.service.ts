import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateAuditReportDto } from './dto/create-audit-report.dto';
import { AuditReportsRepository } from './audit-reports.repository';
import { AuditRequestsService } from '../audit-requests/audit-requests.service';
import { MilestonesService } from '../milestones/milestones.service';
import { SETTLEMENT_STORES } from '../ledger/settlement-stores';
import { TasksAccessService } from '../tasks/tasks-access.service';
import { canViewTask, canViewAnyRecord } from '../../common/guards/viewer.util';
import { Actor } from '../../common/decorators/current-actor.decorator';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { AUDIT_KIND } from '../audit-requests/audit-request.constants';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * AuditReportsService — Business Logic Layer
 *
 * Handles report creation/upsert and audit-request status updates.
 * Delegates all data-access operations to AuditReportsRepository.
 */
@Injectable()
export class AuditReportsService {
  constructor(
    private readonly notifier: NotificationsService,
    private readonly auditReportsRepository: AuditReportsRepository,
    private auditRequestsService: AuditRequestsService,
    private milestonesService: MilestonesService,
    private tasks: TasksAccessService,
    private readonly uow: UnitOfWork,
  ) {}

  findAll(
    query?: { taskId?: string; auditRequestId?: string },
    viewer?: { id?: string; role?: string },
  ) {
    const all = this.auditReportsRepository.findAll(query);
    if (!viewer || canViewAnyRecord(viewer.role)) return all;
    // A report belongs to the project it audits. It was readable by anyone —
    // this route had no guard at all.
    return all.filter((r: any) => this.canView(r, viewer));
  }

  findById(id: string, viewer?: { id?: string; role?: string }) {
    const report = this.auditReportsRepository.findById(id);
    if (!report)
      throw new NotFoundException(`Audit report with id "${id}" not found`);
    if (viewer && !this.canView(report, viewer)) {
      throw new ForbiddenException(
        'You do not have access to this report. Only the people involved in the project can view it.',
      );
    }
    return report;
  }

  /**
   * A report carries no owner columns, so the parties are resolved by joining
   * to its task and its audit engagement.
   */
  private canView(
    report: any,
    viewer: { id?: string; role?: string },
  ): boolean {
    const task = this.safe(() => this.tasks.findById(report.taskId));
    const engagement = report.auditRequestId
      ? this.safe(() =>
          this.auditRequestsService.findById(report.auditRequestId),
        )
      : null;
    return canViewTask(
      viewer.id,
      viewer.role,
      task,
      report.expertId,
      engagement?.expertId,
      engagement?.clientId,
      engagement?.workerId,
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
   * Files (or re-files) the assigned reviewer's report for one milestone and,
   * when that completes the engagement's coverage, pays the reviewer.
   *
   * A project audit report must name a milestone of the audited project, so
   * another milestone's report can never satisfy the approval gate. A dispute
   * audit report covers the disputed milestone.
   *
   * The report, coverage and payout commit together: a failed payout leaves no
   * report and no coverage behind. Re-filing updates the report and never pays
   * twice.
   */
  create(dto: CreateAuditReportDto, actor: Actor) {
    const engagement = this.auditRequestsService.findById(dto.auditRequestId);
    if (!engagement.expertId || actor.id !== engagement.expertId) {
      throw new ForbiddenException(
        'Only the reviewer assigned to this audit can file its report.',
      );
    }
    if (dto.expertId && dto.expertId !== actor.id) {
      throw new BadRequestException(
        'The expertId sent does not match the signed-in reviewer.',
      );
    }
    if (dto.taskId !== engagement.taskId) {
      throw new BadRequestException(
        'This report names a different project from its audit engagement.',
      );
    }
    const milestoneId = this.reportedMilestone(engagement, dto.milestoneId);
    const fields = { ...dto, expertId: actor.id, milestoneId };

    const filed = this.uow.run(
      [AuditReportsRepository, AuditRequestsRepository, ...SETTLEMENT_STORES],
      () => {
        // Keyed on the milestone as well as the engagement: re-filing a report
        // updates that milestone's report, it does not replace another one.
        const existing =
          this.auditReportsRepository.findByEngagementAndMilestone(
            dto.auditRequestId,
            milestoneId,
          );
        const createdAt = new Date().toISOString().slice(0, 10);
        const report = existing
          ? this.auditReportsRepository.updateByEngagementAndMilestone(
              dto.auditRequestId,
              milestoneId,
              {
                ...fields,
                createdAt,
              },
            )
          : this.auditReportsRepository.insert({
              id: this.auditReportsRepository.generateId(),
              createdAt,
              ...fields,
            });

        // settle() refuses an audit that is not in progress (so a report cannot
        // be filed against an unfunded audit), records this milestone's coverage,
        // and pays once coverage is complete. Its failure rolls everything back.
        const { payout } = this.auditRequestsService.settle(
          dto.auditRequestId,
          milestoneId,
        );

        // Expert reports do not change milestone status — that stays with the client.
        return { ...report, payout };
      },
    );

    const milestone =
      (milestoneId && this.milestonesService.findById(milestoneId)?.title) ||
      engagement.milestone ||
      'Milestone';
    const passed = dto.verdict === 'pass';
    this.notifier.notify(
      engagement.clientId,
      'audit-complete',
      `Audit ${passed ? 'passed' : 'failed'}: ${milestone}`,
      `${engagement.project} · just now`,
    );
    this.notifier.notify(
      engagement.workerId,
      'audit-complete',
      `Your milestone audit result: ${passed ? 'PASS ✓' : 'FAIL ✗'}`,
      `${milestone} · just now`,
    );
    return filed;
  }

  /** The milestone a report covers, validated against its engagement. */
  private reportedMilestone(engagement: any, requested?: string): string {
    if (engagement.kind === AUDIT_KIND.PROJECT) {
      if (!requested) {
        throw new BadRequestException(
          'A project audit report must name the milestone it covers.',
        );
      }
      const ms = this.milestonesService.findById(requested);
      if (ms.taskId !== engagement.taskId) {
        throw new BadRequestException(
          'That milestone does not belong to the audited project.',
        );
      }
      return requested;
    }
    if (
      requested &&
      engagement.milestoneId &&
      requested !== engagement.milestoneId
    ) {
      throw new BadRequestException(
        'A dispute audit report covers only the disputed milestone.',
      );
    }
    return requested || engagement.milestoneId;
  }

  resetToSeed() {
    this.auditReportsRepository.resetToSeed();
  }
}
