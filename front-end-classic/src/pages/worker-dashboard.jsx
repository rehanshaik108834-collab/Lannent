import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';

const hoverOn = (e) => { e.currentTarget.style.background = '#f8f9fb'; };
const hoverOff = (e) => { e.currentTarget.style.background = 'transparent'; };

export default function WorkerDashboard() {
  // Live stats from store
  const session = Auth.getCurrentUser();
  const userId = session?.userId || 'u2';
  const myTasks = Store.getTasksByWorker(userId);
  const activeProjects = myTasks.filter((t) => t.status === 'in-progress').length;
  const completedProjects = myTasks.filter((t) => t.status === 'completed').length;
  const earned = Store.getTransactionsByUser(userId).filter((t) => t.type === 'milestone-release').reduce((s, t) => s + t.amount, 0);
  const proposals = Store.getProposalsByWorker(userId).length;

  const activeList = myTasks.filter((t) => t.status !== 'completed').slice(0, 3);
  const recommended = Store.getTasks().filter((t) => t.status === 'open' && t.workerId !== userId && t.clientId !== userId).slice(0, 3);

  return (
    <DashboardLayout
      role="worker"
      activePath="worker-dashboard.html"
      pageTitle="Worker Dashboard"
      pageSubtitle="Track your active projects and find new opportunities"
    >
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-val">{activeProjects}</div>
            <div className="stat-label">Active Projects</div>
            <div className="stat-change">{`${myTasks.length} total`}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#eff6ff' }}>
            <Icon name="folder-kanban" style={{ width: 20, height: 20, color: '#3b82f6' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{`$${(earned || 0).toLocaleString()}`}</div>
            <div className="stat-label">Total Earned</div>
            <div className="stat-change">Lifetime earnings</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}>
            <Icon name="wallet" style={{ width: 20, height: 20, color: '#10b981' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{proposals}</div>
            <div className="stat-label">Proposals Sent</div>
            <div className="stat-change">{`${Store.getProposalsByWorker(userId).filter((p) => p.status === 'pending').length} pending review`}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}>
            <Icon name="send" style={{ width: 20, height: 20, color: '#a855f7' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{completedProjects}</div>
            <div className="stat-label">Completed</div>
            <div className="stat-change">projects done</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#fff7ed' }}>
            <Icon name="check-circle" style={{ width: 20, height: 20, color: '#f97316' }} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 32, marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
        <div className="quick-actions-v2">
          <A href="browse-tasks.html" className="qa-v2-card" style={{ background: '#f0f6ff', borderColor: '#e0efff' }}>
            <div className="qa-v2-icon" style={{ color: '#2563eb' }}>
              <Icon name="search" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Find Tasks</div>
              <div className="qa-v2-desc">Browse and apply for new opportunities</div>
            </div>
          </A>
          <A href="worker-my-projects.html" className="qa-v2-card" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
            <div className="qa-v2-icon" style={{ color: '#16a34a' }}>
              <Icon name="folder-kanban" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">My Projects</div>
              <div className="qa-v2-desc">Manage your active milestones</div>
            </div>
          </A>
          <A href="messages.html" className="qa-v2-card" style={{ background: '#fffaf0', borderColor: '#ffeed5' }}>
            <div className="qa-v2-icon" style={{ color: '#ea580c' }}>
              <Icon name="message-square" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Messages</div>
              <div className="qa-v2-desc">Communicate with your clients</div>
            </div>
          </A>
          <A href="worker-wallet.html" className="qa-v2-card" style={{ background: '#fdf5ff', borderColor: '#f8e4ff' }}>
            <div className="qa-v2-icon" style={{ color: '#9333ea' }}>
              <Icon name="wallet" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Wallet</div>
              <div className="qa-v2-desc">View earnings and withdraw funds</div>
            </div>
          </A>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Active Projects */}
        <div className="projects-table">
          <div className="table-header">
            <span className="table-title">Active Projects</span>
            <A href="worker-my-projects.html" className="btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>View All</A>
          </div>
          <div style={{ padding: '8px 0' }}>
            {activeList.length ? activeList.map((t) => {
              const client = Store.getUserById(t.clientId);
              const clientName = client ? client.name : 'Unknown Client';
              const dueText = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD';
              const ms = Store.getMilestonesByTask(t.id);
              const msCount = ms.length;
              const msDone = ms.filter((m) => ['completed', 'approved', 'audit-passed', 'done'].includes(m.status)).length;
              const prog = msCount ? Math.round((msDone / msCount) * 100) : 0;
              const statusColors = { 'in-progress': 'badge-blue', review: 'badge-purple', pending: 'badge-orange', completed: 'badge-green', open: 'badge-orange' };
              const badgeClass = statusColors[t.status] || 'badge-blue';
              return (
                <div
                  key={t.id}
                  style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.15s', cursor: 'pointer' }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onClick={() => go('worker-workroom.html?id=' + t.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                    <span className={'badge ' + badgeClass} style={{ textTransform: 'capitalize' }}>{(t.status || 'unknown').replace(/-/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{`Client: ${clientName} · Due ${dueText}`}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 9999, background: '#6366f1', width: prog + '%' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>{`${prog}%`}</span>
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No active projects. Apply for some tasks!</div>
            )}
          </div>
        </div>

        {/* Recommended Tasks */}
        <div className="projects-table">
          <div className="table-header">
            <span className="table-title">Recommended Tasks</span>
            <A href="browse-tasks.html" className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>Browse All</A>
          </div>
          <div style={{ padding: '8px 0' }}>
            {recommended.length ? recommended.map((t) => {
              // The "% match" badge that sat here was Math.random() dressed as a
              // recommendation score; there is no matching model behind it.
              const tags = t.skills || [];
              return (
                <div
                  key={t.id}
                  style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onClick={() => go('task-details.html?id=' + t.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981', marginBottom: 8 }}>{`$${t.budget.toLocaleString()}`}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tags.map((tag, i) => <span key={i} className="skill-tag">{tag}</span>)}
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No recommended tasks right now.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
