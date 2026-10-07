import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';

const statusMap = { open: 'badge-orange', 'in-progress': 'badge-blue', completed: 'badge-green', cancelled: 'badge-red' };
const statusBadge = (s) => <span className={`badge ${statusMap[s] || 'badge-blue'}`}>{s.replace(/-/g, ' ')}</span>;

export default function SuperuserDashboard() {
  const users = Store.getUsers();
  const tasks = Store.getTasks();
  const disputes = Store.getDisputes();
  const transactions = Store.getTransactions();
  const auditReqs = Store.getAuditRequests();

  const totalUsers = users.length;
  const activeTasks = tasks.filter((t) => t.status === 'in-progress').length;
  // eslint-disable-next-line no-unused-vars
  const openDisputes = disputes.filter((d) => d.status === 'open').length;
  const escrowTotal = transactions.filter((t) => t.type === 'escrow-lock').reduce((s, t) => s + t.amount, 0);
  const released = transactions.filter((t) => t.type === 'milestone-release').reduce((s, t) => s + t.amount, 0);
  const escrowBalance = escrowTotal - released;
  // eslint-disable-next-line no-unused-vars
  const pendingAudits = auditReqs.filter((a) => a.status === 'Pending').length;

  // Role breakdown
  const clients = users.filter((u) => u.role === 'client').length;
  const workers = users.filter((u) => u.role === 'worker').length;
  const experts = users.filter((u) => u.role === 'expert').length;

  // Recent users
  const recentUsers = [...users].slice(-5).reverse();
  // Recent tasks
  const recentTasks = [...tasks].slice(-5).reverse();

  // The original built the whole page as one template string before calling
  // initDashboard(), so a task its row template cannot format (no status or
  // budget) threw there and left the page empty. Same here, without
  // unmounting the app.
  let recentTaskRows;
  try {
    recentTaskRows = recentTasks.map((t) => (
      <tr key={t.id}>
        <td style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</td>
        <td>{`$${t.budget.toLocaleString()}`}</td>
        <td>{statusBadge(t.status)}</td>
        <td><A href="superuser-tasks.html" className="btn-sm">View</A></td>
      </tr>
    ));
  } catch (e) {
    setTimeout(() => { throw e; });
    return null;
  }

  return (
    <DashboardLayout role="superuser" activePath="superuser-dashboard.html" pageTitle="Super User Dashboard" pageSubtitle="Full platform control and oversight">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div><div className="stat-val">{totalUsers}</div><div className="stat-label">Total Users</div><div className="stat-change">{`${clients}C · ${workers}W · ${experts}E`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#eff6ff' }}><Icon name="users" style={{ width: 20, height: 20, color: '#3b82f6' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{tasks.length}</div><div className="stat-label">Total Tasks</div><div className="stat-change">{`${activeTasks} active`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="folder-kanban" style={{ width: 20, height: 20, color: '#10b981' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{`$${escrowBalance.toLocaleString()}`}</div><div className="stat-label">Escrow Balance</div><div className="stat-change">{`$${released.toLocaleString()} released`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="wallet" style={{ width: 20, height: 20, color: '#a855f7' }} /></div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Quick Actions</h2>
        <div className="quick-actions-v2">
          <A href="superuser-users.html" className="qa-v2-card" style={{ background: '#f0f6ff', borderColor: '#e0efff' }}>
            <div className="qa-v2-icon" style={{ color: '#2563eb' }}><Icon name="users" style={{ width: 20, height: 20 }} /></div>
            <div className="qa-v2-content"><div className="qa-v2-title">Manage Users</div><div className="qa-v2-desc">Add, edit, suspend or delete users</div></div>
          </A>
          <A href="superuser-escrow.html" className="qa-v2-card" style={{ background: '#fdf5ff', borderColor: '#f8e4ff' }}>
            <div className="qa-v2-icon" style={{ color: '#9333ea' }}><Icon name="wallet" style={{ width: 20, height: 20 }} /></div>
            <div className="qa-v2-content"><div className="qa-v2-title">Escrow &amp; Finance</div><div className="qa-v2-desc">Inspect held funds and the transaction ledger</div></div>
          </A>
          <A href="superuser-tasks.html" className="qa-v2-card" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
            <div className="qa-v2-icon" style={{ color: '#16a34a' }}><Icon name="folder-kanban" style={{ width: 20, height: 20 }} /></div>
            <div className="qa-v2-content"><div className="qa-v2-title">Manage Tasks</div><div className="qa-v2-desc">View or delete any task</div></div>
          </A>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Users */}
        <div className="projects-table">
          <div className="table-header">
            <span className="table-title">Recent Users</span>
            <A href="superuser-users.html" className="btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>View All</A>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td><div className="worker-cell"><div className="worker-avatar" style={u.avatarColor ? { background: u.avatarColor } : undefined}>{u.avatar}</div><div><div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div><div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{u.email}</div></div></div></td>
                    <td><span className={`badge ${u.role === 'client' ? 'badge-blue' : u.role === 'expert' ? 'badge-purple' : u.role === 'superuser' ? 'badge-red' : 'badge-green'}`}>{u.role}</span></td>
                    <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                    <td><A href="superuser-users.html" className="btn-sm">Edit</A></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="projects-table">
          <div className="table-header">
            <span className="table-title">Recent Tasks</span>
            <A href="superuser-tasks.html" className="btn-outline" style={{ fontSize: 13, padding: '6px 14px' }}>View All</A>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Budget</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {recentTaskRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
