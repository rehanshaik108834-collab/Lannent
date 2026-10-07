import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { afterSettlement, keys } from '../../shared/api/keys';
import {
  acceptEngagement,
  acceptOffer,
  declineEngagement,
  fileReport,
  fundEngagement,
  getEngagement,
  getPreview,
  getReport,
  listEngagements,
  listReports,
  makeOffer,
  requestAudit,
} from './api';

export function useEngagements(
  filters: { taskId?: string; kind?: string } = {},
) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.audits(actor.id, filters),
    queryFn: () => listEngagements(filters),
  });
}

export function useEngagement(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.audit(actor.id, id ?? ''),
    queryFn: () => getEngagement(id!),
    enabled: !!id,
  });
}

export function usePreview(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.auditPreview(actor.id, id ?? ''),
    queryFn: () => getPreview(id!),
    enabled: !!id,
  });
}

export function useReports(
  filters: { taskId?: string; auditRequestId?: string } = {},
) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.reports(actor.id, filters),
    queryFn: () => listReports(filters),
  });
}

export function useReport(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.report(actor.id, id ?? ''),
    queryFn: () => getReport(id!),
    enabled: !!id,
  });
}

const negotiation = ['audits', 'audit', 'auditPreview'];

export function useMakeOffer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      amount,
      note,
    }: {
      id: string;
      amount: number;
      note: string;
    }) => makeOffer(id, amount, note),
    onSuccess: () => invalidate(negotiation),
  });
}

export function useAcceptOffer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, offerId }: { id: string; offerId: string }) =>
      acceptOffer(id, offerId),
    onSuccess: () => invalidate(negotiation),
  });
}

/** Funding moves money from the client's wallet into audit escrow. */
export function useFundEngagement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fundEngagement,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useAcceptEngagement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: acceptEngagement,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useDeclineEngagement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      declineEngagement(id, reason),
    onSuccess: () => invalidate(negotiation),
  });
}

/** Filing can release the reviewer's fee; refresh everything that shows money or coverage. */
export function useFileReport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fileReport,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useRequestAudit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: requestAudit,
    onSuccess: () => invalidate(['audits', 'audit', 'projects']),
  });
}
