import { api } from '../../shared/api/client';
import type {
  AuditEngagement,
  AuditPreview,
  AuditReport,
  ReportPayout,
} from '../../shared/types/domain';

/**
 * Wire adapters for expert engagements and their reports. The client side of
 * an engagement is the project's client; the expert side is the assigned
 * reviewer. The server derives which side the signed-in account is on.
 */

const path = (id: string) => `/audit-requests/${encodeURIComponent(id)}`;

export function listEngagements(
  filters: { taskId?: string; kind?: string } = {},
) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  );
  const text = params.toString();
  return api.request<AuditEngagement[]>(
    `/audit-requests${text ? `?${text}` : ''}`,
  );
}

export const getEngagement = (id: string) =>
  api.request<AuditEngagement>(path(id));
export const getPreview = (id: string) =>
  api.request<AuditPreview>(`${path(id)}/preview`);

export const makeOffer = (id: string, amount: number, note: string) =>
  api.request<AuditEngagement>(`${path(id)}/offers`, {
    method: 'POST',
    body: { amount, note },
  });

export const acceptOffer = (id: string, offerId: string) =>
  api.request<AuditEngagement>(
    `${path(id)}/offers/${encodeURIComponent(offerId)}/accept`,
    { method: 'POST' },
  );

/** Client moves the agreed fee into audit escrow. */
export const fundEngagement = (id: string) =>
  api.request<AuditEngagement>(`${path(id)}/fund`, { method: 'POST' });

/** Reviewer takes a funded engagement; for a project audit this publishes the draft project. */
export const acceptEngagement = (id: string) =>
  api.request<AuditEngagement>(`${path(id)}/accept`, {
    method: 'POST',
    body: {},
  });

export const declineEngagement = (id: string, reason: string) =>
  api.request<AuditEngagement>(`${path(id)}/decline`, {
    method: 'POST',
    body: { reason },
  });

export function listReports(
  filters: { taskId?: string; auditRequestId?: string } = {},
) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  );
  const text = params.toString();
  return api.request<AuditReport[]>(`/audit-reports${text ? `?${text}` : ''}`);
}

export const getReport = (id: string) =>
  api.request<AuditReport>(`/audit-reports/${encodeURIComponent(id)}`);

export interface ReportInput {
  auditRequestId: string;
  taskId: string;
  milestoneId?: string;
  verdict: 'pass' | 'conditional' | 'fail';
  overall: string;
  findings?: string;
  codequality?: number;
  security?: number;
  performance?: number;
  documentation?: number;
  milestoneTitle?: string;
  projectTitle?: string;
}

/** Files (or re-files) the reviewer's report for one milestone. May release the audit fee. */
export const fileReport = (input: ReportInput) =>
  api.request<AuditReport & { payout: ReportPayout }>('/audit-reports', {
    method: 'POST',
    body: input,
  });

/** Client opens a technical audit with another reviewer (e.g. after a decline). */
export const requestAudit = (input: {
  taskId: string;
  expertId: string;
  openingOffer: number;
}) =>
  api.request<AuditEngagement>('/audit-requests', {
    method: 'POST',
    body: input,
  });
