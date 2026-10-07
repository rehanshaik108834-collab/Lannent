import type { AuditRequestRecord } from './audit-requests.types';
import { Injectable } from '@nestjs/common';
import { SEED_AUDIT_REQUESTS } from '../seed/seed.data';

/**
 * AuditRequestsRepository — In-Memory Data Access Layer
 *
 * Manages the AUDIT_REQUESTS array and provides low-level CRUD operations.
 * Business logic belongs in AuditRequestsService.
 */
@Injectable()
export class AuditRequestsRepository {
  private auditRequests: AuditRequestRecord[] =
    structuredClone(SEED_AUDIT_REQUESTS);
  private counter = 100;

  generateId(): string {
    return 'ar_' + Date.now() + '_' + this.counter++;
  }

  findAll(query?: {
    expertId?: string;
    status?: string;
    taskId?: string;
    kind?: string;
  }): AuditRequestRecord[] {
    let result = this.auditRequests;
    if (query?.expertId)
      result = result.filter((a) => a.expertId === query.expertId);
    if (query?.status) result = result.filter((a) => a.status === query.status);
    if (query?.taskId) result = result.filter((a) => a.taskId === query.taskId);
    if (query?.kind) result = result.filter((a) => a.kind === query.kind);
    return result;
  }

  findById(id: string): AuditRequestRecord | null {
    return this.auditRequests.find((a) => a.id === id) || null;
  }

  insert(auditRequest: AuditRequestRecord): AuditRequestRecord {
    this.auditRequests.push(auditRequest);
    return auditRequest;
  }

  update(
    id: string,
    partial: Partial<AuditRequestRecord>,
  ): AuditRequestRecord | null {
    const idx = this.auditRequests.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.auditRequests[idx] = { ...this.auditRequests[idx], ...partial };
    return this.auditRequests[idx];
  }

  resetToSeed(): void {
    this.auditRequests = structuredClone(SEED_AUDIT_REQUESTS);
  }
}
