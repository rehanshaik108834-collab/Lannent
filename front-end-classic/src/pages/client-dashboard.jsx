import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';

export default function ClientDashboard() {
  // Live stats from store
  const session = Auth.getCurrentUser();
  const userId = session?.userId || 'u1';
  const myTasks = Store.getTasksByClient(userId);
  const activeTasks = myTasks.filter((t) => t.status === 'in-progress').length;
  const pendingApps = Store.getProposals().filter((p) => myTasks.find((t) => t.id === p.taskId) && p.status === 'pending' && p.type !== 'invitation').length;
  const user = Store.getUserById(userId);
  const walletBal = user?.walletBalance || 0;
  const completedTasks = myTasks.filter((t) => t.status === 'completed').length;

  // Recent activity from notifications (read, but unused, as in the original)
  Store.getNotifications(userId);

  const rows = myTasks.filter((t) => t.status !== 'completed').slice(0, 4);

  return (
    <DashboardLayout
      role="client"
      activePath="client-dashboard.html"
      pageTitle="Client Dashboard"
      pageSubtitle="Manage your projects and track progress"
    >
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-val">{activeTasks}</div>
            <div className="stat-label">Active Projects</div>
            <div className="stat-change">{`${myTasks.length} total`}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#eff6ff' }}>
            <Icon name="folder-kanban" style={{ width: 20, height: 20, color: '#3b82f6' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{pendingApps}</div>
            <div className="stat-label">Pending Applications</div>
            <div className="stat-change">{`${pendingApps} new`}</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}>
            <Icon name="users" style={{ width: 20, height: 20, color: '#a855f7' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{`$${walletBal.toLocaleString()}`}</div>
            <div className="stat-label">Wallet Balance</div>
            <div className="stat-change">Available</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}>
            <Icon name="wallet" style={{ width: 20, height: 20, color: '#10b981' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{completedTasks}</div>
            <div className="stat-label">Completed Tasks</div>
            <div className="stat-change">all time</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#fff7ed' }}>
            <Icon name="check-circle" style={{ width: 20, height: 20, color: '#f97316' }} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Quick Actions</h2>
        <div className="quick-actions-v2">
          <A href="post-task.html" className="qa-v2-card" style={{ background: '#f0f6ff', borderColor: '#e0efff' }}>
            <div className="qa-v2-icon" style={{ color: '#2563eb' }}>
              <Icon name="plus" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Post New Task</div>
              <div className="qa-v2-desc">Create a new project and hire workers</div>
            </div>
          </A>
          <A href="hire-gig-workers.html" className="qa-v2-card" style={{ background: '#fdf5ff', borderColor: '#f8e4ff' }}>
            <div className="qa-v2-icon" style={{ color: '#9333ea' }}>
              <Icon name="search" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Browse Gig Workers</div>
              <div className="qa-v2-desc">Find verified talent for your projects</div>
            </div>
          </A>
          <A href="worker-applications.html" className="qa-v2-card" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
            <div className="qa-v2-icon" style={{ color: '#16a34a' }}>
              <Icon name="eye" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">View Applications</div>
              <div className="qa-v2-desc">Review proposals from gig workers</div>
            </div>
          </A>
          <A href="client-wallet.html" className="qa-v2-card" style={{ background: '#fffaf0', borderColor: '#ffeed5' }}>
            <div className="qa-v2-icon" style={{ color: '#ea580c' }}>
              <Icon name="wallet" style={{ width: 20, height: 20 }} />
            </div>
            <div className="qa-v2-content">
              <div className="qa-v2-title">Manage Wallet</div>
              <div className="qa-v2-desc">Add funds and view transactions</div>
            </div>
          </A>
        </div>
      </div>

      {/* Active Projects Table */}
      <div className="projects-table">
        <div className="table-header">
          <span className="table-title">Active Projects</span>
          <A href="client-my-projects.html" className="btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>View All</A>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Worker</th>
                <th>Progress</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Escrow</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((t) => {
                const worker = Store.getUserById(t.workerId);
                const avatar = worker ? worker.avatar : '?';
                const name = worker ? worker.name : 'Not Assigned';
                const bg = worker ? worker.avatarColor : '#e5e7eb';
                const color = worker ? 'white' : '#6b7280';

                const ms = Store.getMilestonesByTask(t.id);
                const msCount = ms.length;
                const msDone = ms.filter((m) => ['completed', 'approved', 'audit-passed', 'done'].includes(m.status)).length;
                const prog = msCount ? Math.round((msDone / msCount) * 100) : 0;

                const statusColors = { 'in-progress': 'badge-blue', review: 'badge-purple', pending: 'badge-orange', completed: 'badge-green', open: 'badge-orange' };
                const badgeClass = statusColors[t.status] || 'badge-blue';

                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td>
                      <div className="worker-cell">
                        <div className="worker-avatar" style={{ background: bg, color }}>{avatar}</div>
                        <span style={!worker ? { color: 'var(--muted-foreground)' } : undefined}>{name}</span>
                      </div>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div className="progress-info"><span>{`${msDone}/${msCount} completed`}</span><span style={{ color: '#6366f1', fontWeight: 600 }}>{`${prog}%`}</span></div>
                      <div className="progress-track-sm"><div className="progress-fill-sm" style={{ width: `${prog}%` }} /></div>
                    </td>
                    <td style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>{t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}</td>
                    <td><span className={`badge ${badgeClass}`} style={{ textTransform: 'capitalize' }}>{(t.status || 'unknown').replace(/-/g, ' ')}</span></td>
                    <td style={{ fontWeight: 600 }}>{`$${(t.budget || 0).toLocaleString()}`}</td>
                    <td><A href={`project-workroom.html?id=${t.id}`} className="btn-sm">View</A></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 24 }}>No active projects right now. Start by posting a task!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
