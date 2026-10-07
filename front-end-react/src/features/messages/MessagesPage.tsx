import { useMemo, useState } from 'react';
import { useActor } from '../../shared/api/actor';
import type {
  AuditEngagement,
  Message,
  Project,
} from '../../shared/types/domain';
import { Card, EmptyState, PageHeader, QueryView } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useProjects } from '../projects/hooks';
import { useUser } from '../wallets/hooks';
import { MessageThread } from './MessageThread';
import { useMessages } from './hooks';
import { useEngagements } from '../audits/hooks';
import styles from './messages.module.css';

interface Conversation {
  key: string;
  taskId: string;
  counterpartId: string;
  lastAt: string;
}

/** Conversations from existing messages plus active projects you have not messaged about yet. */
function conversations(
  actorId: string,
  messages: Message[],
  projects: Project[],
  engagements: AuditEngagement[] = [],
): Conversation[] {
  const byKey = new Map<string, Conversation>();
  for (const m of messages) {
    const counterpartId = m.senderId === actorId ? m.receiverId : m.senderId;
    const key = `${m.taskId}:${counterpartId}`;
    const existing = byKey.get(key);
    if (!existing || existing.lastAt < m.createdAt)
      byKey.set(key, {
        key,
        taskId: m.taskId,
        counterpartId,
        lastAt: m.createdAt,
      });
  }
  for (const p of projects) {
    const counterpartId =
      p.clientId === actorId
        ? p.workerId
        : p.workerId === actorId
          ? p.clientId
          : null;
    if (!counterpartId) continue;
    const key = `${p.id}:${counterpartId}`;
    if (!byKey.has(key))
      byKey.set(key, { key, taskId: p.id, counterpartId, lastAt: '' });
  }
  // Reviewers talk to the parties of the projects they review, and vice versa.
  for (const e of engagements) {
    const others =
      e.expertId === actorId ? [e.clientId, e.workerId] : [e.expertId];
    for (const counterpartId of others) {
      if (!counterpartId || counterpartId === actorId) continue;
      const key = `${e.taskId}:${counterpartId}`;
      if (!byKey.has(key))
        byKey.set(key, { key, taskId: e.taskId, counterpartId, lastAt: '' });
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function MessagesPage() {
  const actor = useActor();
  const messages = useMessages();
  const projects = useProjects();
  const engagements = useEngagements();
  const [selected, setSelected] = useState<string | null>(null);
  const titles = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p.title])),
    [projects.data],
  );

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Conversations about your projects."
      />
      <QueryView query={messages}>
        {(all) => {
          const list = conversations(
            actor.id,
            all,
            projects.data ?? [],
            engagements.data ?? [],
          );
          if (list.length === 0)
            return <EmptyState title="No conversations yet" />;
          const current = list.find((c) => c.key === selected) ?? list[0];
          return (
            <div className={styles.layout}>
              <nav aria-label="Conversations">
                <ul className={styles.conversations}>
                  {list.map((c) => (
                    <li key={c.key}>
                      <button
                        className={c.key === current.key ? styles.selected : ''}
                        aria-current={c.key === current.key}
                        onClick={() => setSelected(c.key)}
                      >
                        <CounterpartName id={c.counterpartId} />
                        <span className={page.muted}>
                          {titles.get(c.taskId) ?? 'Project'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <Card>
                <SelectedThread
                  conversation={current}
                  title={titles.get(current.taskId) ?? 'Project'}
                />
              </Card>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function CounterpartName({ id }: { id: string }) {
  const user = useUser(id);
  return <strong>{user.data?.name ?? '…'}</strong>;
}

function SelectedThread({
  conversation,
  title,
}: {
  conversation: Conversation;
  title: string;
}) {
  const user = useUser(conversation.counterpartId);
  const name = user.data?.name ?? 'this participant';
  return (
    <>
      <h2>
        {name} · {title}
      </h2>
      <MessageThread
        key={conversation.key}
        taskId={conversation.taskId}
        counterpartId={conversation.counterpartId}
        counterpartName={name}
      />
    </>
  );
}
