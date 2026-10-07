import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './expert-dispute-cases.css?inline';

const severityIconClass = { high: 'severity-icon-high', medium: 'severity-icon-medium', low: 'severity-icon-low' };

function loadDisputes() {
  const session = Auth.getCurrentUser();
  return Store.getDisputes()
    .filter((d) => !d.expertId || d.expertId === session.userId)
    .map((d) => {
      const task = Store.getTaskById(d.taskId);
      const raiser = Store.getUserById(d.raisedBy);
      return {
        id: d.id,
        project: d.project || (task ? task.title : 'Unknown Project'),
        milestone: d.milestone || 'Milestone',
        issue: d.reason ? d.reason.substring(0, 80) + (d.reason.length > 80 ? '...' : '') : 'Dispute raised',
        raisedBy: (raiser ? raiser.name : d.raisedByName || 'Unknown') + ' (' + (raiser ? raiser.role : 'user') + ')',
        status: d.status === 'open' ? 'Open' : d.status === 'resolved' ? 'Resolved' : 'Under Investigation',
        rawStatus: d.status,
        severity: d.severity || 'medium',
        date: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
        amount: d.amount || '',
      };
    });
}

// A dispute is arbitrated through a priced engagement: preview the
// claim, agree a fee, and only then resolve it.
function CardAction({ d }) {
  if (d.rawStatus === 'resolved') {
    return (
      <A href={`expert-report-dispute.html?id=${d.id}`} className="btn-resolve">
        <Icon name="file-text" style={{ width: 15, height: 15 }} />View Resolution
      </A>
    );
  }
  const eng = (Store.getAuditRequests() || []).find((a) => a.disputeId === d.id);
  if (!eng || eng.status === 'in-progress') {
    return (
      <A href={`resolve-dispute.html?id=${d.id}`} className="btn-resolve">
        <Icon name="shield" style={{ width: 15, height: 15 }} />Resolve Dispute
      </A>
    );
  }
  return (
    <A href={`expert-audit-preview.html?id=${eng.id}`} className="btn-resolve">
      <Icon name="eye" style={{ width: 15, height: 15 }} />Review &amp; quote
    </A>
  );
}

function Cards({ list }) {
  if (!list.length) {
    return (
      <div className="dispute-empty">
        <Icon name="scale" style={{ width: 48, height: 48, opacity: 0.35 }} />
        <p>No dispute cases found matching your filters.</p>
      </div>
    );
  }
  return list.map((d) => (
    <div key={d.id} className="dispute-card" id={`dcard-${d.id}`}>
      <div className="dispute-card-top">
        <div className="dispute-card-left">
          <div className="dispute-title-row">
            <span className="dispute-title">{d.project}</span>
            <Icon name="alert-triangle" style={{ width: 16, height: 16, flexShrink: 0 }} className={severityIconClass[d.severity] || 'severity-icon-medium'} />
          </div>
          <div className="dispute-meta">{`Milestone: ${d.milestone}`}</div>
          <div className="dispute-issue">{d.issue}</div>
          <div className="dispute-footer-row">
            <span>{`Raised by: ${d.raisedBy}`}</span>
            <span className="dot" />
            <span>{d.date}</span>
            {d.amount ? <><span className="dot" /><span style={{ fontWeight: 600, color: '#6366f1' }}>{`${d.amount} escrow`}</span></> : null}
          </div>
        </div>
        <span className={`status-badge ${d.rawStatus === 'resolved' ? 'status-resolved' : d.rawStatus === 'open' ? 'status-open' : 'status-investigating'}`}>{d.status}</span>
      </div>
      <CardAction d={d} />
    </div>
  ));
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'Under Investigation', label: 'Investigating' },
  { value: 'Resolved', label: 'Resolved' },
];

export default function ExpertDisputeCases() {
  usePageStyle(css);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const all = loadDisputes();
  const filtered = all.filter((d) => {
    const q = searchQuery.toLowerCase();
    const ok = !q || d.project.toLowerCase().includes(q) || d.issue.toLowerCase().includes(q);
    const sf = activeFilter === 'all' || d.status === activeFilter;
    return ok && sf;
  });

  return (
    <DashboardLayout
      role="expert"
      activePath="expert-dispute-cases.html"
      pageTitle="Dispute Cases"
      pageSubtitle="Mediate conflicts between clients and workers with fair resolutions."
    >
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div><div className="stat-val" id="statTotal">{all.length}</div><div className="stat-label">Total Cases</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="scale" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statOpen">{all.filter((d) => d.rawStatus === 'open').length}</div><div className="stat-label">Open</div></div><div className="stat-icon-wrap" style={{ background: '#fee2e2' }}><Icon name="alert-circle" style={{ width: 20, height: 20, color: '#ef4444' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statInvest">{all.filter((d) => d.status === 'Under Investigation').length}</div><div className="stat-label">Investigating</div></div><div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="search" style={{ width: 20, height: 20, color: '#a855f7' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statResolved" style={{ color: '#10b981' }}>{all.filter((d) => d.rawStatus === 'resolved').length}</div><div className="stat-label">Resolved</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle-2" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
      </div>
      <div className="dispute-toolbar">
        <div className="dispute-search-wrap">
          <Icon name="search" style={{ width: 15, height: 15 }} />
          <input className="dispute-search" type="text" id="disputeSearch" placeholder="Search by project or issue..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {FILTERS.map((f) => (
          <button key={f.value} className={'filter-btn' + (activeFilter === f.value ? ' active' : '')} onClick={() => setActiveFilter(f.value)}>{f.label}</button>
        ))}
      </div>
      <div className="dispute-grid" id="disputeGrid"><Cards list={filtered} /></div>
    </DashboardLayout>
  );
}
