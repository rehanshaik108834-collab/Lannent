import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import css from './project-milestone-board.css?inline';

// ── Store-backed milestone board ────────────────────────
const prioColors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981', Normal: '#6366f1' };

function loadMilestonesFromStore(taskId) {
  if (!taskId) {
    // fallback: use seed milestones
    const session = Auth.getCurrentUser();
    if (!session) return { todo: [], inProgress: [], review: [], disputed: [], done: [] };
    const tasks = Store.getTasksByClient(session.userId);
    taskId = tasks[0]?.id;
  }
  const all = taskId ? Store.getMilestonesByTask(taskId) : [];
  const colMap = { todo: [], inProgress: [], review: [], disputed: [], done: [] };
  all.forEach((m) => {
    const worker = m.workerId ? Store.getUserById(m.workerId) : null;
    const card = {
      id: m.id,
      title: m.title,
      desc: m.description || '',
      amount: '$' + (m.budget || 0).toLocaleString(),
      due: m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date',
      assignee: worker ? worker.avatar : '?',
      assigneeColor: worker ? worker.avatarColor : '#94a3b8',
      priority: m.priority || 'Medium',
      progress: m.progress || 0,
      status: m.status || 'todo',
      rawId: m.id,
      taskId: m.taskId,
    };
    if (m.status === 'completed' || m.status === 'approved' || m.status === 'audit-passed') colMap.done.push(card);
    else if (m.status === 'review' || m.status === 'submitted') colMap.review.push(card);
    else if (m.status === 'disputed') colMap.disputed.push(card);
    else if (m.status === 'in-progress') colMap.inProgress.push(card);
    else colMap.todo.push(card);
  });
  return colMap;
}

function KanbanCard({ m, col }) {
  const isReview = col === 'review';
  const isDone = col === 'done';
  const isDisp = col === 'disputed';
  const pc = prioColors[m.priority] || '#6366f1';
  return (
    <div className="kanban-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="card-title" style={{ flex: 1, marginBottom: 0 }}>{m.title}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, marginLeft: 8, background: `${pc}20`, color: pc, whiteSpace: 'nowrap' }}>{m.priority}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 10 }}>{m.desc}</p>
      {m.progress !== undefined ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>Progress</span>
            <span style={{ fontWeight: 700, color: '#6366f1' }}>{`${m.progress}%`}</span>
          </div>
          <div style={{ height: 5, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${m.progress}%` }} />
          </div>
        </div>
      ) : null}
      <div className="card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.assigneeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, fontWeight: 700 }}>{m.assignee}</div>
          <div className="card-meta" style={{ marginBottom: 0 }}>
            <Icon name="clock" style={{ width: 11, height: 11 }} />
            {m.due}
          </div>
        </div>
        <span className="card-amount">{m.amount}</span>
      </div>
      {isDone ? <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}><span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Approved &amp; Paid</span></div> : null}
      {isReview ? (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={(event) => { event.stopPropagation(); go(`review-deliverable.html?milestoneId=${m.rawId}&role=client`); }}
            style={{ width: '100%', padding: 8, borderRadius: 8, background: '#0ea5e9', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="eye" style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Review Deliverable
          </button>
        </div>
      ) : null}
      {isDisp ? <div style={{ marginTop: 10, textAlign: 'center', color: '#b91c1c', fontWeight: 700, fontSize: 12 }}>⚠ Dispute Active</div> : null}
    </div>
  );
}

export default function ProjectMilestoneBoard() {
  usePageStyle(css);
  const taskId = getParam('id');
  const task = taskId ? Store.getTaskById(taskId) : null;

  const milestones = loadMilestonesFromStore(taskId);

  const allMs = [...milestones.todo, ...milestones.inProgress, ...milestones.review, ...milestones.disputed, ...milestones.done];
  const doneMs = milestones.done.length;
  const totalBudget = allMs.reduce((s, m) => s + parseFloat((m.amount || '$0').replace(/[^0-9.]/g, '') || 0), 0);
  const releasedAmt = milestones.done.reduce((s, m) => s + parseFloat((m.amount || '$0').replace(/[^0-9.]/g, '') || 0), 0);
  const released = '$' + releasedAmt.toLocaleString();
  const pending = '$' + (totalBudget - releasedAmt).toLocaleString();
  const taskTitle = task ? task.title : 'Milestone Board';
  const taskDeadline = task && task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const progressPct = allMs.length ? Math.round((doneMs / allMs.length) * 100) : 0;

  return (
    <DashboardLayout role="client" activePath="client-my-projects.html" pageTitle="Milestone Board" pageSubtitle={taskTitle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <A
          href="client-my-projects.html"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> My Projects
        </A>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{taskTitle}</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>In Progress</span>
        <A
          href={`milestone-reports.html?role=client&taskId=${taskId || ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
        >
          <Icon name="file-text" style={{ width: 14, height: 14 }} />Reports
        </A>
        <A href={`project-workroom.html?id=${taskId}`} className="btn-primary" style={{ fontSize: 13, padding: '6px 14px', marginLeft: 4 }}>
          <Icon name="door-open" style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Go to Workroom
        </A>
      </div>

      {/* Project Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div><div className="stat-val">{allMs.length}</div><div className="stat-label">Total Milestones</div></div>
          <div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="flag" style={{ width: 20, height: 20, color: '#6366f1' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" style={{ color: '#10b981' }}>{released}</div><div className="stat-label">Escrow Released</div></div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="unlock" style={{ width: 20, height: 20, color: '#10b981' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" style={{ color: '#6366f1' }}>{pending}</div><div className="stat-label">Escrow Locked</div></div>
          <div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="lock" style={{ width: 20, height: 20, color: '#6366f1' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{taskDeadline}</div><div className="stat-label">Final Deadline</div></div>
          <div className="stat-icon-wrap" style={{ background: '#fffbeb' }}><Icon name="calendar" style={{ width: 20, height: 20, color: '#f59e0b' }} /></div>
        </div>
      </div>

      {/* Overall Progress */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Overall Progress</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{`${progressPct}%`}</span>
            <A href="messages.html" className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
              <Icon name="message-square" style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Message Worker
            </A>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${progressPct}%`, boxShadow: '0 0 10px rgba(99,102,241,0.4)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
          <span>{`${doneMs} of ${allMs.length} milestones completed`}</span>
          <span>22 days remaining</span>
        </div>
      </div>

      {/* Kanban Board */}
      {allMs.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', color: 'var(--muted-foreground)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 24 }}>
          <Icon name="flag" style={{ width: 48, height: 48, opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No milestones yet</div>
          <div style={{ fontSize: 14 }}>Add milestones when posting or editing this task.</div>
        </div>
      ) : null}
      <div className="kanban-board">
        <div className="kanban-col">
          <div className="kanban-col-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8' }} />
            <span className="kanban-col-title" style={{ color: '#64748b' }}>To Do</span>
            <span className="kanban-count" style={{ background: '#f1f5f9', color: '#64748b' }}>{milestones.todo.length}</span>
          </div>
          {milestones.todo.map((m) => <KanbanCard key={m.id} m={m} col="todo" />)}
        </div>
        <div className="kanban-col" style={{ background: '#eef2ff' }}>
          <div className="kanban-col-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', animation: 'pulse 2s infinite' }} />
            <span className="kanban-col-title" style={{ color: '#6366f1' }}>In Progress</span>
            <span className="kanban-count" style={{ background: '#e0e7ff', color: '#4f46e5' }}>{milestones.inProgress.length}</span>
          </div>
          {milestones.inProgress.map((m) => <KanbanCard key={m.id} m={m} col="inProgress" />)}
        </div>
        <div className="kanban-col" style={{ background: '#fffbeb' }}>
          <div className="kanban-col-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span className="kanban-col-title" style={{ color: '#d97706' }}>In Review</span>
            <span className="kanban-count" style={{ background: '#fef9c3', color: '#b45309' }}>{milestones.review.length}</span>
          </div>
          {milestones.review.map((m) => <KanbanCard key={m.id} m={m} col="review" />)}
        </div>
        <div className="kanban-col" style={{ background: '#fef2f2' }}>
          <div className="kanban-col-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span className="kanban-col-title" style={{ color: '#b91c1c' }}>Disputed</span>
            <span className="kanban-count" style={{ background: '#fee2e2', color: '#991b1b' }}>{milestones.disputed.length}</span>
          </div>
          {milestones.disputed.map((m) => <KanbanCard key={m.id} m={m} col="disputed" />)}
        </div>
        <div className="kanban-col" style={{ background: '#ecfdf5' }}>
          <div className="kanban-col-header">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <span className="kanban-col-title" style={{ color: '#059669' }}>Done</span>
            <span className="kanban-count" style={{ background: '#d1fae5', color: '#065f46' }}>{milestones.done.length}</span>
          </div>
          {milestones.done.map((m) => <KanbanCard key={m.id} m={m} col="done" />)}
        </div>
      </div>
    </DashboardLayout>
  );
}
