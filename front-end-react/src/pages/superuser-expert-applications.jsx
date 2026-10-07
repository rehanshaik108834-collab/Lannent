import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './superuser-expert-applications.css?inline';

const avatarColors = [
  'linear-gradient(135deg,#6366f1,#4f46e5)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
];

function getApps() {
  const apps = Store.getExpertApplications();
  // Sort by newest first
  return apps.sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
}

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function StatusBadge({ status }) {
  const cls = status === 'pending' ? 'sb-pending' : status === 'approved' ? 'sb-approved' : 'sb-rejected';
  const dot = status === 'pending' ? 'sd-pending' : status === 'approved' ? 'sd-approved' : 'sd-rejected';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-badge ${cls}`}><span className={`status-dot ${dot}`} />{label}</span>;
}

export default function SuperuserExpertApplications() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Each render() in the original rebuilt the list's innerHTML, so the cards
  // were new elements (and replayed their entrance animation) every time.
  const [renderGen, setRenderGen] = useState(0);
  const render = () => setRenderGen((g) => g + 1);

  // Confirmation modal
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState({ title: 'Confirm Action', text: 'Are you sure?', btnText: 'Confirm', btnClass: 'confirm-btn' });

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const all = getApps();
  const q = searchQuery.toLowerCase();
  const list = all.filter((a) => {
    const matchesSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.expertise || '').toLowerCase().includes(q);
    const matchesFilter = activeFilter === 'all' || a.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  // ── Confirm / Execute ──
  function confirmAction(appId, status) {
    setPendingAction({ appId, status });
    const app = Store.getExpertApplicationById(appId);
    const isApprove = status === 'approved';
    setConfirm({
      title: isApprove ? 'Approve Application' : 'Reject Application',
      text: isApprove
        ? <>Are you sure you want to <strong>approve</strong> <strong>{`${app?.name}`}</strong>&apos;s application? This will create an expert account and allow them to log in.</>
        : <>Are you sure you want to <strong>reject</strong> <strong>{`${app?.name}`}</strong>&apos;s application? They will not be able to log in as an expert reviewer.</>,
      btnText: isApprove ? 'Approve' : 'Reject',
      btnClass: 'confirm-btn ' + (isApprove ? 'confirm-btn-approve' : 'confirm-btn-reject'),
    });
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setPendingAction(null);
  }

  function executeAction() {
    if (!pendingAction) return;
    const { appId, status } = pendingAction;
    Store.updateExpertApplicationStatus(appId, status, session?.userId || 'u4');
    closeConfirm();
    render();

    // Toast
    const app = Store.getExpertApplicationById(appId);
    const msg = status === 'approved'
      ? `✓ ${app?.name}'s application approved. Expert account created.`
      : `✗ ${app?.name}'s application rejected.`;
    Validate.toast(msg, status === 'approved' ? 'success' : 'error');
  }

  // ── Detail modal ──
  function showDetails(appId) {
    const app = Store.getExpertApplicationById(appId);
    if (!app) return;
    setDetailId(appId);
    setDetailOpen(true);
  }

  function closeDetails() {
    setDetailOpen(false);
  }

  const detailApp = detailId ? Store.getExpertApplicationById(detailId) : null;

  return (
    <DashboardLayout role="superuser" activePath="superuser-expert-applications.html" pageTitle="Expert Applications" pageSubtitle="Review and manage expert reviewer applications.">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div><div className="stat-val" id="statTotal">{all.length}</div><div className="stat-label">Total Applications</div></div>
          <div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="file-text" style={{ width: 20, height: 20, color: '#6366f1' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" id="statPending" style={{ color: '#f59e0b' }}>{all.filter((a) => a.status === 'pending').length}</div><div className="stat-label">Pending Review</div></div>
          <div className="stat-icon-wrap" style={{ background: '#fffbeb' }}><Icon name="clock" style={{ width: 20, height: 20, color: '#f59e0b' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" id="statApproved" style={{ color: '#10b981' }}>{all.filter((a) => a.status === 'approved').length}</div><div className="stat-label">Approved</div></div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" id="statRejected" style={{ color: '#ef4444' }}>{all.filter((a) => a.status === 'rejected').length}</div><div className="stat-label">Rejected</div></div>
          <div className="stat-icon-wrap" style={{ background: '#fef2f2' }}><Icon name="x-circle" style={{ width: 20, height: 20, color: '#ef4444' }} /></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="app-toolbar">
        <div className="app-search-wrap">
          <Icon name="search" style={{ width: 15, height: 15 }} />
          <input className="app-search" type="text" id="appSearch" placeholder="Search by name, email or expertise..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); render(); }} />
        </div>
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button key={f} className={'filter-pill' + (activeFilter === f ? ' active' : '')} data-filter={f} onClick={() => { setActiveFilter(f); render(); }}>
            {f === 'all' ? <>All <span id="filteredCount" style={{ marginLeft: 4, opacity: 0.7 }}>{list.length}</span></> : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div id="appsList">
        {!list.length ? (
          <div className="empty-state" key={`empty-${renderGen}`}>
            <Icon name="shield-check" style={{ width: 48, height: 48, opacity: 0.35 }} />
            <p>No expert applications found matching your filters.</p>
          </div>
        ) : list.map((a, i) => {
          const initials = getInitials(a.name);
          const color = avatarColors[i % avatarColors.length];
          const isPending = a.status === 'pending';
          return (
            <div className="app-card" id={`acard-${a.id}`} key={`${a.id}-${renderGen}`}>
              <div className="app-avatar" style={{ background: color }}>{initials}</div>
              <div className="app-info">
                <div className="app-name">{a.name}</div>
                <div className="app-email">{a.email}</div>
                <div className="app-meta">
                  <span className="app-meta-item">
                    <Icon name="briefcase" style={{ width: 12, height: 12 }} />
                    <strong>{a.expertise || 'N/A'}</strong>
                  </span>
                  <span className="app-meta-item">
                    <Icon name="clock" style={{ width: 12, height: 12 }} />
                    <strong>{`${a.experience || 'N/A'} years`}</strong>
                  </span>
                  <span className="app-meta-item">
                    <Icon name="globe" style={{ width: 12, height: 12 }} />
                    <strong>{a.country || 'N/A'}</strong>
                  </span>
                  <span className="app-meta-item">
                    <Icon name="calendar" style={{ width: 12, height: 12 }} />
                    Applied: <strong>{a.appliedAt || 'N/A'}</strong>
                  </span>
                </div>
              </div>
              <div className="app-right">
                <StatusBadge status={a.status} />
                <div className="app-actions">
                  <button className="btn-details" onClick={() => showDetails(a.id)}>
                    <Icon name="eye" style={{ width: 12, height: 12 }} /> Details
                  </button>
                  {isPending ? (
                    <>
                      <button className="btn-approve" onClick={() => confirmAction(a.id, 'approved')}>
                        <Icon name="check" style={{ width: 12, height: 12 }} /> Approve
                      </button>
                      <button className="btn-reject" onClick={() => confirmAction(a.id, 'rejected')}>
                        <Icon name="x" style={{ width: 12, height: 12 }} /> Reject
                      </button>
                    </>
                  ) : a.reviewedAt ? <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{`Reviewed ${a.reviewedAt}`}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <div className={'confirm-overlay' + (confirmOpen ? ' show' : '')} id="confirmModal" onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}>
        <div className="confirm-card">
          <div className="confirm-title" id="confirmTitle">{confirm.title}</div>
          <div className="confirm-text" id="confirmText">{confirm.text}</div>
          <div className="confirm-actions">
            <button className="confirm-btn confirm-btn-cancel" onClick={closeConfirm}>Cancel</button>
            <button className={confirm.btnClass} id="confirmBtn" onClick={executeAction}>{confirm.btnText}</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <div className={'detail-overlay' + (detailOpen ? ' show' : '')} id="detailModal" onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}>
        <div className="detail-card" id="detailContent">
          {detailApp ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>Application Details</h3>
                <button onClick={closeDetails} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
                  <Icon name="x" style={{ width: 20, height: 20 }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div className="app-avatar" style={{ background: avatarColors[0], width: 52, height: 52, fontSize: 16 }}>{getInitials(detailApp.name)}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{detailApp.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{detailApp.email}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}><StatusBadge status={detailApp.status} /></div>
              </div>
              <div className="detail-grid">
                <div className="detail-field">
                  <div className="detail-label">Phone</div>
                  <div className="detail-value">{`${detailApp.phoneCountry || ''} ${detailApp.phone || 'N/A'}`}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">Country</div>
                  <div className="detail-value">{detailApp.country || 'N/A'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">Primary Expertise</div>
                  <div className="detail-value">{detailApp.expertise || 'N/A'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">Experience</div>
                  <div className="detail-value">{`${detailApp.experience || 'N/A'} years`}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">LinkedIn</div>
                  <div className="detail-value">{detailApp.linkedin ? <a href={detailApp.linkedin} target="_blank">{detailApp.linkedin}</a> : 'N/A'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">GitHub</div>
                  <div className="detail-value">{detailApp.github ? <a href={detailApp.github} target="_blank">{detailApp.github}</a> : 'N/A'}</div>
                </div>
              </div>
              <div className="detail-field" style={{ marginTop: 6 }}>
                <div className="detail-label">Motivation</div>
                <div className="detail-value" style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-foreground)', fontWeight: 400 }}>{detailApp.motivation || 'No motivation provided.'}</div>
              </div>
              <div className="detail-grid" style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div className="detail-field">
                  <div className="detail-label">Applied On</div>
                  <div className="detail-value">{detailApp.appliedAt || 'N/A'}</div>
                </div>
                <div className="detail-field">
                  <div className="detail-label">Reviewed On</div>
                  <div className="detail-value">{detailApp.reviewedAt || 'Not yet reviewed'}</div>
                </div>
              </div>
              {detailApp.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button className="btn-approve" style={{ flex: 1, justifyContent: 'center', height: 40, fontSize: 14 }} onClick={() => { closeDetails(); confirmAction(detailApp.id, 'approved'); }}>
                    <Icon name="check" style={{ width: 14, height: 14 }} /> Approve Application
                  </button>
                  <button className="btn-reject" style={{ flex: 1, justifyContent: 'center', height: 40, fontSize: 14 }} onClick={() => { closeDetails(); confirmAction(detailApp.id, 'rejected'); }}>
                    <Icon name="x" style={{ width: 14, height: 14 }} /> Reject Application
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
