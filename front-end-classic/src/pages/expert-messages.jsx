import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { usePageStyle } from '../lib/hooks';
import css from './expert-messages.css?inline';

/* ─────────────────────────────────────
   Conversation data for Expert Reviewer
───────────────────────────────────── */
const INITIAL_CONVERSATIONS = [
  {
    id: 1,
    name: 'James Client',
    avatar: 'JC',
    color: 'linear-gradient(135deg,#ef4444,#dc2626)',
    role: 'Client',
    tag: 'client',
    tagLabel: 'Client',
    caseRef: 'E-commerce Platform Redesign',
    caseId: 'AUD-2026-001',
    lastMsg: 'Thank you for the thorough report, much appreciated.',
    time: '5m ago',
    unread: 2,
    online: true,
    messages: [
      { from: 'them', text: 'Hi Dr. Smith, I wanted to flag some concerns about the Frontend Development milestone before your review.', time: '9:10 AM' },
      { from: 'me', text: 'Of course, go ahead. I\'m currently reviewing the submitted files.', time: '9:14 AM' },
      { from: 'them', text: 'Specifically, the checkout flow doesn\'t match the design specs we agreed on. The button placement is different.', time: '9:16 AM' },
      { from: 'me', text: 'I\'ve noted that. I\'ll compare the submitted Figma files against the original brief and include my findings in the report.', time: '9:20 AM' },
      { from: 'them', text: 'There are also some performance concerns — the product grid is very slow on mobile.', time: '9:21 AM' },
      { from: 'me', text: 'Understood. Performance assessment is included in my audit scope. I\'ll run a Lighthouse check on the provided prototype.', time: '9:24 AM' },
      { from: 'them', text: 'Thank you for the thorough report, much appreciated.', time: '9:50 AM' },
    ],
  },
  {
    id: 2,
    name: 'Sarah Chen',
    avatar: 'SC',
    color: 'linear-gradient(135deg,#6366f1,#4f46e5)',
    role: 'Gig Worker',
    tag: 'worker',
    tagLabel: 'Worker',
    caseRef: 'E-commerce Platform Redesign',
    caseId: 'AUD-2026-001',
    lastMsg: 'I\'ll send the updated accessibility fixes by tonight.',
    time: '32m ago',
    unread: 1,
    online: true,
    messages: [
      { from: 'them', text: 'Hello Dr. Smith! I saw the audit report was published. I wanted to clarify something about the ARIA labels finding.', time: '10:05 AM' },
      { from: 'me', text: 'Hi Sarah, sure — what would you like to clarify?', time: '10:08 AM' },
      { from: 'them', text: 'The carousel buttons do have aria-labels in the component file — they might not have been picked up because the build step strips comments. Can I share the source?', time: '10:10 AM' },
      { from: 'me', text: 'Yes please share the source file. If the labels are present in the production build, I can issue an amended finding.', time: '10:13 AM' },
      { from: 'them', text: 'Here\'s the component file:', time: '10:14 AM', attachment: { name: 'ProductCarousel.tsx', size: '12 KB', icon: 'file-code', iconColor: '#6366f1', iconBg: '#eef2ff' } },
      { from: 'me', text: 'Reviewed — you\'re right, the labels are in the source. The issue is that the Storybook preview I was given doesn\'t reflect the production build. I\'ll update the finding to a suggestion.', time: '10:22 AM' },
      { from: 'them', text: 'I\'ll send the updated accessibility fixes by tonight.', time: '10:25 AM' },
    ],
  },
  {
    id: 3,
    name: 'TechCorp Inc.',
    avatar: 'TC',
    color: 'linear-gradient(135deg,#f59e0b,#d97706)',
    role: 'Client',
    tag: 'client',
    tagLabel: 'Client',
    caseRef: 'E-learning Platform · Dispute',
    caseId: 'DSP-2026-002',
    lastMsg: 'We\'ll wait for the resubmission then.',
    time: '2h ago',
    unread: 0,
    online: false,
    messages: [
      { from: 'them', text: 'Dr. Smith, has the expert review started on our dispute case yet? Case DSP-2026-002.', time: 'Yesterday, 3:00 PM' },
      { from: 'me', text: 'Yes, I\'ve been assigned to your case and have reviewed all submitted files and load test reports.', time: 'Yesterday, 3:15 PM' },
      { from: 'them', text: 'The performance results are clear — 2,340ms is far above the 500ms threshold we agreed on.', time: 'Yesterday, 3:18 PM' },
      { from: 'me', text: 'The contract clause is clear on that point. However, the worker has raised a valid counter-point about cold-start conditions and the Redis caching layer not being deployed in the test environment.', time: 'Yesterday, 3:25 PM' },
      { from: 'them', text: 'We ran the tests exactly as the architecture doc specified.', time: 'Yesterday, 3:27 PM' },
      { from: 'me', text: 'I\'ve issued a Request Fix verdict — the worker has 5 business days to demonstrate compliant performance or optimise without the cache dependency. The verdict is neutral and gives both parties a fair path forward.', time: 'Yesterday, 4:00 PM' },
      { from: 'them', text: 'We\'ll wait for the resubmission then.', time: 'Yesterday, 4:05 PM' },
    ],
  },
  {
    id: 4,
    name: 'Arjun Mehta',
    avatar: 'AM',
    color: 'linear-gradient(135deg,#10b981,#059669)',
    role: 'Gig Worker',
    tag: 'worker',
    tagLabel: 'Worker',
    caseRef: 'E-learning Platform · Dispute',
    caseId: 'DSP-2026-002',
    lastMsg: 'I\'ll have the optimised API ready by Mar 9.',
    time: '4h ago',
    unread: 0,
    online: false,
    messages: [
      { from: 'them', text: 'Hi Dr. Smith, I wanted to explain the Redis caching setup — it\'s a required part of the architecture and the client didn\'t configure it before running load tests.', time: 'Yesterday, 1:00 PM' },
      { from: 'me', text: 'I saw your counter-claim and the local benchmark results. Can you share the architecture document that specifies the Redis requirement?', time: 'Yesterday, 1:10 PM' },
      { from: 'them', text: 'Yes, here it is:', time: 'Yesterday, 1:12 PM', attachment: { name: 'architecture-spec.pdf', size: '760 KB', icon: 'file-text', iconColor: '#ef4444', iconBg: '#fee2e2' } },
      { from: 'me', text: 'Reviewed. The spec does mention Redis as part of the recommended deployment stack. However, since I can\'t independently verify the test environment configuration, I\'m issuing a Request Fix — please provide evidence under properly configured conditions or optimise the API to meet the benchmark without the caching dependency.', time: 'Yesterday, 2:45 PM' },
      { from: 'them', text: 'That\'s fair. I\'ll optimise the query layer so it meets the SLA without Redis as a dependency.', time: 'Yesterday, 2:50 PM' },
      { from: 'me', text: 'Good. You have until Mar 11. Please resubmit through the platform and message me once done.', time: 'Yesterday, 2:52 PM' },
      { from: 'them', text: 'I\'ll have the optimised API ready by Mar 9.', time: 'Yesterday, 2:55 PM' },
    ],
  },
  {
    id: 5,
    name: 'Lannent Support',
    avatar: 'LS',
    color: 'linear-gradient(135deg,#64748b,#475569)',
    role: 'Platform',
    tag: 'admin',
    tagLabel: 'Admin',
    caseRef: 'Platform Notifications',
    caseId: null,
    lastMsg: 'You have 3 new audit requests assigned to your queue.',
    time: 'Mar 6',
    unread: 0,
    online: true,
    messages: [
      { from: 'them', text: 'Welcome back Dr. Smith! You have 3 new audit requests assigned to your queue for this week.', time: 'Mar 6, 9:00 AM', isSystem: true },
      { from: 'them', text: 'Audit AUD-2026-001 (E-commerce Platform Redesign) is marked High Priority — client deadline is Mar 8.', time: 'Mar 6, 9:01 AM', isSystem: true },
      { from: 'them', text: 'Dispute DSP-2026-002 (E-learning Platform) has been escalated. Both parties have submitted their evidence.', time: 'Mar 6, 9:02 AM', isSystem: true },
      { from: 'me', text: 'Acknowledged. I\'ll start with AUD-2026-001 today.', time: 'Mar 6, 9:10 AM' },
      { from: 'them', text: 'Your monthly payout of $4,200 has been processed and will appear in your wallet within 1–2 business days.', time: 'Mar 6, 2:00 PM', isSystem: true },
      { from: 'them', text: 'You have 3 new audit requests assigned to your queue.', time: 'Mar 7, 9:00 AM', isSystem: true },
    ],
  },
];

/* ─────────────────────────────────
   Helpers
───────────────────────────────── */
function tagClass(tag) {
  return { client: 'tag-client', worker: 'tag-worker', admin: 'tag-admin', case: 'tag-case' }[tag] || 'tag-admin';
}

const tagIconStyle = { width: 9, height: 9 };

/*
 * One row of the conversation list. The search results (filterSearch) used a
 * second, slightly different template: its tag had no icon.
 */
function ConvoItem({ c, active, search, onSelect }) {
  return (
    <div className={'convo-item' + (active ? ' active' : '')} onClick={() => onSelect(c.id)}>
      <div className="convo-avatar-wrap">
        <div className="convo-avatar" style={{ background: c.color }}>{c.avatar}</div>
        {c.online ? <div className="convo-online-dot" /> : null}
      </div>
      <div className="convo-info">
        <div className="convo-name-row">
          <span className="convo-name">{c.name}</span>
          <span className="convo-time">{c.time}</span>
        </div>
        <div className={'convo-last-msg' + (c.unread ? ' unread' : '')}>{c.lastMsg}</div>
        {search ? (
          <span className={`convo-tag ${tagClass(c.tag)}`}>{`${c.tagLabel}${c.caseId ? ` · ${c.caseId}` : ''}`}</span>
        ) : (
          <span className={`convo-tag ${tagClass(c.tag)}`}>
            {c.tag === 'client' ? <Icon name="building-2" style={tagIconStyle} /> : c.tag === 'worker' ? <Icon name="user" style={tagIconStyle} /> : <Icon name="shield" style={tagIconStyle} />}
            {`${c.tagLabel}${c.caseId ? ` · ${c.caseId}` : ''}`}
          </span>
        )}
      </div>
      {c.unread ? <div className="unread-badge">{c.unread}</div> : null}
    </div>
  );
}

function Attachment({ a, received }) {
  return (
    <div className="attachment-bubble" style={received ? { marginBottom: 4, background: 'var(--input-bg)' } : { marginBottom: 4 }}>
      <div className="attachment-icon" style={{ background: a.iconBg }}>
        <Icon name={a.icon} style={{ width: 16, height: 16, color: a.iconColor }} />
      </div>
      <div>
        <div className="attachment-name">{a.name}</div>
        <div className="attachment-size">{a.size}</div>
      </div>
      <Icon name="download" style={{ width: 13, height: 13, color: 'var(--muted-foreground)', marginLeft: 'auto' }} />
    </div>
  );
}

/* ─────────────────────────────────
   Render messages
───────────────────────────────── */
function Messages({ convo, messages }) {
  let lastDate = '';
  const out = [];

  messages.forEach((m, i) => {
    // Date divider
    const datePart = m.time.includes(',') ? m.time.split(',')[0] : (m.time.includes('AM') || m.time.includes('PM') ? 'Today' : m.time);
    if (datePart !== lastDate) {
      out.push(<div key={'d' + i} className="date-divider">{datePart}</div>);
      lastDate = datePart;
    }

    // System message
    if (m.isSystem) {
      out.push(<div key={i} className="sys-msg">{m.text}</div>);
      return;
    }

    const time = m.time.includes(',') ? m.time.split(', ')[1] : m.time;
    if (m.from === 'me') {
      out.push(
        <div key={i} className="msg-sent">
          <div>
            {m.attachment ? <Attachment a={m.attachment} /> : null}
            {m.text ? <div className="bubble bubble-sent">{m.text}</div> : null}
            <div className="msg-time">{`${time} · Sent`}</div>
          </div>
        </div>,
      );
    } else {
      out.push(
        <div key={i} className="msg-received">
          <div className="convo-avatar" style={{ width: 28, height: 28, borderRadius: '50%', background: convo.color, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>{convo.avatar}</div>
          <div>
            {m.attachment ? <Attachment a={m.attachment} received /> : null}
            {m.text ? <div className="bubble bubble-received">{m.text}</div> : null}
            <div className="msg-time">{`${time}`}</div>
          </div>
        </div>,
      );
    }
  });
  return out;
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Clients' },
  { value: 'worker', label: 'Workers' },
];

export default function ExpertMessages() {
  usePageStyle(css);
  // The conversations are page data that the handlers mutate, as before.
  const [conversations] = useState(() => structuredClone(INITIAL_CONVERSATIONS));
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((n) => n + 1);

  const [activeConvoId, setActiveConvoId] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');
  // null: the normal list; { query }: the list as filterSearch() last drew it.
  const [search, setSearch] = useState(null);
  // The chat body as last drawn by selectConvo(), plus messages sendMsg() appended.
  const [body, setBody] = useState(() => ({ messages: conversations.find((c) => c.id === 1).messages.slice(), appended: [] }));
  const [scrollTick, setScrollTick] = useState(0);
  // Computed once when the page was built and never updated.
  const [unreadAtLoad] = useState(() => conversations.reduce((a, c) => a + c.unread, 0));

  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on load
  useEffect(() => {
    const t = setTimeout(() => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    if (!scrollTick) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollTick]);

  const filteredConvos = () => (activeFilter === 'all' ? conversations : conversations.filter((c) => c.tag === activeFilter));

  /* ─────────────────────────────────
     Select conversation
  ───────────────────────────────── */
  function selectConvo(id) {
    setActiveConvoId(id);
    const convo = conversations.find((c) => c.id === id);
    if (!convo) return;
    convo.unread = 0; // mark as read
    setSearch(null);
    setBody({ messages: convo.messages.slice(), appended: [] });
    setScrollTick((n) => n + 1);
    rerender();
  }

  /* ─────────────────────────────────
     Send message
  ───────────────────────────────── */
  function sendMsg() {
    const input = inputRef.current;
    if (!input || !bodyRef.current) return;
    const text = input.value.trim();
    if (!text) return;

    const convo = conversations.find((c) => c.id === activeConvoId);
    if (convo) convo.messages.push({ from: 'me', text, time: 'Just now' });

    setBody((b) => ({ ...b, appended: [...b.appended, text] }));
    input.value = '';
    input.style.height = 'auto';
    setScrollTick((n) => n + 1);

    // Update last message in list
    if (convo) {
      convo.lastMsg = text;
      convo.time = 'Just now';
      setSearch(null);
    }
    rerender();
  }

  /* ─────────────────────────────────
     Filter tabs
  ───────────────────────────────── */
  function setFilter(val) {
    setActiveFilter(val);
    setSearch(null);
  }

  /* Search filter (client-side) */
  function filterSearch(query) {
    setSearch({ query });
  }

  let list;
  if (search) {
    const q = search.query.toLowerCase();
    const filtered = filteredConvos().filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.caseRef.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q));
    list = filtered.length
      ? filtered.map((c) => <ConvoItem key={c.id} c={c} active={c.id === activeConvoId} search onSelect={selectConvo} />)
      : <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>{`No results for "${search.query}"`}</div>;
  } else {
    const filtered = filteredConvos();
    list = filtered.length
      ? filtered.map((c) => <ConvoItem key={c.id} c={c} active={c.id === activeConvoId} onSelect={selectConvo} />)
      : <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No conversations found.</div>;
  }

  const activeConvo = conversations.find((c) => c.id === activeConvoId);

  return (
    <DashboardLayout role="expert" activePath="expert-messages.html" pageTitle="Messages" pageSubtitle="">
      <div className="messages-wrap">

        {/* ══ LEFT: Conversations Panel ══ */}
        <div className="convos-panel">
          <div className="convos-header">
            <div className="convos-header-top">
              <span className="convos-title">Messages</span>
              <span className="convos-unread">{`${unreadAtLoad} unread`}</span>
            </div>
            <div className="convos-search">
              <Icon name="search" style={{ width: 14, height: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <input type="text" placeholder="Search conversations..." onInput={(e) => filterSearch(e.currentTarget.value)} />
            </div>
            <div className="convos-tabs">
              {TABS.map((t) => (
                <button key={t.value} className={'tab-btn' + (activeFilter === t.value ? ' active' : '')} onClick={() => setFilter(t.value)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="convos-list" id="convosList">
            {list}
          </div>
        </div>

        {/* ══ RIGHT: Chat Area ══ */}
        <div className="chat-area">

          {/* Header */}
          <div className="chat-header" id="chatHeader">
            <div className="chat-header-avatar" style={{ background: activeConvo.color }}>{activeConvo.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="chat-header-name">{activeConvo.name}</div>
              <div className="chat-header-meta">
                <span className={activeConvo.online ? 'chat-header-online' : ''}>{activeConvo.online ? '● Online' : '● Offline'}</span>
                {` · ${activeConvo.role}`}
              </div>
            </div>
            {activeConvo.caseId ? (
              <div className="case-pill">
                <Icon name="briefcase" style={{ width: 11, height: 11 }} />
                {activeConvo.caseId}
              </div>
            ) : null}
            <button className="icon-btn" title="Search in conversation"><Icon name="search" style={{ width: 15, height: 15 }} /></button>
            <button className="icon-btn" title="More options"><Icon name="more-horizontal" style={{ width: 15, height: 15 }} /></button>
          </div>

          {/* Messages */}
          <div className="chat-body" id="chatBody" ref={bodyRef}>
            <Messages convo={activeConvo} messages={body.messages} />
            {body.appended.map((text, i) => (
              <div key={'s' + i} className="msg-sent">
                <div>
                  <div className="bubble bubble-sent">{text}</div>
                  <div className="msg-time">Just now · Sent</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="chat-footer">
            <button className="icon-btn" title="Attach file"><Icon name="paperclip" style={{ width: 15, height: 15 }} /></button>
            <textarea
              className="chat-textarea"
              id="chatInput"
              placeholder="Type a message…"
              rows="1"
              ref={inputRef}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }}
            />
            <button className="send-btn" onClick={sendMsg} title="Send">
              <Icon name="send" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
