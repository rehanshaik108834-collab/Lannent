import { useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go, reload } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import css from './worker-milestone-board.css?inline';

// ── Store-backed worker milestone board ──────────────────
function loadWorkerMilestones(taskId) {
  const session = Auth.getCurrentUser();
  if (!session) return { todo: [], inprogress: [], review: [], done: [] };
  const workerTasks = taskId ? [Store.getTaskById(taskId)].filter(Boolean) : Store.getTasksByWorker(session.userId);
  const colMap = { todo: [], inprogress: [], review: [], done: [] };
  workerTasks.forEach((t) => {
    const ms = Store.getMilestonesByTask(t.id);
    ms.forEach((m) => {
      const card = {
        id: m.id, rawId: m.id, taskId: m.taskId,
        title: m.title, desc: m.description || '',
        amount: '$' + (m.budget || 0).toLocaleString(),
        due: m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        assignee: session.avatar || 'AW', assigneeColor: session.avatarColor || 'linear-gradient(135deg,#10b981,#059669)',
        priority: m.priority || 'Medium', progress: m.progress || 0, status: m.status || 'todo',
      };
      if (m.status === 'done' || m.status === 'approved' || m.status === 'completed' || m.status === 'audit-passed') colMap.done.push(card);
      else if (m.status === 'review' || m.status === 'submitted') colMap.review.push(card);
      else if (m.status === 'in-progress') colMap.inprogress.push(card);
      else colMap.todo.push(card);
    });
  });
  return colMap;
}

function submitDeliverable(milestoneId, taskId) {
  go('submit-deliverable.html?milestoneId=' + milestoneId + (taskId ? '&taskId=' + taskId : ''));
}

function startWorking(milestoneId) {
  if (!milestoneId) return;
  const milestone = Store.getMilestoneById(milestoneId);
  if (!milestone) return;
  milestone.status = 'in-progress';
  Store.updateMilestone(milestoneId, milestone);
  reload();
}

function renderCard(m, col) {
  const isReview = col === 'review';
  const isDone = col === 'done';
  const pc = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }[m.priority] || '#6366f1';
  return (
    <div key={m.id} className="kanban-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="card-title" style={{ flex: 1, marginBottom: 0 }}>{m.title}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, marginLeft: 8, background: `${pc}20`, color: pc, whiteSpace: 'nowrap' }}>{m.priority}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 10 }}>{m.desc}</p>
      {m.progress ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>Progress</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{`${m.progress}%`}</span>
          </div>
          <div style={{ height: 5, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#10b981,#059669)', width: `${m.progress}%` }} />
          </div>
        </div>
      ) : null}
      <div className="card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.assigneeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, fontWeight: 700 }}>{m.assignee}</div>
          <div className="card-meta" style={{ marginBottom: 0 }}>
            <Icon name="clock" style={{ width: 11, height: 11 }} />{` ${m.due}`}
          </div>
        </div>
        <span className="card-amount">{m.amount}</span>
      </div>
      {isDone ? <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}><span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Completed</span></div> : null}
      {isReview ? (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: '#fef9c3', border: '1px solid #fde68a', textAlign: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>⏳ Awaiting Client Review</span>
        </div>
      ) : col === 'inprogress' ? (
        <div style={{ marginTop: 10 }}>
          <button onClick={(e) => { e.stopPropagation(); submitDeliverable(m.rawId, m.taskId); }} style={{ width: '100%', padding: 7, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="send" style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Submit Deliverable
          </button>
        </div>
      ) : col === 'todo' ? (
        <div style={{ marginTop: 10 }}>
          <button onClick={(e) => { e.stopPropagation(); startWorking(m.rawId); }} style={{ width: '100%', padding: 7, borderRadius: 8, background: '#eef2ff', color: '#4f46e5', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Start Working
          </button>
        </div>
      ) : null}
    </div>
  );
}

const dot = (background, extra) => <div style={{ width: 10, height: 10, borderRadius: '50%', background, ...extra }} />;

function renderKanbanBoard(milestones) {
  const allMs = [...milestones.todo, ...milestones.inprogress, ...milestones.review, ...milestones.done];
  if (allMs.length === 0) {
    return <div style={{ gridColumn: '1/-1', padding: 64, textAlign: 'center', color: 'var(--muted-foreground)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }}><Icon name="flag" style={{ width: 48, height: 48, opacity: 0.3, margin: '0 auto 16px', display: 'block' }} /><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No milestones yet</div><div style={{ fontSize: 14 }}>Milestones will appear once clients assign them to you.</div></div>;
  }
  return (
    <>
      <div className="kanban-col">
        <div className="kanban-col-header">
          {dot('#94a3b8')}
          <span className="kanban-col-title" style={{ color: '#64748b' }}>To Do</span>
          <span className="kanban-count" style={{ background: '#f1f5f9', color: '#64748b' }}>{milestones.todo.length}</span>
        </div>
        {milestones.todo.map((m) => renderCard(m, 'todo'))}
      </div>
      <div className="kanban-col" style={{ background: '#eef2ff' }}>
        <div className="kanban-col-header">
          {dot('#6366f1', { animation: 'pulse 2s infinite' })}
          <span className="kanban-col-title" style={{ color: '#6366f1' }}>In Progress</span>
          <span className="kanban-count" style={{ background: '#e0e7ff', color: '#4f46e5' }}>{milestones.inprogress.length}</span>
        </div>
        {milestones.inprogress.map((m) => renderCard(m, 'inprogress'))}
      </div>
      <div className="kanban-col" style={{ background: '#fffbeb' }}>
        <div className="kanban-col-header">
          {dot('#f59e0b')}
          <span className="kanban-col-title" style={{ color: '#d97706' }}>In Review</span>
          <span className="kanban-count" style={{ background: '#fef9c3', color: '#b45309' }}>{milestones.review.length}</span>
        </div>
        {milestones.review.map((m) => renderCard(m, 'review'))}
      </div>
      <div className="kanban-col" style={{ background: '#ecfdf5' }}>
        <div className="kanban-col-header">
          {dot('#10b981')}
          <span className="kanban-col-title" style={{ color: '#059669' }}>Done</span>
          <span className="kanban-count" style={{ background: '#d1fae5', color: '#065f46' }}>{milestones.done.length}</span>
        </div>
        {milestones.done.map((m) => renderCard(m, 'done'))}
      </div>
    </>
  );
}

function safeSetUserRole(value) {
  try {
    localStorage.setItem('userRole', value);
  } catch (err) {
    console.warn('localStorage unavailable, cannot set user role to', value);
  }
}

export default function WorkerMilestoneBoard() {
  usePageStyle(css);
  useEffect(() => { safeSetUserRole('worker'); }, []);

  const taskId = getParam('id');
  const task = taskId ? Store.getTaskById(taskId) : null;
  const taskTitle = task ? task.title : 'Milestone Board';
  const milestones = loadWorkerMilestones(taskId);
  const allMs = [...milestones.todo, ...milestones.inprogress, ...milestones.review, ...milestones.done];
  const doneMs = milestones.done.length;
  const totalBudget = allMs.reduce((s, m) => s + parseFloat((m.amount || '$0').replace(/[^0-9.]/g, '') || 0), 0);
  const earnedAmt = milestones.done.reduce((s, m) => s + parseFloat((m.amount || '$0').replace(/[^0-9.]/g, '') || 0), 0);
  const escrowAmt = totalBudget - earnedAmt;
  const taskDeadline = task && task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const progressPct = allMs.length ? Math.round((doneMs / allMs.length) * 100) : 0;
  const progressDone = doneMs + milestones.inprogress.length;

  return (
    <DashboardLayout role="worker" activePath="worker-my-projects.html" pageTitle="Milestone Board" pageSubtitle={taskTitle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <A
          href="worker-my-projects.html"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> My Projects
        </A>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{taskTitle}</span>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>In Progress</span>
        <A
          href={`milestone-reports.html?role=worker&taskId=${taskId || ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none', transition: 'background 0.15s', marginLeft: 10 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
        >
          <Icon name="file-text" style={{ width: 14, height: 14 }} />Reports
        </A>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div><div className="stat-val">{allMs.length}</div><div className="stat-label">Total Milestones</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="flag" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" style={{ color: '#10b981' }}>{`$${earnedAmt.toLocaleString()}`}</div><div className="stat-label">Earned so far</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" style={{ color: '#6366f1' }}>{`$${escrowAmt.toLocaleString()}`}</div><div className="stat-label">In Escrow</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="lock" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val">{taskDeadline}</div><div className="stat-label">Final Deadline</div></div><div className="stat-icon-wrap" style={{ background: '#fffbeb' }}><Icon name="calendar" style={{ width: 20, height: 20, color: '#f59e0b' }} /></div></div>
      </div>

      {/* Overall progress */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Overall Progress</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>{`${progressPct}%`}</span>
            <A href={'worker-workroom.html?id=' + taskId} className="btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>
              <Icon name="message-square" style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Workroom
            </A>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${progressPct}%`, boxShadow: '0 0 10px rgba(99,102,241,0.4)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
          <span>{`${progressDone} of ${allMs.length} milestones in progress or done`}</span>
        </div>
      </div>

      {/* Kanban */}
      <div className="kanban-board" id="kanbanContainer">
        {renderKanbanBoard(milestones)}
      </div>
    </DashboardLayout>
  );
}
