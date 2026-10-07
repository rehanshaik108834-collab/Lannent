import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useActor } from '../../shared/api/actor';
import { formatDate } from '../../shared/format/format';
import { Notice, QueryView } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import styles from './messages.module.css';
import { useMessages, useSendMessage } from './hooks';

/**
 * The conversation between the signed-in account and one other participant
 * of a project. The server decides who may take part; the sender is always
 * the signed-in account.
 */
export function MessageThread({
  taskId,
  counterpartId,
  counterpartName,
}: {
  taskId: string;
  counterpartId: string;
  counterpartName: string;
}) {
  const actor = useActor();
  const messages = useMessages({ taskId });
  const send = useSendMessage();
  const [text, setText] = useState('');
  const end = useRef<HTMLLIElement>(null);
  const count = messages.data?.length ?? 0;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [count]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content) return;
    send.mutate(
      { taskId, receiverId: counterpartId, content },
      { onSuccess: () => setText('') },
    );
  }

  return (
    <div className={styles.thread}>
      <QueryView query={messages}>
        {(all) => {
          const conversation = all.filter(
            (m) =>
              (m.senderId === actor.id && m.receiverId === counterpartId) ||
              (m.senderId === counterpartId && m.receiverId === actor.id),
          );
          return conversation.length === 0 ? (
            <p className={page.muted}>
              No messages with {counterpartName} yet.
            </p>
          ) : (
            <ol
              className={styles.messages}
              aria-label={`Conversation with ${counterpartName}`}
            >
              {conversation.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.senderId === actor.id ? styles.mine : styles.theirs
                  }
                >
                  <span className={styles.author}>
                    {m.senderId === actor.id
                      ? 'You'
                      : (m.senderName ?? counterpartName)}{' '}
                    · {formatDate(m.createdAt)}
                  </span>
                  <p>{m.content}</p>
                </li>
              ))}
              <li ref={end} aria-hidden="true" />
            </ol>
          );
        }}
      </QueryView>
      <form onSubmit={submit} className={styles.composer}>
        <label
          htmlFor={`message-${taskId}-${counterpartId}`}
          className={styles.srOnly}
        >
          Message {counterpartName}
        </label>
        <input
          id={`message-${taskId}-${counterpartId}`}
          value={text}
          placeholder={`Message ${counterpartName}`}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={send.isPending || !text.trim()}>
          Send
        </button>
      </form>
      <Notice error={send.error} />
    </div>
  );
}
