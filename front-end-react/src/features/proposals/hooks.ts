import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { afterSettlement, keys } from '../../shared/api/keys';
import {
  acceptInvitation,
  closeProposal,
  declineInvitation,
  hireProposal,
  inviteWorker,
  listProposals,
  submitProposal,
  type ProposalFilters,
} from './api';

export function useProposals(filters: ProposalFilters = {}) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.proposals(actor.id, filters),
    queryFn: () => listProposals(filters),
  });
}

export function useSubmitProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: submitProposal,
    onSuccess: () => invalidate(['proposals']),
  });
}

export function useInviteWorker() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: inviteWorker,
    onSuccess: () => invalidate(['proposals']),
  });
}

export function useCloseProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'withdrawn' | 'rejected';
    }) => closeProposal(id, status),
    onSuccess: () => invalidate(['proposals']),
  });
}

/** Hiring and accepting fund escrow, assign the worker and close other proposals. */
export function useHire() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: hireProposal,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useAcceptInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useDeclineInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: declineInvitation,
    onSuccess: () => invalidate(['proposals']),
  });
}
