import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { Validate } from '../lib/validation';
import { usePageStyle, useRerender } from '../lib/hooks';
import css from './client-my-projects.css?inline';

// ── Helpers ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    open: ['badge-gray', 'Open'],
    'in-progress': ['badge-blue', 'In Progress'],
    completed: ['badge-green', 'Completed'],
    // An audited project is held as a draft until a reviewer accepts.
    draft: ['badge-amber', 'Draft — awaiting audit'],
    cancelled: ['badge-gray', 'Cancelled'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  // An unknown status printed as its value, "undefined" included.
  return <span className={`badge ${cls}`}>{`${label}`}</span>;
}
function taskCategory(status) {
  if (status === 'completed') return 'completed';
  if (status === 'open') return 'open';
  return 'active';
}
function fmtDate(d) {
  if (!d) return 'No deadline';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return d; }
}

function getProjects(session) {
  const tasks = Store.getTasksByClient(session.userId);
  return tasks.map((t) => {
    const worker = t.workerId ? Store.getUserById(t.workerId) : null;
    const milestones = Store.getMilestonesByTask(t.id);
    const doneList = milestones.filter((m) => ['completed', 'approved', 'audit-passed', 'done', 'paid'].includes(m.status));
    const done = doneList.length;
    const calculatedProgress = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : (t.progress || 0);
    return {
      id: t.id,
      name: t.title,
      worker: worker ? worker.name : 'Not Assigned',
      workerAvatar: worker ? worker.avatar : '?',
      workerColor: worker ? worker.avatarColor : '#e5e7eb',
      progress: calculatedProgress,
      deadline: fmtDate(t.deadline),
      status: t.status,
      milestones: `${done}/${milestones.length}`,
      escrow: `$${(t.budget || 0).toLocaleString()}`,
      category: taskCategory(t.status),
      auditEnabled: t.auditEnabled,
    };
  });
}

// lucide.createIcons() after each tab switch / refresh replaced every icon in
// the document, which repaints them (and can shift antialiasing nearby).
// Re-inserting the same nodes in place gives the same repaint.
function repaintIcons() {
  document.querySelectorAll('svg[data-lucide]').forEach((el) => el.parentNode.insertBefore(el, el.nextSibling));
}

const actionBtnStyle = { padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'white', color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1 };
const errStyle = { fontSize: 12, color: '#ef4444', marginTop: 4 };

export default function ClientMyProjects() {
  usePageStyle(css);
  const rerender = useRerender();
  const session = Auth.getCurrentUser();
  const [activeTab, setActiveTab] = useState('all');
  // Tab counts were written at first render and refreshed only by refreshView().
  const [counts, setCounts] = useState(() => {
    const all = getProjects(session);
    return {
      all: all.length,
      open: all.filter((p) => p.category === 'open').length,
      active: all.filter((p) => p.category === 'active').length,
      completed: all.filter((p) => p.category === 'completed').length,
    };
  });

  const [iconPass, setIconPass] = useState(0);
  useLayoutEffect(() => { if (iconPass) repaintIcons(); }, [iconPass]);

  // ── Edit modal ─────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const editingTaskId = useRef(null);
  const [errors, setErrors] = useState({ title: '', budget: '' });
  const titleRef = useRef(null);
  const categoryRef = useRef(null);
  const budgetRef = useRef(null);
  const deadlineRef = useRef(null);

  function refreshView() {
    rerender();
    setIconPass((n) => n + 1);
    const all = getProjects(session);
    setCounts({
      all: all.length,
      open: all.filter((p) => p.category === 'open').length,
      active: all.filter((p) => p.category === 'active').length,
      completed: all.filter((p) => p.category === 'completed').length,
    });
  }

  function openEditModal(id) {
    const task = Store.getTaskById(id);
    if (!task) return;
    editingTaskId.current = id;
    titleRef.current.value = task.title || '';
    categoryRef.current.value = task.category || 'Web Development';
    budgetRef.current.value = task.budget || '';
    deadlineRef.current.value = task.deadline || '';
    setModalOpen(true);
  }

  function closeEditModal() {
    setModalOpen(false);
    editingTaskId.current = null;
    setErrors({ title: '', budget: '' });
  }

  function saveEdit() {
    const title = titleRef.current.value.trim();
    const budget = parseFloat(budgetRef.current.value);
    let valid = true;
    const next = { title: '', budget: '' };

    if (!title || title.length < 3) {
      next.title = 'Title must be at least 3 characters.';
      valid = false;
    }
    if (!budget || budget <= 0) {
      next.budget = 'Budget must be a positive number.';
      valid = false;
    }
    setErrors(next);
    if (!valid) return;

    Store.updateTask(editingTaskId.current, {
      title,
      category: categoryRef.current.value,
      budget,
      deadline: deadlineRef.current.value,
      // Status is not editable: it changes through hiring, approval and cancellation.
    });
    closeEditModal();
    refreshView();
    Validate.toast('Project updated successfully.', 'success');
  }

  function deleteTask(id) {
    const task = Store.getTaskById(id);
    if (!task) return;
    if (task.status !== 'open' || task.workerId) {
      Validate.toast('Only open tasks with no assigned worker can be deleted.', 'error');
      return;
    }
    // An open project with nobody hired has never been funded, so deleting
    // it moves no money. The server enforces this and refuses anything else.
    Validate.confirm(`Delete "${task.title}"? Nobody has been hired, so no money is held and nothing is refunded.`, () => {
      const result = Store.deleteTask(id);
      if (!result.ok) {
        Validate.toast(result.message || 'The project could not be deleted.', 'error');
        return;
      }
      refreshView();
      Validate.toast('Project deleted.', 'success');
    });
  }

  function renderCard(p) {
    const actions = p.category === 'open'
      ? (
        <button onClick={(e) => { e.stopPropagation(); go('worker-applications.html'); }} style={actionBtnStyle}>
          <Icon name="users" style={{ width: 14, height: 14 }} />View Proposals
        </button>
      )
      : p.category === 'completed'
        ? (
          <button onClick={(e) => { e.stopPropagation(); go(`project-milestone-board.html?id=${p.id}`); }} style={actionBtnStyle}>
            <Icon name="eye" style={{ width: 14, height: 14 }} />View Details
          </button>
        )
        : (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(`project-milestone-board.html?id=${p.id}`); }} style={actionBtnStyle}>
              <Icon name="layout-list" style={{ width: 14, height: 14 }} />Milestones
            </button>
            <button onClick={(e) => { e.stopPropagation(); go(`project-workroom.html?id=${p.id}`); }} style={actionBtnStyle}>
              <Icon name="message-circle" style={{ width: 14, height: 14 }} />Workroom
            </button>
          </>
        );

    const escrowBg = p.category === 'completed'
      ? { background: '#d1fae5', border: '1px solid #a7f3d0', color: '#047857' }
      : { background: '#dbeafe', border: '1px solid #bfdbfe', color: '#0369a1' };
    const escrowIcon = p.category === 'completed' ? 'check-circle' : 'lock';
    const escrowLabel = p.category === 'completed' ? 'Funds Released' : 'Escrow Locked';

    return (
      <div key={p.id} className="project-card" style={{ display: 'flex', flexDirection: 'column' }} id={`card-${p.id}`}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', flex: 1, marginRight: 12 }}>{p.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={p.status} />
            <button
              onClick={() => openEditModal(p.id)} title="Edit"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted-foreground)', borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <Icon name="pencil" style={{ width: 14, height: 14 }} />
            </button>
            {p.status === 'open' && p.worker === 'Not Assigned' ? (
              <button
                onClick={() => deleteTask(p.id)} title="Delete"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#ef4444', borderRadius: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                <Icon name="trash-2" style={{ width: 14, height: 14 }} />
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.workerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>{p.workerAvatar}</div>
          <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{p.worker}</span>
          {p.auditEnabled ? <A href="client-audit-offers.html" style={{ fontSize: 11, background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 99, fontWeight: 500, marginLeft: 4, textDecoration: 'none' }}>{p.status === 'draft' ? 'Audit pending →' : 'Audit On'}</A> : null}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Milestone Progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{`${p.milestones} completed`}</span>
          </div>
          <div style={{ height: 6, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', width: `${p.progress}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, flex: 1 }}>
          <div style={{ ...escrowBg, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name={escrowIcon} style={{ width: 13, height: 13 }} />{escrowLabel}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.escrow}</div>
          </div>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              <Icon name="calendar" style={{ width: 13, height: 13, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Deadline
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.deadline}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
      </div>
    );
  }

  function renderProjects(cat) {
    const all = getProjects(session);
    const list = cat === 'all' ? all : all.filter((p) => p.category === cat);
    if (!list.length) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="folder-open" style={{ width: 24, height: 24, color: 'var(--muted-foreground)' }} /></div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>Post a task to get started with your first project.</div>
          <A href="post-task.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" style={{ width: 16, height: 16 }} /> Post a Task
          </A>
        </div>
      );
    }
    return <div className="projects-grid">{list.map(renderCard)}</div>;
  }

  const tabs = [
    ['all', `All (${counts.all})`],
    ['open', `Open (${counts.open})`],
    ['active', `Active (${counts.active})`],
    ['completed', `Completed (${counts.completed})`],
  ];

  return (
    <>
      <DashboardLayout
        role="client"
        activePath="client-my-projects.html"
        pageTitle="My Projects"
        pageSubtitle="Manage and track all your active and past projects"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="tab-bar">
            {tabs.map(([cat, label]) => (
              <button key={cat} className={'tab-btn' + (activeTab === cat ? ' active' : '')} onClick={() => { setActiveTab(cat); setIconPass((n) => n + 1); }}>{label}</button>
            ))}
          </div>
          <A href="post-task.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" style={{ width: 16, height: 16 }} /> New Project
          </A>
        </div>
        <div id="projectsContainer">{renderProjects(activeTab)}</div>
      </DashboardLayout>

      {createPortal(
        <div className={'modal-overlay' + (modalOpen ? ' open' : '')} id="editModal" onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="modal">
            <div className="modal-title">Edit Project</div>
            <div className="modal-sub">Update details for this task.</div>
            <div className="modal-field">
              <label>Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" id="editTitle" placeholder="Task title" ref={titleRef} style={errors.title ? { borderColor: '#ef4444' } : undefined} />
              <div id="editTitleErr" style={{ ...errStyle, display: errors.title ? 'block' : 'none' }}>{errors.title}</div>
            </div>
            <div className="modal-field">
              <label>Category</label>
              <select id="editCategory" ref={categoryRef}>
                <option value="Web Development">Web Development</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Backend / API">Backend / API</option>
                <option value="UI/UX Design">UI/UX Design</option>
                <option value="Data Science">Data Science</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="modal-field">
              <label>Budget ($)</label>
              <input type="number" id="editBudget" min="1" placeholder="e.g. 2500" ref={budgetRef} style={errors.budget ? { borderColor: '#ef4444' } : undefined} />
              <div id="editBudgetErr" style={{ ...errStyle, display: errors.budget ? 'block' : 'none' }}>{errors.budget}</div>
            </div>
            <div className="modal-field">
              <label>Deadline</label>
              <input type="date" id="editDeadline" ref={deadlineRef} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel-modal" onClick={closeEditModal}>Cancel</button>
              <button className="btn-save-modal" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
