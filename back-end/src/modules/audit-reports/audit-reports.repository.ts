import type { AuditReportRecord } from './audit-reports.types';
import { Injectable } from '@nestjs/common';
import { SEED_AUDIT_REPORTS } from '../seed/seed.data';

/**
 * AuditReportsRepository — In-Memory Data Access Layer
 *
 * Manages the AUDIT_REPORTS array and provides low-level CRUD operations.
 * Business logic (upsert, status updates) belongs in AuditReportsService.
 */
@Injectable()
export class AuditReportsRepository {
  private reports: AuditReportRecord[] = structuredClone(SEED_AUDIT_REPORTS);
  private counter = 100;

  generateId(): string {
    return 'rep_' + Date.now() + '_' + this.counter++;
  }

  findAll(query?: {
    taskId?: string;
    auditRequestId?: string;
  }): AuditReportRecord[] {
    let result = this.reports;
    if (query?.taskId) result = result.filter((r) => r.taskId === query.taskId);
    if (query?.auditRequestId)
      result = result.filter((r) => r.auditRequestId === query.auditRequestId);
    return result;
  }

  findById(id: string): AuditReportRecord | null {
    return this.reports.find((r) => r.id === id) || null;
  }

  /**
   * A report belongs to one milestone of one engagement.
   *
   * This used to match on the engagement alone, which was fine when an audit
   * meant a single report. Now that one engagement covers every milestone on
   * the project, matching that way made each new report overwrite the last —
   * four milestones audited, one row left.
   */
  findByEngagementAndMilestone(
    auditRequestId: string,
    milestoneId?: string | null,
  ): AuditReportRecord | null {
    return (
      this.reports.find(
        (r) =>
          r.auditRequestId === auditRequestId &&
          (r.milestoneId ?? null) === (milestoneId ?? null),
      ) || null
    );
  }

  insert(report: AuditReportRecord): AuditReportRecord {
    this.reports.push(report);
    return report;
  }

  updateByEngagementAndMilestone(
    auditRequestId: string,
    milestoneId: string | null | undefined,
    partial: Partial<AuditReportRecord>,
  ): AuditReportRecord | null {
    const idx = this.reports.findIndex(
      (r) =>
        r.auditRequestId === auditRequestId &&
        (r.milestoneId ?? null) === (milestoneId ?? null),
    );
    if (idx === -1) return null;
    this.reports[idx] = { ...this.reports[idx], ...partial };
    return this.reports[idx];
  }

  resetToSeed(): void {
    this.reports = structuredClone(SEED_AUDIT_REPORTS);
  }
}
