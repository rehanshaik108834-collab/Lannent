import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { afterSettlement, keys } from '../../shared/api/keys';
import type { DisputeVerdict } from '../../shared/types/domain';
import { getDispute, listDisputes, raiseDispute, resolveDispute } from './api';

export function useDisputes() {
  const actor = useActor();
  return useQuery({ queryKey: keys.disputes(actor.id), queryFn: listDisputes });
}

export function useDispute(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.dispute(actor.id, id ?? ''),
    queryFn: () => getDispute(id!),
    enabled: !!id,
  });
}

/** Raising a dispute freezes the milestone and opens an arbitration engagement. */
export function useRaiseDispute() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: raiseDispute,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useResolveDispute() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      verdict,
      resolution,
    }: {
      id: string;
      verdict: DisputeVerdict;
      resolution: string;
    }) => resolveDispute(id, verdict, resolution),
    onSuccess: () => invalidate(afterSettlement),
  });
}
