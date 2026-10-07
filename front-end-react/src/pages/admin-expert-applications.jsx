import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { usePageStyle } from '../lib/hooks';
import css from './admin-expert-applications.css?inline';

const avatarColors = [
  'linear-gradient(135deg,#6366f1,#4f46e5)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
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

/**
 * One document on an application. A reference means the file is in the
 * store and the reviewer can open it; a bare name is an application filed
 * before the store existed, when only the name was kept.
 */
function DocRow({ label, fileRef, name }) {
  const shown = (fileRef && fileRef.name) || name;
  if (!shown) return null;
  const href = fileRef ? Store.fileUrl(fileRef) : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ color: 'var(--muted-foreground)', minWidth: 78 }}>{label}</span>
      <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown}</strong>
      {href
        ? <a href={href} download={shown} style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', whiteSpace: 'nowrap' }}>Download</a>
        : <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }} title="Filed before the platform stored documents.">Not stored</span>}
    </div>
  );
}

function Cards({ list, renderN, onDetails, onAction }) {
  if (!list.length) {
    return (
      <div className="empty-state">
        <Icon name="shield-check" style={{ width: 48, height: 48, opacity: 0.35 }} />
        <p>No expert applications found matching your filters.</p>
      </div>
    );
  }

  return list.map((a, i) => {
    const initials = getInitials(a.name);
    const color = avatarColors[i % avatarColors.length];
    const isPending = a.status === 'pending';
    // Keyed by render pass: the original rebuilt the list's innerHTML, so the
    // cards' fade-in animation replayed on every search, filter and decision.
    return (
      <div className="app-card" id={`acard-${a.id}`} key={`${renderN}-${a.id}`}>
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
            <button className="btn-details" onClick={() => onDetails(a.id)}>
              <Icon name="eye" style={{ width: 12, height: 12 }} /> Details
            </button>
            {isPending ? (
              <>
                <button className="btn-approve" onClick={() => onAction(a.id, 'approved')}>
                  <Icon name="check" style={{ width: 12, height: 12 }} /> Approve
                </button>
                <button className="btn-reject" onClick={() => onAction(a.id, 'rejected')}>
                  <Icon name="x" style={{ width: 12, height: 12 }} /> Reject
                </button>
              </>
            ) : a.reviewedAt ? <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{`Reviewed ${a.reviewedAt}`}</span> : null}
          </div>
        </div>
      </div>
    );
  });
}

function DetailContent({ app, onClose, onAction }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Application Details</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
          <Icon name="x" style={{ width: 20, height: 20 }} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div className="app-avatar" style={{ background: avatarColors[0], width: 52, height: 52, fontSize: 16 }}>{getInitials(app.name)}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{app.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{app.email}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}><StatusBadge status={app.status} /></div>
      </div>
      <div className="detail-grid">
        <div className="detail-field">
          <div className="detail-label">Phone</div>
          <div className="detail-value">{`${app.phoneCountry || ''} ${app.phone || 'N/A'}`}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">Country</div>
          <div className="detail-value">{app.country || 'N/A'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">Primary Expertise</div>
          <div className="detail-value">{app.expertise || 'N/A'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">Experience</div>
          <div className="detail-value">{`${app.experience || 'N/A'} years`}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">LinkedIn</div>
          <div className="detail-value">{app.linkedin ? <a href={app.linkedin} target="_blank">{app.linkedin}</a> : 'N/A'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">GitHub</div>
          <div className="detail-value">{app.github ? <a href={app.github} target="_blank">{app.github}</a> : 'N/A'}</div>
        </div>
      </div>
      <div className="detail-field" style={{ marginTop: 6 }}>
        <div className="detail-label">Documents</div>
        <div className="detail-value" style={{ fontWeight: 400, fontSize: 13 }}>
          {(app.resumeName || app.resumeFile || app.certificateFile)
            ? <><DocRow label="Résumé" fileRef={app.resumeFile} name={app.resumeName} /><DocRow label="Certificate" fileRef={app.certificateFile} name={app.certificateName} /></>
            : 'No documents recorded with this application.'}
        </div>
      </div>
      <div className="detail-field" style={{ marginTop: 6 }}>
        <div className="detail-label">Motivation</div>
        <div className="detail-value" style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-foreground)', fontWeight: 400 }}>{app.motivation || 'No motivation provided.'}</div>
      </div>
      <div className="detail-grid" style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div className="detail-field">
          <div className="detail-label">Applied On</div>
          <div className="detail-value">{app.appliedAt || 'N/A'}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">Reviewed On</div>
          <div className="detail-value">{app.reviewedAt || 'Not yet reviewed'}</div>
        </div>
      </div>
      {app.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn-approve" style={{ flex: 1, justifyContent: 'center', height: 40, fontSize: 14 }} onClick={() => { onClose(); onAction(app.id, 'approved'); }}>
            <Icon name="check" style={{ width: 14, height: 14 }} /> Approve Application
          </button>
          <button className="btn-reject" style={{ flex: 1, justifyContent: 'center', height: 40, fontSize: 14 }} onClick={() => { onClose(); onAction(app.id, 'rejected'); }}>
            <Icon name="x" style={{ width: 14, height: 14 }} /> Reject Application
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function AdminExpertApplications() {
  usePageStyle(css);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Bumped wherever the original called render().
  const [renderN, setRenderN] = useState(0);
  const render = () => setRenderN((n) => n + 1);

  // The modals kept their last content after closing; so do these.
  const [confirmShow, setConfirmShow] = useState(false);
  const [confirm, setConfirm] = useState({ title: 'Confirm Action', text: 'Are you sure?', btnLabel: 'Confirm', btnClass: 'confirm-btn' });
  const [pendingAction, setPendingAction] = useState(null);
  const [detailShow, setDetailShow] = useState(false);
  const [detailApp, setDetailApp] = useState(null);

  const all = getApps();
  const list = all.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.expertise || '').toLowerCase().includes(q);
    const matchesFilter = activeFilter === 'all' || a.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  // ── Confirm / Execute ──
  const confirmAction = (appId, status) => {
    setPendingAction({ appId, status });
    const app = Store.getExpertApplicationById(appId);
    const isApprove = status === 'approved';
    setConfirm({
      title: isApprove ? 'Approve Application' : 'Reject Application',
      text: isApprove
        ? <>Are you sure you want to <strong>approve</strong> <strong>{app?.name ?? ''}</strong>&apos;s application? This will create an expert account and allow them to log in.</>
        : <>Are you sure you want to <strong>reject</strong> <strong>{app?.name ?? ''}</strong>&apos;s application? They will not be able to log in as an expert reviewer.</>,
      btnLabel: isApprove ? 'Approve' : 'Reject',
      btnClass: 'confirm-btn ' + (isApprove ? 'confirm-btn-approve' : 'confirm-btn-reject'),
    });
    setConfirmShow(true);
  };

  const closeConfirm = () => {
    setConfirmShow(false);
    setPendingAction(null);
  };

  const executeAction = () => {
    if (!pendingAction) return;
    const { appId, status } = pendingAction;
    const result = Store.updateExpertApplicationStatus(appId, status);
    closeConfirm();
    if (!result.ok) {
      // Nothing changed on the server: no account, application still pending.
      Validate.toast(result.message || 'The decision could not be saved.', 'error');
      return;
    }
    render();

    // Toast
    const app = Store.getExpertApplicationById(appId);
    const msg = status === 'approved'
      ? `✓ ${app?.name ?? ''}'s application approved. Expert account created.`
      : `✗ ${app?.name ?? ''}'s application rejected.`;
    Validate.toast(msg, status === 'approved' ? 'success' : 'error');
  };

  // ── Detail modal ──
  const showDetails = (appId) => {
    const app = Store.getExpertApplicationById(appId);
    if (!app) return;
    setDetailApp({ ...app });
    setDetailShow(true);
  };
  const closeDetails = () => setDetailShow(false);

  return (
    <DashboardLayout
      role={(Auth.getCurrentUser() || {}).role}
      activePath="admin-expert-applications.html"
      pageTitle="Expert Applications"
      pageSubtitle="Review and manage expert reviewer applications."
    >
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
          <input
            className="app-search" type="text" id="appSearch" placeholder="Search by name, email or expertise..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); render(); }}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={'filter-pill' + (activeFilter === f.key ? ' active' : '')}
            data-filter={f.key}
            onClick={() => { setActiveFilter(f.key); render(); }}
          >
            {f.key === 'all' ? <>All <span id="filteredCount" style={{ marginLeft: 4, opacity: 0.7 }}>{list.length}</span></> : f.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div id="appsList"><Cards list={list} renderN={renderN} onDetails={showDetails} onAction={confirmAction} /></div>

      {/* Confirmation Modal */}
      <div className={'confirm-overlay' + (confirmShow ? ' show' : '')} id="confirmModal" onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}>
        <div className="confirm-card">
          <div className="confirm-title" id="confirmTitle">{confirm.title}</div>
          <div className="confirm-text" id="confirmText">{confirm.text}</div>
          <div className="confirm-actions">
            <button className="confirm-btn confirm-btn-cancel" onClick={closeConfirm}>Cancel</button>
            <button className={confirm.btnClass} id="confirmBtn" onClick={executeAction}>{confirm.btnLabel}</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <div className={'detail-overlay' + (detailShow ? ' show' : '')} id="detailModal" onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}>
        <div className="detail-card" id="detailContent">
          {detailApp ? <DetailContent app={detailApp} onClose={closeDetails} onAction={confirmAction} /> : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
