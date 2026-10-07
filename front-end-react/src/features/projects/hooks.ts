import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { afterSettlement, keys } from '../../shared/api/keys';
import {
  cancelDraft,
  createProject,
  deleteProject,
  getEscrow,
  getProject,
  listProjects,
  requestTermination,
  updateProject,
  type ProjectFilters,
} from './api';

export function useProjects(filters: ProjectFilters = {}) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.projects(actor.id, filters),
    queryFn: () => listProjects(filters),
  });
}

export function useProject(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.project(actor.id, id ?? ''),
    queryFn: () => getProject(id!),
    enabled: !!id,
  });
}

export function useEscrow(id: string | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.escrow(actor.id, id ?? ''),
    queryFn: () => getEscrow(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => invalidate(['projects', 'milestones']),
  });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (changes: Parameters<typeof updateProject>[1]) =>
      updateProject(id, changes),
    onSuccess: () => invalidate(['projects', 'project']),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => invalidate(['projects', 'proposals']),
  });
}

/** Ending a contract can refund escrow and cancel milestones once nothing blocks it. */
export function useRequestTermination() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestTermination(id, reason),
    onSuccess: () => invalidate(afterSettlement),
  });
}

export function useCancelDraft() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: cancelDraft,
    onSuccess: () => invalidate(afterSettlement),
  });
}
