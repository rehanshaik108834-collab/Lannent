import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { getParam, usePageStyle } from '../lib/hooks';
import css from './milestone-reports.css?inline';

// ── Data — merged from store + static ──

function getReports(taskId) {
  // Pull real audit reports from store
  let storeReports = Store.getAuditReports()
    .filter((r) => r.createdAt) // only submitted reports
    .map((r) => ({
      id: r.id,
      milestoneName: r.milestoneTitle || 'Milestone',
      milestoneId: r.milestoneId,
      taskId: r.taskId,
      type: 'technical-audit',
      reviewer: Store.getUserById(r.expertId)?.name || 'Expert Reviewer',
      reviewerInitials: Store.getUserById(r.expertId)?.avatar || 'ER',
      reviewerColor: Store.getUserById(r.expertId)?.avatarColor || 'linear-gradient(135deg,#a855f7,#7c3aed)',
      date: r.createdAt,
      status: r.verdict === 'pass' ? 'completed' : r.verdict === 'fail' ? 'failed' : 'pending',
      verdict: r.verdict,
      findings: r.findings,
      project: r.projectTitle,
      workerName: r.workerName,
      viewUrl: 'expert-report-audit.html?id=' + r.auditRequestId,
      fromStore: true,
    }));

  // Pull disputes from store
  let storeDisputes = Store.getDisputes()
    .map((d) => ({
      id: d.id,
      milestoneName: d.milestone || 'Project Dispute',
      milestoneId: d.milestoneId,
      taskId: d.taskId,
      type: 'dispute-resolution',
      reviewer: Store.getUserById(d.expertId)?.name || 'Expert Reviewer',
      reviewerInitials: Store.getUserById(d.expertId)?.avatar || 'ER',
      reviewerColor: 'linear-gradient(135deg,#f59e0b,#d97706)',
      date: d.createdAt,
      status: d.status === 'resolved' ? 'completed' : d.status === 'open' ? 'in-progress' : 'pending',
      verdict: d.verdict,
      findings: d.resolution,
      project: d.project,
      workerName: d.againstName,
      viewUrl: 'expert-report-dispute.html?id=' + d.id,
      fromStore: true,
    }));

  // ── PROJECT-LEVEL FILTERING ──
  // If a taskId is specified, get the milestones for that task and only show reports/disputes matching them
  if (taskId) {
    const taskMilestones = Store.getMilestonesByTask(taskId);
    const milestoneIds = new Set(taskMilestones.map((m) => m.id));

    storeReports = storeReports.filter((r) => r.taskId === taskId || milestoneIds.has(r.milestoneId));
    storeDisputes = storeDisputes.filter((d) => d.taskId === taskId || milestoneIds.has(d.milestoneId));

    // When filtered by project, don't mix in unrelated static reports
    return [...storeReports, ...storeDisputes];
  }

  // No project filter: merge store + static data
  return [...storeReports, ...storeDisputes];
}

const VERDICT_MAP = {
  pass: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', label: 'Passed audit' },
  fail: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', label: 'Failed audit' },
  conditional: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', label: 'Passed with conditions' },
  'worker-favour': { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', label: 'Resolved for the worker' },
  'client-favour': { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Resolved for the client' },
  split: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', label: 'Split decision' },
};

/** The outcome, stated plainly — a client should not have to open the report to see it. */
function VerdictChip({ r }) {
  const v = VERDICT_MAP[r.verdict];
  if (!v) {
    return (
      <div className="report-verdict" style={{ background: 'var(--secondary)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
        {r.type === 'dispute-resolution' ? 'Awaiting a verdict' : 'Awaiting review'}
      </div>
    );
  }
  return <div className="report-verdict" style={{ background: v.bg, borderColor: v.border, color: v.text }}>{v.label}</div>;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Decodes the escaped text the original handed to innerHTML back into what it displayed. */
function decodeEntities(s) {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

/** A readable opening of the reviewer's reasoning, not the whole report. */
/** Trims a report finding for a card. Escapes, because the text is the
 *  reviewer's free prose being rendered to the client and the worker. */
function excerpt(text, max = 160) {
  // The original measured and cut the escaped text, then let the browser
  // display it; the same cut is made here and decoded for display.
  const t = escapeHtml(String(text || '').trim());
  if (t.length <= max) return decodeEntities(t);
  const cut = t.slice(0, max);
  const stop = cut.lastIndexOf(' ');
  return decodeEntities((stop > 60 ? cut.slice(0, stop) : cut) + '…');
}

/** Store dates are ISO slices; the cards read better in the page's format. */
function fmtDate(d) {
  if (!d) return 'Unknown date';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusConfig(status) {
  switch (status) {
    case 'completed': return { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', dot: '#10b981', label: 'Completed' };
    case 'in-progress': return { bg: '#eff6ff', border: '#bae6fd', text: '#0284c7', dot: '#38bdf8', label: 'In Progress' };
    case 'failed': return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444', label: 'Failed' };
    case 'pending': return { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#f59e0b', label: 'Pending' };
    default: return { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', label: status };
  }
}

function typeConfig(type) {
  if (type === 'technical-audit') {
    return { bg: '#eff6ff', color: '#2563eb', icon: 'file-search', label: 'Technical Audit Report' };
  }
  return { bg: '#fff7ed', color: '#ea580c', icon: 'alert-triangle', label: 'Dispute Resolution Report' };
}

const TYPE_FILTERS = [
  { val: 'all', icon: 'layout-grid', label: 'All Types' },
  { val: 'technical-audit', icon: 'file-search', label: 'Technical Audit' },
  { val: 'dispute-resolution', icon: 'alert-triangle', label: 'Dispute Resolution' },
];

export default function MilestoneReports() {
  usePageStyle(css);
  const taskId = getParam('taskId') || null;
  const role = getParam('role') || 'client';

  const [REPORTS] = useState(() => getReports(taskId));
  const [activeTypeFilter, setActiveTypeFilter] = useState('all');
  const [activeMilestoneFilter, setActiveMilestoneFilter] = useState('all');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg, type = 'success') => {
    const bg = type === 'success' ? '#10b981' : type === 'info' ? '#6366f1' : '#ef4444';
    setToast({ msg, bg, id: Date.now() + Math.random() });
  };

  // Resolve project name for subtitle
  let projectName = 'All Projects';
  if (taskId) {
    const task = Store.getTaskById(taskId);
    if (task) projectName = task.title;
  }

  const backUrl = role === 'worker'
    ? 'worker-milestone-board.html' + (taskId ? '?id=' + taskId : '')
    : 'project-milestone-board.html' + (taskId ? '?id=' + taskId : '');

  // Build unique milestone names for filter
  const milestoneNames = [...new Set(REPORTS.map((r) => r.milestoneName))];

  const list = REPORTS.filter((r) => {
    if (activeTypeFilter !== 'all' && r.type !== activeTypeFilter) return false;
    if (activeMilestoneFilter !== 'all' && r.milestoneName !== activeMilestoneFilter) return false;
    return true;
  });

  const completed = list.filter((r) => r.status === 'completed').length;
  const inProgress = list.filter((r) => r.status === 'in-progress').length;
  const audits = list.filter((r) => r.type === 'technical-audit').length;

  return (
    <DashboardLayout
      role={role}
      activePath={role === 'worker' ? 'worker-milestone-board.html' : 'client-my-projects.html'}
      pageTitle="Milestone Reports"
      pageSubtitle={projectName}
    >
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <A
          href={backUrl}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> Milestone Board
        </A>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>Milestone Reports</span>
      </div>

      {/* Summary stats */}
      <div className="reports-summary">
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#eef2ff' }}>
            <Icon name="file-text" style={{ width: 18, height: 18, color: '#6366f1' }} />
          </div>
          <div>
            <div className="summary-val" id="sum-total">{list.length}</div>
            <div className="summary-label">Total Reports</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#ecfdf5' }}>
            <Icon name="check-circle" style={{ width: 18, height: 18, color: '#10b981' }} />
          </div>
          <div>
            <div className="summary-val" style={{ color: '#10b981' }} id="sum-done">{completed}</div>
            <div className="summary-label">Completed</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#eff6ff' }}>
            <Icon name="loader" style={{ width: 18, height: 18, color: '#2563eb' }} />
          </div>
          <div>
            <div className="summary-val" style={{ color: '#2563eb' }} id="sum-prog">{inProgress}</div>
            <div className="summary-label">In Progress</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon" style={{ background: '#fff7ed' }}>
            <Icon name="file-search" style={{ width: 18, height: 18, color: '#ea580c' }} />
          </div>
          <div>
            <div className="summary-val" id="sum-audit">{audits}</div>
            <div className="summary-label">Audit Reports</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Icon name="sliders-horizontal" style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Filters</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Type filter buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.val}
                className={'filter-btn type-filter-btn' + (activeTypeFilter === f.val ? ' active' : '')}
                data-val={f.val}
                onClick={() => setActiveTypeFilter(f.val)}
              >
                <Icon name={f.icon} style={{ width: 13, height: 13 }} />{` ${f.label}`}
              </button>
            ))}
          </div>

          {/* Milestone select */}
          <div className="select-wrap" style={{ marginLeft: 'auto' }}>
            <select value={activeMilestoneFilter} onChange={(e) => setActiveMilestoneFilter(e.target.value)}>
              <option value="all">All Milestones</option>
              {milestoneNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Icon name="chevron-down" className="chev" style={{ width: 14, height: 14 }} />
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div className="section-header">
        <span className="section-title">
          Reports <span className="count-badge" id="reports-count">{list.length}</span>
        </span>
      </div>
      <div id="reports-list">
        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <Icon name="file-text" style={{ width: 24, height: 24, color: 'var(--muted-foreground)' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No reports found</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Try adjusting your filters to see more results.</p>
          </div>
        ) : list.map((r, i) => {
          const sc = statusConfig(r.status);
          const tc = typeConfig(r.type);
          return (
            <div key={r.type + r.id} className="report-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="report-left">
                <div className="report-type-icon" style={{ background: tc.bg }}>
                  <Icon name={tc.icon} style={{ width: 18, height: 18, color: tc.color }} />
                </div>
                <div className="report-info">
                  <div className="report-milestone-name">{r.milestoneName}</div>
                  <div className="report-type-label">
                    {`${tc.label}${r.project ? '  ·  ' + r.project : ''}  ·  `}<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.id}</span>
                  </div>
                  <VerdictChip r={r} />
                  {r.findings ? <div className="report-findings">{excerpt(r.findings)}</div> : null}
                  <div className="report-meta-row">
                    <span className="status-pill" style={{ background: sc.bg, borderColor: sc.border, color: sc.text }}>
                      <span className="status-dot" style={{ background: sc.dot }} />
                      {sc.label}
                    </span>
                    <div className="report-meta-item">
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: r.reviewerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{r.reviewerInitials}</div>
                      <strong>{r.reviewer}</strong>
                    </div>
                    {r.workerName ? (
                      <div className="report-meta-item">
                        <Icon name="user" style={{ width: 13, height: 13 }} />
                        <strong>{r.workerName}</strong>
                      </div>
                    ) : null}
                    <div className="report-meta-item">
                      <Icon name="calendar" style={{ width: 13, height: 13 }} />
                      <strong>{fmtDate(r.date)}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="report-actions">
                <A href={r.viewUrl + (r.viewUrl.includes('?') ? '&' : '?') + 'role=' + role} className="btn-view">
                  <Icon name="eye" style={{ width: 14, height: 14 }} />
                  View Report
                </A>
                <button className="btn-download" onClick={() => showToast('Downloading PDF…', 'info')}>
                  <Icon name="download" style={{ width: 14, height: 14 }} />
                  Download PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {toast ? (
        <div key={toast.id} style={{ position: 'fixed', bottom: 24, right: 24, background: toast.bg, color: 'white', padding: '14px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', animation: 'fadeUp 0.4s ease' }}>{toast.msg}</div>
      ) : null}
    </DashboardLayout>
  );
}
