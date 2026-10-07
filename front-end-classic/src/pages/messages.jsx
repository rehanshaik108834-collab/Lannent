import { useLayoutEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './messages.css?inline';

/*
 * main.js initMessages() also ran on this page, but before this page's own
 * DOMContentLoaded handler built the markup, so it found no
 * .conversation-item and returned; #sendMessageBtn/#chatMessageInput never
 * exist here. The behaviour below is the page's own script.
 */

function buildConversations(currentUserId, currentRole) {
  // Build conversations from real project data
  // For clients: show conversations with workers on their projects
  // For workers: show conversations with clients on their projects
  const allTasks = Store.getTasks();
  const myTasks = allTasks.filter((t) => {
    if (currentRole === 'client') return t.clientId === currentUserId && t.workerId;
    if (currentRole === 'worker') return t.workerId === currentUserId && t.clientId;
    return false;
  });

  return myTasks.map((task) => {
    const otherId = currentRole === 'client' ? task.workerId : task.clientId;
    const otherUser = Store.getUserById(otherId) || { name: 'Unknown', avatar: '??', avatarColor: 'linear-gradient(135deg,#94a3b8,#64748b)' };
    const taskMessages = Store.getMessagesByTask(task.id);

    // Build message list for this conversation
    const msgs = taskMessages.map((m) => ({
      from: m.senderId === currentUserId ? 'me' : 'them',
      text: m.content,
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;

    return {
      taskId: task.id,
      otherId,
      name: otherUser.name,
      avatar: otherUser.avatar || '??',
      color: otherUser.avatarColor || 'linear-gradient(135deg,#94a3b8,#64748b)',
      project: task.title,
      lastMsg: lastMsg ? lastMsg.text : 'No messages yet',
      time: lastMsg ? lastMsg.time : '',
      unread: 0,
      online: true,
      messages: msgs,
    };
  });
}

function EmptyMessages({ convo }) {
  return (
    <div className="empty-chat">
      <Icon name="message-square" style={{ width: 36, height: 36, marginBottom: 8, opacity: 0.3 }} />
      <div style={{ fontSize: 14 }}>No messages yet</div>
      <div style={{ fontSize: 12 }}>Send a message from the <A href={`project-workroom.html?id=${convo.taskId}`} style={{ color: '#6366f1' }}>project workroom</A>.</div>
    </div>
  );
}

function MessageRow({ m, convo }) {
  return (
    <div className={m.from === 'me' ? 'msg-sent' : 'msg-received'}>
      {m.from === 'them' ? (
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: convo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{convo.avatar}</div>
      ) : null}
      <div>
        <div className={'bubble ' + (m.from === 'me' ? 'bubble-sent' : 'bubble-received')}>{m.text}</div>
        <div className="msg-time">{m.time}</div>
      </div>
    </div>
  );
}

export default function Messages() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();
  const currentUserId = session?.userId || '';
  const currentRole = session?.role || 'client';

  // The conversation list is built once and, as in the original, never
  // re-rendered: sending a message does not update its preview line.
  const [conversations] = useState(() => buildConversations(currentUserId, currentRole));
  const [activeConvoIdx, setActiveConvoIdx] = useState(0);
  // selectConvo() rewrote the header without its ids.
  const [selected, setSelected] = useState(false);
  // #chatBody: the messages rendered by the last selectConvo() (or first load),
  // plus messages appended by sendMsg() since then.
  const [body, setBody] = useState(() => ({ messages: conversations[0] ? conversations[0].messages.slice() : [], appended: [], key: 0 }));
  const [scrollTick, setScrollTick] = useState(1);

  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    if (!scrollTick) return;
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollTick]);

  if (!conversations.length) {
    return (
      <DashboardLayout role={currentRole} activePath="messages.html" pageTitle="Messages" pageSubtitle="">
        <div className="messages-wrap">
          <div className="empty-chat" style={{ width: '100%' }}>
            <Icon name="message-square-off" style={{ width: 48, height: 48, marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No conversations yet</div>
            <div style={{ fontSize: 13 }}>Messages from your project workrooms will appear here.</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  function selectConvo(idx) {
    const convo = conversations[idx];
    setActiveConvoIdx(idx);
    if (!convo) return;
    setSelected(true);
    setBody((b) => ({ messages: convo.messages.slice(), appended: [], key: b.key + 1 }));
    // Only scrolled when there were messages to show.
    if (convo.messages.length) setScrollTick((n) => n + 1);
  }

  function sendMsg() {
    const input = inputRef.current;
    if (!input || !chatBodyRef.current) return;
    const text = input.value.trim();
    if (!text) return;

    const convo = conversations[activeConvoIdx];
    if (!convo) return;

    const sess = Auth.getCurrentUser();
    const uid = sess?.userId || '';

    // Persist via Store (also generates notification)
    Store.sendMessage({
      taskId: convo.taskId,
      senderId: uid,
      receiverId: convo.otherId,
      content: text,
      senderName: sess?.name || '',
      senderAvatar: sess?.avatar || '',
      senderAvatarColor: sess?.avatarColor || '',
    });

    // Add to local conversation. The original also updated convo.lastMsg and
    // convo.time, but never re-rendered the list, so its preview stays as loaded.
    convo.messages.push({ from: 'me', text, time: 'Just now' });

    // Render the new message
    setBody((b) => ({ ...b, appended: [...b.appended, text] }));
    input.value = '';
    input.style.height = 'auto';
    setScrollTick((n) => n + 1);
  }

  // Header and body show the selected conversation (the first one until a click).
  const shown = selected ? conversations[activeConvoIdx] : conversations[0];

  return (
    <DashboardLayout role={currentRole} activePath="messages.html" pageTitle="Messages" pageSubtitle="">
      <div className="messages-wrap">
        {/* Conversations list */}
        <div className="convos-list">
          <div className="convos-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Messages</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--input-bg)' }}>
              <Icon name="search" style={{ width: 14, height: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <input type="text" placeholder="Search messages..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', flex: 1, color: 'var(--foreground)' }} />
            </div>
          </div>
          <div id="convosList">
            {conversations.map((c, i) => (
              <div key={c.taskId} className={'conversation-item' + (i === activeConvoIdx ? ' active' : '')} onClick={() => selectConvo(i)}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{c.avatar}</div>
                  {c.online ? <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} /> : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMsg}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.7 }}>{c.project}</div>
                </div>
                {c.unread ? <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#6366f1', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.unread}</div> : null}
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-area">
          <div className="chat-header-bar" id="chatHeader">
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: shown.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{shown.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }} id={selected ? undefined : 'chatName'}>{shown.name}</div>
              {selected ? (
                <div style={{ fontSize: 12, color: shown.online ? '#22c55e' : 'var(--muted-foreground)' }}>{`${shown.online ? '● Online' : '● Offline'} · ${shown.project}`}</div>
              ) : (
                <div style={{ fontSize: 12, color: '#22c55e' }}>{`● Online · ${shown.project}`}</div>
              )}
            </div>
            <A href={`project-workroom.html?id=${shown.taskId}`} className="topnav-btn" title="Open Workroom" id={selected ? undefined : 'workroomLink'}>
              <Icon name="external-link" style={{ width: 16, height: 16 }} />
            </A>
          </div>

          <div className="chat-body" id="chatBody" ref={chatBodyRef}>
            {body.messages.length
              ? body.messages.map((m, i) => <MessageRow key={`${body.key}-${i}`} m={m} convo={shown} />)
              : <EmptyMessages key={`${body.key}-empty`} convo={shown} />}
            {body.appended.map((text, i) => (
              <div key={`${body.key}-a${i}`} className="msg-sent"><div><div className="bubble bubble-sent">{text}</div><div className="msg-time">Just now</div></div></div>
            ))}
          </div>

          <div className="chat-footer">
            <button className="topnav-btn" title="Attach file"><Icon name="paperclip" style={{ width: 16, height: 16 }} /></button>
            <textarea
              className="chat-textarea"
              id="chatInput"
              placeholder="Type a message..."
              rows="1"
              ref={inputRef}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f1', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} id="sendBtn" onClick={sendMsg}>
              <Icon name="send" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
