import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { keys } from '../../shared/api/keys';
import { listMessages, sendMessage } from './api';

export function useMessages(filters: { taskId?: string } = {}) {
  const actor = useActor();
  return useQuery({
    queryKey: keys.messages(actor.id, filters),
    queryFn: () => listMessages(filters),
  });
}

export function useSendMessage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => invalidate(['messages']),
  });
}
