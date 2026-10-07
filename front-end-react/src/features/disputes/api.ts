import { api } from '../../shared/api/client';
import type { Dispute, DisputeVerdict } from '../../shared/types/domain';

/** Wire adapters for disputes. The raiser and the reviewer are always the signed-in account. */

export const listDisputes = () => api.request<Dispute[]>('/disputes');
export const getDispute = (id: string) =>
  api.request<Dispute>(`/disputes/${encodeURIComponent(id)}`);

/** A project party disputes one of its milestones and names an eligible reviewer. */
export const raiseDispute = (input: {
  taskId: string;
  milestoneId: string;
  reason: string;
  expertId: string;
}) => api.request<Dispute>('/disputes', { method: 'POST', body: input });

/** The assigned reviewer's verdict; settles the milestone atomically on the server. */
export const resolveDispute = (
  id: string,
  verdict: DisputeVerdict,
  resolution: string,
) =>
  api.request<Dispute & { replayed: boolean }>(
    `/disputes/${encodeURIComponent(id)}/resolve`,
    {
      method: 'POST',
      body: { verdict, resolution },
    },
  );
