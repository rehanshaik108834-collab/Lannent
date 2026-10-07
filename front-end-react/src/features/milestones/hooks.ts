import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { afterSettlement, keys } from '../../shared/api/keys';
import type { Deliverable } from '../../shared/types/domain';
import {
  approveMilestone,
  getMilestone,
  listMilestones,
  requestRevision,
  submitDeliverable,
  updateMilestoneProgress,
} from './api';

export function useMilestones(projectId: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.milestones(actor.id, projectId ?? ''),
    queryFn: () => listMilestones(projectId!),
    enabled: !!projectId,
  });
}

export function useMilestone(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.milestone(actor.id, id ?? ''),
    queryFn: () => getMilestone(id!),
    enabled: !!id,
  });
}

export function useStartOrProgress() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      ...changes
    }: {
      id: string;
      status?: 'in-progress';
      progress?: number;
    }) => updateMilestoneProgress(id, changes),
    onSuccess: () => invalidate(['milestones', 'milestone']),
  });
}

export function useSubmitDeliverable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      deliverable,
    }: {
      id: string;
      deliverable: Deliverable;
    }) => submitDeliverable(id, deliverable),
    onSuccess: () =>
      invalidate(['milestones', 'milestone', 'projects', 'project']),
  });
}

/** Approval releases escrow to the worker; refresh every view that shows money or progress. */
export function useApproveMilestone() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: approveMilestone,
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useRequestRevision() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestRevision(id, reason),
    onSuccess: () => invalidate(['milestones', 'milestone']),
  });
}
