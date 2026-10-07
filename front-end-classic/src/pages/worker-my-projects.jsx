import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './worker-my-projects.css?inline';
import { useLucideRefresh } from '../lib/hooks';

function fmtDate(d) {
  if (!d) return 'No deadline';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; }
}
function statusBadge(status) {
  const map = { open: ['badge-gray', 'Open'], 'in-progress': ['badge-blue', 'In Progress'], completed: ['badge-green', 'Completed'] };
  const [cls, label] = map[status] || ['badge-gray', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function getProjects(session) {
  const tasks = Store.getTasksByWorker(session.userId);
  return tasks.map((t) => {
    const client = t.clientId ? Store.getUserById(t.clientId) : null;
    const milestones = Store.getMilestonesByTask(t.id);
    const doneList = milestones.filter((m) => ['completed', 'approved', 'audit-passed', 'done', 'paid'].includes(m.status));
    const done = doneList.length;
    const earned = doneList.reduce((s, m) => s + (m.budget || 0), 0);
    const calculatedProgress = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : (t.progress || 0);
    return {
      id: t.id,
      name: t.title,
      client: client ? client.name : 'Unknown Client',
      clientAvatar: client ? client.avatar : '?',
      clientColor: client ? client.avatarColor : '#e5e7eb',
      progress: calculatedProgress,
      status: t.status,
      milestones: `${done}/${milestones.length}`,
      earned: `$${earned.toLocaleString()}`,
      total: `$${(t.budget || 0).toLocaleString()}`,
      deadline: fmtDate(t.deadline),
      category: t.status === 'completed' ? 'completed' : 'active',
    };
  });
}

const cardBtnStyle = { padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'white', color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 };

function renderProjects(all, cat) {
  const list = cat === 'all' ? all : all.filter((p) => p.category === cat);
  if (!list.length) return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name="folder-open" style={{ width: 24, height: 24, color: 'var(--muted-foreground)' }} /></div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No projects here</div>
      <div style={{ fontSize: 14, marginBottom: 20 }}>Browse tasks and apply to start earning.</div>
      <A href="browse-tasks.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="search" style={{ width: 16, height: 16 }} /> Find Tasks
      </A>
    </div>
  );
  return (
    <div className="projects-grid">
      {list.map((p) => (
        <div key={p.id} className="project-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', flex: 1, marginRight: 12 }}>{p.name}</h3>
            {statusBadge(p.status)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.clientColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{p.clientAvatar}</div>
            <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{`Client: ${p.client}`}</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Milestone Progress</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{`${p.milestones} completed`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#10b981,#059669)', width: `${p.progress}%`, transition: 'width 0.4s' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, flex: 1 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#16a34a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="wallet" style={{ width: 13, height: 13 }} />Earned
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>{`${p.earned} `}<span style={{ fontSize: 11, color: '#22c55e' }}>{`/ ${p.total}`}</span></div>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                <Icon name="calendar" style={{ width: 13, height: 13, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Deadline
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.deadline}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => go('worker-milestone-board.html?id=' + p.id)} style={cardBtnStyle}>
              <Icon name="layout-list" style={{ width: 14, height: 14 }} />Milestones
            </button>
            <button onClick={() => go('worker-workroom.html?id=' + p.id)} style={cardBtnStyle}>
              <Icon name="message-circle" style={{ width: 14, height: 14 }} />Workroom
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkerMyProjects() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();
  const [activeTab, setActiveTab] = useState('all');
  const refreshIcons = useLucideRefresh();
  const switchTab = (cat) => { setActiveTab(cat); refreshIcons(); };

  const all = getProjects(session);
  const active = all.filter((p) => p.category === 'active').length;
  const completed = all.filter((p) => p.category === 'completed').length;
  const tabClass = (cat) => 'tab-btn' + (activeTab === cat ? ' active' : '');

  return (
    <DashboardLayout role="worker" activePath="worker-my-projects.html" pageTitle="My Projects" pageSubtitle="Track your active projects and earnings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tab-bar">
          <button className={tabClass('all')} onClick={() => switchTab('all')}>{`All (${all.length})`}</button>
          <button className={tabClass('active')} onClick={() => switchTab('active')}>{`Active (${active})`}</button>
          <button className={tabClass('completed')} onClick={() => switchTab('completed')}>{`Completed (${completed})`}</button>
        </div>
        <A href="browse-tasks.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" style={{ width: 16, height: 16 }} /> Find More Tasks
        </A>
      </div>
      <div id="projectsContainer">{renderProjects(all, activeTab)}</div>
    </DashboardLayout>
  );
}
