import { api } from '../../shared/api/client';
import type { Proposal } from '../../shared/types/domain';

/** Wire adapters for proposals and invitations. The author is always the signed-in account. */

export interface ProposalFilters {
  taskId?: string;
  workerId?: string;
  type?: 'proposal' | 'invitation';
}

const path = (id: string) => `/proposals/${encodeURIComponent(id)}`;

export function listProposals(filters: ProposalFilters = {}) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  );
  const text = params.toString();
  return api.request<Proposal[]>(`/proposals${text ? `?${text}` : ''}`);
}

/** Worker proposal: bid, timeline and cover letter. Profile details come from the account. */
export const submitProposal = (input: {
  taskId: string;
  bidPrice: string;
  timeline: string;
  coverLetter: string;
}) =>
  api.request<Proposal>('/proposals', {
    method: 'POST',
    body: { ...input, type: 'proposal' },
  });

/** Client invitation of a worker to an open project the client owns. */
export const inviteWorker = (input: {
  taskId: string;
  workerId: string;
  coverLetter?: string;
}) =>
  api.request<Proposal>('/proposals', {
    method: 'POST',
    body: { ...input, type: 'invitation' },
  });

export const closeProposal = (id: string, status: 'withdrawn' | 'rejected') =>
  api.request<Proposal>(path(id), { method: 'PATCH', body: { status } });

/** Client hires: funds escrow from the client's wallet and assigns the worker. */
export const hireProposal = (id: string) =>
  api.request<Proposal>(`${path(id)}/hire`, { method: 'POST' });

/** Invited worker accepts: escrow is funded from the client's wallet at this point. */
export const acceptInvitation = (id: string) =>
  api.request<Proposal>(`${path(id)}/accept`, { method: 'POST' });

export const declineInvitation = (id: string) =>
  api.request<Proposal>(`${path(id)}/decline`, { method: 'POST' });
