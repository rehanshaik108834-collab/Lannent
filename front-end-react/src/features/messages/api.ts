import { api } from '../../shared/api/client';
import type { Message } from '../../shared/types/domain';

/** Wire adapters for project conversations. The sender is the signed-in account. */

export function listMessages(filters: { taskId?: string } = {}) {
  return api.request<Message[]>(
    `/messages${filters.taskId ? `?taskId=${encodeURIComponent(filters.taskId)}` : ''}`,
  );
}

export const sendMessage = (input: {
  taskId: string;
  receiverId: string;
  content: string;
}) => api.request<Message>('/messages', { method: 'POST', body: input });
