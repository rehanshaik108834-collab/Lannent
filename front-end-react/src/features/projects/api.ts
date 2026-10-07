import { api } from '../../shared/api/client';
import type { Milestone, Project } from '../../shared/types/domain';

/** Wire adapters for projects (`/tasks` on the API). No UI state lives here. */

export interface ProjectFilters {
  clientId?: string;
  workerId?: string;
  status?: string;
}

export interface NewMilestone {
  title: string;
  description?: string;
  budget: number;
  dueDate?: string;
}

export interface NewProject {
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline?: string;
  skills: string[];
  milestones: NewMilestone[];
  /** Technical audit: the project stays a draft until this reviewer accepts and the fee is funded. */
  auditEnabled?: boolean;
  auditExpertId?: string;
  /** Opening offer for the audit fee, INR. */
  auditFee?: number;
}

export interface Escrow {
  projectHeld: number;
  auditHeld: number;
}

function query(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const listProjects = (filters: ProjectFilters = {}) =>
  api.request<Project[]>(`/tasks${query(filters)}`);

export const getProject = (id: string) =>
  api.request<Project>(`/tasks/${encodeURIComponent(id)}`);

export const getEscrow = (id: string) =>
  api.request<Escrow>(`/ledger/escrow/${encodeURIComponent(id)}`);

export const updateProject = (
  id: string,
  changes: Partial<
    Pick<
      Project,
      'title' | 'description' | 'category' | 'deadline' | 'skills' | 'budget'
    >
  >,
) =>
  api.request<Project>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
  });

export const deleteProject = (id: string) =>
  api.request<{ deleted: boolean; refunded: number }>(
    `/tasks/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );

/**
 * Creates a project and its initial milestones in one server operation. The
 * server checks that milestone budgets add up to the project budget and
 * creates nothing if any part is refused.
 */
export const createProject = (input: NewProject) =>
  api.request<Project & { milestones: Milestone[] }>('/tasks', {
    method: 'POST',
    body: { ...input, currency: 'INR' },
  });

/** Either party asks to end the contract. Returns the blockers, or the recorded settlement. */
export const requestTermination = (id: string, reason: string) =>
  api.request<import('../../shared/types/domain').TerminationResult>(
    `/tasks/${encodeURIComponent(id)}/termination`,
    { method: 'POST', body: { reason } },
  );

/** Abandons a draft project; any audit escrow still held returns to the client. */
export const cancelDraft = (id: string) =>
  api.request<{ task: Project; refund: { amount: number } | null }>(
    `/tasks/${encodeURIComponent(id)}/cancel-draft`,
    { method: 'POST' },
  );
