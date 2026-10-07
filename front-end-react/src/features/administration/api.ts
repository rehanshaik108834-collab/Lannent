import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
export function useStaffData<T>(path: string, enabled = true) {
  const actor = useActor();
  return useQuery({
    queryKey: ['staff', actor.id, path],
    queryFn: () => api.request<T>(path),
    enabled,
  });
}
export type FeeConfig = {
  deposit: { percent: number; fixed: number };
  clientMarketplace: { percent: number };
  expertService: { percent: number };
  withdrawal: { percent: number; fixed: number; min: number };
  workerService: { upTo: number | null; percent: number }[];
  contractInitiation: { upTo: number | null; fee: number }[];
};
export type Summary = {
  totalRevenue: number;
  grossVolume: number;
  takeRate: number;
  escrowHeld: number;
  activeContracts: number;
  feeEvents: number;
};
export type AuditEvent = {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: string | null;
  requestId: string | null;
  kind: string;
  outcome: string;
  detail: Record<string, unknown> | null;
};
export const exportAudit = (query: string) =>
  api.download(
    `/audit-log/export${query}`,
    `lannent-audit-${new Date().toISOString().slice(0, 10)}.csv`,
  );
