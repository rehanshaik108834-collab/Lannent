import { api } from '../../shared/api/client';
import type {
  Deliverable,
  Milestone,
  MilestoneRelease,
} from '../../shared/types/domain';

/** Wire adapters for milestones. Status changes go through named actions. */

const path = (id: string) => `/milestones/${encodeURIComponent(id)}`;

export const listMilestones = (projectId: string) =>
  api.request<Milestone[]>(
    `/milestones?taskId=${encodeURIComponent(projectId)}`,
  );

export const getMilestone = (id: string) => api.request<Milestone>(path(id));

export const createMilestone = (input: {
  taskId: string;
  title: string;
  description?: string;
  budget: number;
  dueDate?: string;
}) => api.request<Milestone>('/milestones', { method: 'POST', body: input });

/** Assigned worker: start work (pending/revision-needed → in-progress) or report progress below 100%. */
export const updateMilestoneProgress = (
  id: string,
  changes: { status?: 'in-progress'; progress?: number },
) => api.request<Milestone>(path(id), { method: 'PATCH', body: changes });

export const submitDeliverable = (id: string, deliverable: Deliverable) =>
  api.request<Milestone>(`${path(id)}/submit`, {
    method: 'POST',
    body: { deliverable },
  });

export const approveMilestone = (id: string) =>
  api.request<Milestone & { release: MilestoneRelease }>(
    `${path(id)}/approve`,
    { method: 'POST' },
  );

export const requestRevision = (id: string, reason: string) =>
  api.request<Milestone>(`${path(id)}/request-revision`, {
    method: 'POST',
    body: { reason },
  });
