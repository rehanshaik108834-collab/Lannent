import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
import { QueryView, EmptyState, Notice } from '../../shared/ui/ui';
import styles from './notifications.module.css';
type Notification = {
  id: string;
  text: string;
  subtext: string;
  read: boolean;
  createdAt: string;
};
export function Notifications() {
  const actor = useActor();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['notifications', actor.id],
    queryFn: () => api.request<Notification[]>('/notifications'),
    refetchInterval: 30_000,
  });
  const mark = useMutation({
    mutationFn: () =>
      api.request(`/notifications/${actor.id}/read-all`, { method: 'PATCH' }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['notifications', actor.id] });
    },
  });
  return (
    <div className={styles.wrapper}>
      <button
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => {
          setOpen(!open);
          if (!open) void query.refetch();
        }}
      >
        Notifications{' '}
        {query.data?.some((row) => !row.read)
          ? `(${query.data.filter((row) => !row.read).length})`
          : ''}
      </button>
      {open && (
        <section
          className={styles.panel}
          id="notifications-panel"
          aria-label="Notifications"
        >
          <h2>Notifications</h2>
          <QueryView query={query}>
            {(rows) => (
              <>
                {!rows.length ? (
                  <EmptyState title="No notifications" />
                ) : (
                  <ul>
                    {rows.map((row) => (
                      <li key={row.id}>
                        <strong>{row.text}</strong>
                        {!row.read && <span> · New</span>}
                        <p>{row.subtext}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  disabled={mark.isPending || !rows.some((row) => !row.read)}
                  onClick={() => mark.mutate()}
                >
                  Mark all read
                </button>
              </>
            )}
          </QueryView>
          <Notice error={mark.error} />
          <button onClick={() => setOpen(false)}>Close notifications</button>
        </section>
      )}
    </div>
  );
}
