import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Store } from '../lib/store';
import { usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './superuser-tasks.css?inline';

const statusMap = { open: 'badge-orange', 'in-progress': 'badge-blue', completed: 'badge-green', cancelled: 'badge-red', draft: 'badge-blue' };
const statusBadge = (s) => <span className={`badge ${statusMap[s] || 'badge-blue'}`}>{s.replace(/-/g, ' ')}</span>;

// The original passed this markup through escapeHtml, so an unassigned task
// shows the tag as literal text. Kept as it was.
const UNASSIGNED_ESCAPED = '<span style="color:var(--muted-foreground);">Unassigned</span>';

const cellStyle = { padding: '10px 14px', background: 'var(--secondary)', borderRadius: 10, fontSize: 14 };

export default function SuperuserTasks() {
  usePageStyle(css);

  const [allTasks, setAllTasks] = useState(() => Store.getTasks());
  // The original filled the table 100ms after the layout rendered.
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // renderTasks(): the count is written before the rows are built, and a task
  // the row template cannot format (e.g. one with no status) throws part-way,
  // leaving the new count above the previous rows. The table is rebuilt only
  // when renderTasks() ran in the original: on load, filter changes and deletes.
  const last = useRef({ count: '', rows: null });
  const table = useMemo(() => {
    if (!ready) return last.current;
    const out = { ...last.current };
    try {
      const q = search.toLowerCase();
      const filtered = allTasks.filter((t) => {
        const matchSearch = !q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchSearch && matchStatus;
      });
      out.count = filtered.length + ' task' + (filtered.length !== 1 ? 's' : '');
      out.rows = !filtered.length ? (
        <tr className="empty-row"><td colSpan={7}>No tasks found.</td></tr>
      ) : filtered.map((t) => {
        const client = Store.getUserById(t.clientId);
        const worker = t.workerId ? Store.getUserById(t.workerId) : null;
        return (
          <tr key={t.id} id={`taskRow_${t.id}`}>
            <td>
              <div style={{ fontWeight: 600, fontSize: 13, maxWidth: 180 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.category}</div>
            </td>
            <td style={{ fontSize: 13 }}>{client?.name || 'Unknown'}</td>
            <td style={{ fontSize: 13 }}>{worker?.name || UNASSIGNED_ESCAPED}</td>
            <td style={{ fontWeight: 600 }}>{`$${t.budget.toLocaleString()}`}</td>
            <td>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${t.progress}%` }} /></div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{`${t.progress}%`}</span>
            </td>
            <td>{statusBadge(t.status)}</td>
            <td>
              <div className="action-btns">
                <button className="btn-edit" onClick={() => viewTaskDetails(t.id)}>View</button>
                {t.status === 'open' && !t.workerId ? <button className="btn-delete" onClick={() => deleteTask(t.id)}>Delete</button> : null}
              </div>
            </td>
          </tr>
        );
      });
    } catch (e) {
      // Uncaught in the original; reported the same way here.
      setTimeout(() => { throw e; });
    }
    last.current = out;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, search, statusFilter, allTasks]);

  function viewTaskDetails(id) {
    const task = Store.getTaskById(id);
    if (!task) return;
    const client = Store.getUserById(task.clientId);
    const worker = task.workerId ? Store.getUserById(task.workerId) : null;
    setDetail({
      title: task.title,
      category: task.category || '—',
      status: task.status,
      budget: '$' + task.budget.toLocaleString(),
      deadline: task.deadline || '—',
      client: client ? client.name : 'Unknown',
      worker: worker ? worker.name : 'Unassigned',
      progress: task.progress + '%',
      desc: task.description || 'No description provided.',
      created: task.createdAt || '—',
    });
    setDetailOpen(true);
  }

  function closeDetailModal() {
    setDetailOpen(false);
  }

  function deleteTask(id) {
    const task = Store.getTaskById(id);
    if (!task) return;
    if (task.status !== 'open' || task.workerId) {
      Validate.toast('Only open tasks with no assigned worker can be deleted.', 'error');
      return;
    }
    Validate.confirm(
      `Permanently delete "${task.title}"? Nobody has been hired, so no money is held and nothing is refunded.`,
      () => {
        // An unfunded project holds no money; the server refuses to delete
        // anything funded or started, and never refunds a budget.
        const result = Store.deleteTask(id);
        if (!result.ok) {
          Validate.toast(result.message || 'The task could not be deleted.', 'error');
          return;
        }
        setAllTasks(Store.getTasks());
        Validate.toast('Task deleted.', 'success');
      },
    );
  }

  return (
    <DashboardLayout role="superuser" activePath="superuser-tasks.html" pageTitle="Manage Tasks" pageSubtitle="View task details or delete tasks on the platform">
      <div className="su-toolbar">
        <input className="su-search" id="taskSearch" placeholder="Search by title or category..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="su-filter" id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>Showing <strong id="taskCount">{table.count}</strong></div>

      <div className="task-table-wrap">
        <table>
          <thead>
            <tr><th>Task</th><th>Client</th><th>Worker</th><th>Budget</th><th>Progress</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="tasksTableBody">{table.rows}
          </tbody>
        </table>
      </div>

      {/* View Detail Modal (read-only) */}
      <div className={'modal-overlay' + (detailOpen ? ' open' : '')} id="taskDetailModal" onClick={(e) => { if (e.target.id === 'taskDetailModal') closeDetailModal(); }}>
        <div className="modal">
          <p className="modal-title" id="detailTitle">{detail ? detail.title : 'Task Details'}</p>
          <p className="modal-sub">Read-only view of task information.</p>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <div style={cellStyle} id="detailCategory">{detail ? detail.category : '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ padding: '10px 14px' }} id="detailStatus">{detail ? statusBadge(detail.status) : '—'}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Budget</label>
              <div style={{ ...cellStyle, fontWeight: 600 }} id="detailBudget">{detail ? detail.budget : '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <div style={cellStyle} id="detailDeadline">{detail ? detail.deadline : '—'}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client</label>
              <div style={cellStyle} id="detailClient">{detail ? detail.client : '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Worker</label>
              <div style={cellStyle} id="detailWorker">{detail ? detail.worker : '—'}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Progress</label>
              <div style={cellStyle} id="detailProgress">{detail ? detail.progress : '—'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Created</label>
              <div style={cellStyle} id="detailCreated">{detail ? detail.created : '—'}</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <div style={{ ...cellStyle, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }} id="detailDesc">{detail ? detail.desc : '—'}</div>
          </div>
          <div className="modal-actions">
            <button className="btn-cancel-modal" onClick={closeDetailModal} style={{ flex: 1 }}>Close</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
