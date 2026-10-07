import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import css from './project-workroom.css?inline';

function formatAmount(amount) {
  if (typeof amount === 'number') return '$' + amount.toLocaleString();
  if (typeof amount === 'string') return amount.startsWith('$') ? amount : '$' + amount;
  return '$0';
}

function normalizeStatus(status) {
  if (!status) return 'pending';
  if (status === 'submitted' || status === 'review') return 'review';
  if (status === 'in-progress') return 'inprogress';
  if (status === 'completed' || status === 'approved') return 'completed';
  if (status === 'disputed') return 'disputed';
  return status;
}

function statusLabel(status) {
  return status === 'review' ? 'Submitted for Review'
    : status === 'inprogress' ? 'In Progress'
      : status === 'completed' ? 'Completed'
        : status === 'disputed' ? 'Disputed'
          : status === 'pending' ? 'Pending'
            : status;
}

const statusColors = { completed: '#10b981', inprogress: '#6366f1', pending: '#94a3b8', review: '#f59e0b', disputed: '#ef4444' };
const statusBgs = { completed: '#ecfdf5', inprogress: '#eef2ff', pending: '#f1f5f9', review: '#fffbeb', disputed: '#fef2f2' };

function getStoredMilestones(milestones) {
  try {
    const stored = localStorage.getItem('milestonesData');
    if (!stored) return milestones;
    return JSON.parse(stored);
  } catch (e) {
    console.warn('localStorage unavailable for milestonesData', e);
    return milestones;
  }
}

function getUserRole() {
  try {
    return Auth.getCurrentUser()?.role || 'client';
  } catch (err) {
    console.warn('localStorage unavailable, defaulting role to client', err);
    return 'client';
  }
}

function safeSetUserRole(value) {
  try {
    localStorage.setItem('userRole', value);
  } catch (err) {
    console.warn('localStorage unavailable, cannot set user role to', value);
  }
}

/** Everything the original computed once on DOMContentLoaded. */
function loadWorkroom(task) {
  // Real escrow for this project. The card previously hardcoded
  // $4,500 released / $3,500 remaining / 56% for every project.
  const esc = Store.getEscrowForTask(task.id) || { projectHeld: 0 };
  const released = (Store.getTransactions() || [])
    .filter((t) => t.type === 'milestone-release' && t.taskId === task.id)
    .reduce((sum, t) => sum + (t.grossAmount != null ? t.grossAmount : (t.amount || 0)), 0);
  const fundedTotal = released + (esc.projectHeld || 0);
  const money = (n) => '$' + Number(n || 0).toLocaleString();
  const escrowView = {
    released: money(released),
    held: money(esc.projectHeld),
    pct: fundedTotal > 0 ? Math.round((released / fundedTotal) * 100) : 0,
  };

  const client = Store.getUserById(task.clientId) || { name: 'Client', avatar: 'CL', avatarColor: 'linear-gradient(135deg,#94a3b8,#64748b)' };
  const worker = Store.getUserById(task.workerId) || { name: 'Unassigned', avatar: 'UN', avatarColor: 'linear-gradient(135deg,#a855f7,#9333ea)' };

  const project = {
    name: task.title || 'Untitled Project',
    client: { name: client.name || 'Client', avatar: client.avatar || 'CL', color: client.avatarColor || 'linear-gradient(135deg,#6366f1,#4f46e5)' },
    worker: { name: worker.name || 'Worker', avatar: worker.avatar || 'WK', color: worker.avatarColor || 'linear-gradient(135deg,#10b981,#059669)' },
    totalBudget: task.budget || 0,
    deadline: task.deadline || 'TBD',
    status: task.status ? task.status.replace(/-/g, ' ') : 'In Progress',
    milestonesCount: (task.milestonesCount || Store.getMilestonesByTask(task.id).length || 0),
    completedMilestones: Store.getMilestonesByTask(task.id).filter((m) => m.status === 'completed' || m.status === 'approved').length || 0,
  };

  let milestones = Store.getMilestonesByTask(task.id).map((m) => ({
    id: m.id,
    title: m.title || 'Untitled Milestone',
    amount: formatAmount(m.budget || 0),
    status: normalizeStatus(m.status),
    statusLabel: statusLabel(normalizeStatus(m.status)),
  }));

  if (!milestones.length) {
    milestones = [
      { id: 'none', title: 'No milestones available', amount: '$0', status: 'pending', statusLabel: 'Pending' },
    ];
  }

  let initialMessages = Store.getMessagesByTask(task.id).map((m) => ({
    id: m.id,
    sender: m.senderId === task.clientId ? 'client' : 'worker',
    avatar: m.senderAvatar || (m.senderId === task.clientId ? (client.avatar || 'CL') : (worker.avatar || 'WK')),
    color: m.senderAvatarColor || (m.senderId === task.clientId ? (client.avatarColor || 'linear-gradient(135deg,#6366f1,#4f46e5)') : (worker.avatarColor || 'linear-gradient(135deg,#10b981,#059669)')),
    content: m.content,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));
  if (!initialMessages.length) {
    initialMessages = [
      { id: '1', sender: 'client', avatar: client.avatar || 'CL', color: client.avatarColor || 'linear-gradient(135deg,#6366f1,#4f46e5)', content: 'Welcome to the workspace for "' + project.name + '".', time: 'Just now' },
    ];
  }

  // After rendering, the original swapped in localStorage's milestonesData when present.
  milestones = getStoredMilestones(milestones);

  return { escrowView, project, milestones, initialMessages };
}

function Msg({ m, role }) {
  const isMe = (role === 'client' && m.sender === 'client') || (role === 'worker' && m.sender === 'worker');
  // (The original also had an attachment chip branch, but no message here ever carried one.)
  return (
    <div style={{ display: 'flex', ...(isMe ? { flexDirection: 'row-reverse' } : {}), gap: 10, maxWidth: '75%', ...(isMe ? { marginLeft: 'auto' } : {}) }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{m.avatar}</div>
      <div>
        <div style={{ padding: '10px 14px', borderRadius: 16, ...(isMe ? { background: '#6366f1', color: 'white', borderBottomRightRadius: 4 } : { background: 'var(--card)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }), fontSize: 14, lineHeight: 1.5 }}>
          {m.content}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, ...(isMe ? { textAlign: 'right' } : {}) }}>{m.time}</div>
      </div>
    </div>
  );
}

/** A message appended by sendWorkroomMsg (built with slightly different markup in the original). */
function SentMsg({ m }) {
  const { isClient, color, avatar, text } = m;
  return (
    <div style={{ display: 'flex', flexDirection: isClient ? 'row-reverse' : 'row', gap: 10, maxWidth: '75%', ...(isClient ? { marginLeft: 'auto' } : {}) }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{avatar}</div>
      <div>
        <div style={{ padding: '10px 14px', borderRadius: 16, ...(isClient ? { background: '#6366f1', color: 'white', borderBottomRightRadius: 4 } : { background: 'var(--card)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }), fontSize: 14, lineHeight: 1.5 }}>{text}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, ...(isClient ? { textAlign: 'right' } : {}) }}>Just now</div>
      </div>
    </div>
  );
}

const hoverColorOn = (e) => { e.currentTarget.style.color = 'var(--foreground)'; };
const hoverColorOff = (e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; };

export default function ProjectWorkroom() {
  usePageStyle(css);
  const [role] = useState(() => {
    const r = getUserRole();
    safeSetUserRole(r);
    return r;
  });
  const taskId = getParam('id');
  const [task] = useState(() => (taskId ? Store.getTaskById(taskId) : null));
  const [data] = useState(() => (task ? loadWorkroom(task) : null));
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [sent, setSent] = useState([]);
  const [toast, setToast] = useState(null);
  const msgsRef = useRef(null);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const msgs = msgsRef.current;
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, [sent]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!task) {
    // Keep the dashboard shell — replacing document.body strands the user with no nav.
    return (
      <DashboardLayout role="client" activePath="client-my-projects.html" pageTitle="Workroom" pageSubtitle="No project selected">
        <div style={{ padding: '56px 24px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No project selected</div>
          <div style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 18 }}>Open a workroom from one of your projects.</div>
          <A href="client-my-projects.html" className="btn-primary" style={{ textDecoration: 'none' }}>Go to My Projects</A>
        </div>
      </DashboardLayout>
    );
  }

  const { escrowView, project, milestones, initialMessages } = data;

  const showToast = (msg, type = 'success') => {
    const bg = type === 'success' ? '#10b981' : type === 'warn' ? '#f59e0b' : '#ef4444';
    setToast({ msg, bg, id: Date.now() });
  };

  const selectedMs = milestones.find((m) => m.id === selectedMilestoneId);

  const goToReviewMilestone = () => {
    if (!selectedMilestoneId) {
      showToast('Select a milestone first', 'warn');
      return;
    }
    const m = milestones.find((x) => x.id === selectedMilestoneId);
    if (!m) return;
    try {
      localStorage.setItem('selectedMilestone', JSON.stringify(m));
    } catch (e) {
      console.warn('Could not set selectedMilestone in localStorage', e);
    }
    // The id has to travel in the URL. The review page reads its milestone
    // from the query string, so leaving it off sent the client to whichever
    // milestone the fallback scan happened to reach first — a different
    // submission than the one they picked, with someone else's files or
    // none at all.
    go('review-deliverable.html?milestoneId=' + encodeURIComponent(m.id) + '&role=client');
  };

  const raiseDisputeFromWorkroom = () => {
    if (!selectedMilestoneId) {
      showToast('Select a milestone first', 'warn');
      return;
    }
    const m = milestones.find((x) => x.id === selectedMilestoneId);
    if (!m) return;
    try {
      localStorage.setItem('disputeTargetMilestone', JSON.stringify(m));
    } catch (e) {
      console.warn('Could not set disputeTargetMilestone in localStorage', e);
    }
    go('dispute.html');
  };

  const markMilestoneSelected = (id) => {
    const ms = milestones.find((m) => m.id === id);
    if (!ms) return;
    setSelectedMilestoneId(id);
  };

  const sendWorkroomMsg = () => {
    const input = inputRef.current;
    if (!input || !msgsRef.current) return;
    const text = input.value.trim();
    if (!text) return;
    const curRole = localStorage.getItem('userRole') || 'client';
    const isClient = curRole === 'client';
    const session = Auth.getCurrentUser();
    const senderId = isClient ? task.clientId : task.workerId;
    const receiverId = isClient ? task.workerId : task.clientId;
    const senderUser = senderId ? Store.getUserById(senderId) : null;

    // Persist to backend + auto-notification
    Store.sendMessage({
      taskId: task.id,
      senderId: senderId,
      receiverId: receiverId,
      content: text,
      senderName: senderUser?.name || (session?.name || ''),
      senderAvatar: senderUser?.avatar || (session?.avatar || ''),
      senderAvatarColor: senderUser?.avatarColor || '',
    });

    const avatar = senderUser?.avatar || (isClient ? 'CL' : 'WK');
    const color = senderUser?.avatarColor || (isClient ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'linear-gradient(135deg,#10b981,#059669)');
    setSent((list) => [...list, { key: Date.now() + Math.random(), isClient, avatar, color, text }]);
    input.value = '';
    input.style.height = 'auto';
  };

  const reviewMilestones = milestones.filter((m) => m.status === 'review' || m.status === 'disputed');
  const actionsEnabled = !!selectedMs;

  return (
    <DashboardLayout
      role={role}
      activePath={role === 'worker' ? 'worker-my-projects.html' : 'client-my-projects.html'}
      pageTitle="Project Workroom"
      pageSubtitle={project.name}
    >
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <A href="client-my-projects.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s' }} onMouseEnter={hoverColorOn} onMouseLeave={hoverColorOff}>
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> Back
        </A>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{project.name}</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{project.status}</span>
      </div>

      {/* Project summary strip */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: project.client.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{project.client.avatar}</div>
          <div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Client</div><div style={{ fontSize: 13, fontWeight: 600 }}>{project.client.name}</div></div>
        </div>
        <div style={{ width: 1, height: 30, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: project.worker.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{project.worker.avatar}</div>
          <div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Worker</div><div style={{ fontSize: 13, fontWeight: 600 }}>{project.worker.name}</div></div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, color: '#10b981' }}>{`$${project.totalBudget.toLocaleString()}`}</div><div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Budget</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700 }}>{project.deadline}</div><div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Deadline</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700 }}>{`${project.completedMilestones}/${project.milestonesCount}`}</div><div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Milestones</div></div>
        </div>
      </div>

      <div className="workroom-layout">
        {/* Chat Panel */}
        <div className="chat-panel">
          <div className="chat-panel-header">
            <Icon name="message-square" style={{ width: 18, height: 18, color: '#6366f1' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Project Workroom Chat</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />Live</div>
          </div>

          <div className="chat-msgs" id="chatMsgs" ref={msgsRef}>
            {initialMessages.map((m) => <Msg key={m.id} m={m} role={role} />)}
            {sent.map((m) => <SentMsg key={m.key} m={m} />)}
          </div>

          <div className="chat-footer-bar">
            <button className="topnav-btn" title="Attach file" onClick={() => document.getElementById('fileInput').click()}>
              <Icon name="paperclip" style={{ width: 16, height: 16 }} />
            </button>
            <input type="file" id="fileInput" style={{ display: 'none' }} />
            <textarea
              id="workroomInput"
              ref={inputRef}
              placeholder="Type your message..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', minHeight: 40, maxHeight: 120 }}
              rows="1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendWorkroomMsg(); }
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button id="workroomSend" style={{ width: 40, height: 40, borderRadius: 12, background: '#6366f1', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} onClick={sendWorkroomMsg}>
              <Icon name="send" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="workroom-sidebar">
          {/* Milestones */}
          <div className="sidebar-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Milestones Submitted for Review</h3>
              <A href={`project-milestone-board.html?id=${task.id}`} style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, textDecoration: 'none' }}>View Board →</A>
            </div>
            <div id="milestonesSection">
              {!reviewMilestones.length ? (
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No submitted milestones for review.</div>
              ) : reviewMilestones.map((m) => {
                const label = m.statusLabel || { review: 'Submitted for Review', disputed: 'Disputed' }[m.status] || (m.status || 'Unknown');
                return (
                  <div
                    key={m.id}
                    id={`milestoneRow-${m.id}`}
                    className={`milestone-row${m.id === selectedMilestoneId ? ' selected' : ''}`}
                    style={{ cursor: 'pointer', padding: 10, borderRadius: 10, marginBottom: 8 }}
                    onClick={() => markMilestoneSelected(m.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, maxWidth: '70%' }}>{m.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[m.status], background: statusBgs[m.status], padding: '4px 10px', borderRadius: 9999, minWidth: 'fit-content' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>{m.amount}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="sidebar-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Quick Actions</h3>
            <button id="btnReviewDeliverable" className={'btn-primary' + (actionsEnabled ? '' : ' btn-disabled')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 8, fontSize: 13 }} onClick={goToReviewMilestone} disabled={!actionsEnabled}>
              <Icon name="eye" style={{ width: 15, height: 15 }} /> Review Deliverable
            </button>
            <A href={`project-milestone-board.html?id=${task.id}`} className="btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 8, textDecoration: 'none', fontSize: 13 }}>
              <Icon name="layout" style={{ width: 15, height: 15 }} /> Milestone Board
            </A>
            <button id="btnRaiseDispute" className={'btn-outline' + (actionsEnabled ? '' : ' btn-disabled')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 12, fontSize: 13 }} onClick={raiseDisputeFromWorkroom} disabled={!actionsEnabled}>
              <Icon name="alert-triangle" style={{ width: 15, height: 15, color: '#f59e0b' }} /> Raise Dispute
            </button>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted-foreground)' }}>
              Selected milestone: <strong id="selectedMilestoneTitle">{selectedMs ? selectedMs.title : 'None'}</strong>
            </div>
          </div>

          {/* Escrow */}
          <div className="sidebar-card" style={{ background: 'linear-gradient(145deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#065f46' }}>Escrow Status</h3>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: '#065f46' }}>Released</span><span style={{ fontWeight: 700, color: '#059669' }}>{escrowView.released}</span>
              </div>
              <div style={{ height: 6, background: '#d1fae5', borderRadius: 3, overflow: 'hidden', margin: '8px 0' }}>
                <div style={{ width: `${escrowView.pct}%`, height: '100%', background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#065f46' }}>Remaining</span><span style={{ fontWeight: 700, color: '#6366f1' }}>{escrowView.held}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast ? (
        <div key={toast.id} style={{ position: 'fixed', bottom: 24, right: 24, background: toast.bg, color: 'white', padding: '14px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast.msg}</div>
      ) : null}
    </DashboardLayout>
  );
}
