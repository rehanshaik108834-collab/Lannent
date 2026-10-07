import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './expert-audit-requests.css?inline';

// The API stores 'Pending' / 'In-Progress' / 'Completed'; this screen was
// written against 'Awaiting Review' / 'In Review' / 'Completed', so no row
// ever matched and the Accept button never rendered. Normalise at the boundary.
const UI_STATUS = {
  'preview-sent': 'Awaiting Review',
  negotiating: 'Negotiating',
  agreed: 'Agreed',
  'escrow-funded': 'Ready to start',
  'in-progress': 'In Review',
  'report-submitted': 'In Review',
  paid: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};
const toUiStatus = (s) => UI_STATUS[s] || 'Awaiting Review';

/**
 * A project audit is not finished when the reviewer files their first
 * report — it is finished when every milestone on the project has one.
 * The engagement is priced and paid once, so its lifecycle status turns
 * 'paid' early; reading that as "Completed" hid the milestones still
 * waiting. The server sends the real coverage in `auditProgress`.
 */
function auditUiStatus(a) {
  const lifecycle = toUiStatus(a.status);
  const p = a.auditProgress;
  if (!p || a.kind === 'dispute-audit') return lifecycle;
  // Terminal states are terminal regardless of coverage.
  if (['Declined', 'Cancelled'].includes(lifecycle)) return lifecycle;
  // Before the reviewer has taken the engagement on, nothing has changed.
  if (!['In Review', 'Completed'].includes(lifecycle)) return lifecycle;

  if (p.complete) return 'Completed';
  return p.awaitingReview > 0 ? 'In Review' : 'Awaiting Review';
}

// Build audit requests from store
function getAuditRequests() {
  const session = Auth.getCurrentUser();
  return Store.getAuditRequests()
    // Project audits only — a dispute engagement belongs on Dispute Cases,
    // and used to appear on both pages because kind was never filtered.
    .filter((a) => a.kind !== 'dispute-audit')
    // And only what this reviewer is assigned to, or is still open to them.
    .filter((a) => !a.expertId || a.expertId === session.userId)
    .map((a) => ({
      id: a.id,
      milestoneId: a.milestoneId,
      project: a.project,
      worker: a.worker,
      milestone: a.milestone,
      submitted: a.createdAt,
      status: auditUiStatus(a),
      rawStatus: a.status,
      auditProgress: a.auditProgress || null,
      kind: a.kind,
      agreedAmount: a.agreedAmount,
      priority: a.severity === 'High' ? 'high' : a.severity === 'Low' ? 'low' : 'normal',
      severity: a.severity === 'High' ? 'major' : 'minor',
      severityLabel: a.severity + ' Priority',
      fromStore: true,
    }));
}

function openAudit(id) {
  go(`expert-audit-preview.html?id=${id}`);
}

const severityIcon = {
  critical: 'bug',
  major: 'alert-circle',
  minor: 'alert-triangle',
  suggestion: 'info',
};

const statusClass = {
  'Awaiting Review': 'status-awaiting',
  Negotiating: 'status-awaiting',
  Agreed: 'status-in-review',
  'Ready to start': 'status-in-review',
  'In Review': 'status-in-review',
  Completed: 'status-completed',
  Declined: 'status-completed',
  Cancelled: 'status-completed',
};

function Cards({ list }) {
  if (!list.length) {
    return (
      <div className="audit-empty">
        <Icon name="clipboard-check" style={{ width: 48, height: 48, opacity: 0.35 }} />
        <p>No audit requests found matching your filters.</p>
      </div>
    );
  }

  return list.map((a) => (
    <div key={a.id} className="audit-card">
      {/* top row */}
      <div className="audit-card-top">
        <div className="audit-card-left">
          <div className="audit-card-title-row">
            <span className="audit-card-title">{a.project == null ? '' : String(a.project)}</span>
            <span className={`prio-badge prio-${a.priority}`}>{a.priority.toUpperCase()}</span>
          </div>
          <div className="audit-card-meta">
            <span>
              <Icon name="user" style={{ width: 13, height: 13 }} />
              {`${a.worker}`}
            </span>
            <span>
              <Icon name="calendar" style={{ width: 13, height: 13 }} />
              {`${a.submitted}`}
            </span>
            {a.auditProgress && a.auditProgress.total ? (
              <span title="Milestones on this project that have an audit report">
                <Icon name="check-circle-2" style={{ width: 13, height: 13 }} />
                {`${a.auditProgress.audited} of ${a.auditProgress.total} milestones audited`}
              </span>
            ) : null}
          </div>
        </div>
        <span className={`status-badge ${statusClass[a.status]}`}>{`${a.status}`}</span>
      </div>

      {/* divider + milestone + severity */}
      <div className="audit-card-divider">
        <div className="audit-milestone">Milestone: <strong>{a.milestone == null ? '' : String(a.milestone)}</strong></div>
        <div className={`severity-chip severity-${a.severity}`}>
          <Icon name={severityIcon[a.severity]} style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>{`${a.severity.charAt(0).toUpperCase() + a.severity.slice(1)} — ${a.severityLabel}`}</span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* "Review Deliverable" used to sit here, linking to the client's
            approve/request-changes screen. It was the wrong screen for a
            reviewer, it stayed visible after the report was filed, and its
            form reopened for a milestone that was already audited. Open →
            the engagement's milestone list is the way in now. */}
        {!['paid', 'declined', 'cancelled'].includes(a.rawStatus) ? (
          <button onClick={() => openAudit(a.id)} className="btn-review" style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0' }}>
            <Icon name="eye" style={{ width: 15, height: 15 }} />
            {a.rawStatus === 'in-progress' ? 'Open' : 'Review & quote'}
          </button>
        ) : null}
        {a.rawStatus === 'paid' ? (
          <A href={`expert-report-audit.html?id=${a.id}`} className="btn-review" style={{ background: '#f8f9fb', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
            <Icon name="file-text" style={{ width: 15, height: 15 }} />
            View Report
          </A>
        ) : null}
      </div>
    </div>
  ));
}

const FILTERS = [
  { id: 'filterAll', value: 'all', label: 'All' },
  { id: 'filterAwaiting', value: 'Awaiting Review', label: 'Awaiting' },
  { id: 'filterInReview', value: 'In Review', label: 'In Review' },
  { id: 'filterCompleted', value: 'Completed', label: 'Completed' },
];

export default function ExpertAuditRequests() {
  usePageStyle(css);
  const [auditRequests] = useState(getAuditRequests);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shown, setShown] = useState(auditRequests);

  function filtered(filter, query) {
    return auditRequests.filter((a) => {
      const q = query.toLowerCase();
      const ok = !q || a.project.toLowerCase().includes(q) || a.worker.toLowerCase().includes(q);
      const sf = filter === 'all' || a.status === filter;
      return ok && sf;
    });
  }

  // The original re-rendered the grid from the handler; when filtering threw
  // (a request with no worker name), the grid simply kept its previous cards.
  function render(filter, query) {
    let list;
    try {
      list = filtered(filter, query);
    } catch (err) {
      setTimeout(() => { throw err; });
      return;
    }
    setShown(list);
  }

  function setFilter(val) {
    setActiveFilter(val);
    render(val, searchQuery);
  }

  function handleSearch(val) {
    setSearchQuery(val);
    render(activeFilter, val);
  }

  const totalRequests = auditRequests.length;
  const pendingCount = auditRequests.filter((a) => !['Completed', 'Declined', 'Cancelled'].includes(a.status)).length;
  const inReviewCount = auditRequests.filter((a) => a.status === 'In Review' || a.status === 'Ready to start').length;
  const doneCount = auditRequests.filter((a) => a.status === 'Completed').length;

  return (
    <DashboardLayout
      role="expert"
      activePath="expert-audit-requests.html"
      pageTitle="Audit Requests"
      pageSubtitle="Review technical deliverables and ensure code quality standards."
    >
      {/* Stats row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div>
            <div className="stat-val">{totalRequests}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}>
            <Icon name="clipboard-list" style={{ width: 20, height: 20, color: '#a855f7' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{pendingCount}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#fff7ed' }}>
            <Icon name="clock" style={{ width: 20, height: 20, color: '#f97316' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{inReviewCount}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#eff6ff' }}>
            <Icon name="loader" style={{ width: 20, height: 20, color: '#6366f1' }} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-val">{doneCount}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}>
            <Icon name="check-circle-2" style={{ width: 20, height: 20, color: '#10b981' }} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="audit-toolbar">
        <div className="audit-search-wrap">
          <Icon name="search" style={{ width: 15, height: 15 }} />
          <input
            className="audit-search"
            type="text"
            id="auditSearch"
            placeholder="Search by project or worker..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {FILTERS.map((f) => (
          <button key={f.id} className={'filter-btn' + (activeFilter === f.value ? ' active' : '')} id={f.id} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {/* Card grid */}
      <div className="audit-grid" id="auditGrid">
        <Cards list={shown} />
      </div>
    </DashboardLayout>
  );
}
