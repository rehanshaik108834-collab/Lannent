import { useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './expert-reports.css?inline';

const fmtDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function loadReports() {
  const session = Auth.getCurrentUser();
  const auditReports = Store.getAuditReports().filter((r) => r.verdict && r.expertId === session.userId).map((r) => ({
    id: r.id,
    auditRequestId: r.auditRequestId,
    type: 'Technical Audit',
    project: r.projectTitle || 'Unknown Project',
    milestone: r.milestoneTitle || 'Milestone',
    reportId: 'AUD-' + r.id.toUpperCase(),
    generatedDate: r.createdAt ? fmtDate(r.createdAt) : 'Recent',
    verdict: r.verdict === 'pass' ? 'Pass' : r.verdict === 'fail' ? 'Fail' : 'Pending',
    worker: r.workerName || 'Worker',
    summary: r.findings ? r.findings.substring(0, 100) + '...' : 'Report pending.',
    status: 'Published',
    raw: r,
  }));

  const disputeReports = Store.getDisputes().filter((d) => d.status === 'resolved' && d.expertId === session.userId).map((d) => ({
    id: 'dr-' + d.id,
    type: 'Dispute Resolution',
    project: d.project || 'Unknown Project',
    milestone: d.milestone || 'Dispute',
    reportId: 'DIS-' + d.id.toUpperCase(),
    generatedDate: d.resolvedAt ? fmtDate(d.resolvedAt) : 'Recent',
    verdict: d.verdict === 'worker-favour' ? 'Worker Favour' : d.verdict === 'client-favour' ? 'Client Favour' : 'Split',
    worker: d.againstName || 'Worker',
    summary: d.resolution ? d.resolution.substring(0, 100) + '...' : 'Resolution issued.',
    status: 'Published',
    raw: d,
  }));

  return [...auditReports, ...disputeReports];
}

function verdictBadge(v) {
  if (v === 'Pass') return 'badge-green';
  if (v === 'Fail') return 'badge-red';
  if (v === 'Worker Favour') return 'badge-green';
  if (v === 'Client Favour') return 'badge-blue';
  return 'badge-gray';
}

const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const viewLinkStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap' };

function Row({ r }) {
  // Build the correct link for the report type
  const viewUrl = r.type === 'Technical Audit'
    ? 'expert-report-audit.html?id=' + (r.auditRequestId || (r.raw ? r.raw.auditRequestId : ''))
    : 'expert-report-dispute.html?id=' + (r.raw ? r.raw.id : '');
  return (
    <tr>
      <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: 13 }}>{r.reportId}</td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 500, background: r.type === 'Technical Audit' ? '#eef2ff' : '#faf5ff', color: r.type === 'Technical Audit' ? '#4f46e5' : '#7c3aed' }}>{r.type}</span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.project}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.milestone}</div>
      </td>
      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted-foreground)' }}>{r.worker}</td>
      <td style={{ padding: '14px 16px' }}><span className={`badge ${verdictBadge(r.verdict)}`}>{r.verdict}</span></td>
      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted-foreground)' }}>{r.generatedDate}</td>
      <td style={{ padding: '14px 16px' }}><span className={`badge ${r.status === 'Published' ? 'badge-green' : 'badge-gray'}`}>{r.status}</span></td>
      <td style={{ padding: '14px 16px' }}>
        <A
          href={viewUrl}
          style={viewLinkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
        >
          <Icon name="eye" style={{ width: 13, height: 13 }} />{' View Report'}
        </A>
      </td>
    </tr>
  );
}

const FILTERS = ['All', 'Technical Audit', 'Dispute Resolution'];

export default function ExpertReports() {
  usePageStyle(css);
  const [reports] = useState(loadReports);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const list = reports.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || r.project.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
    const matchF = activeFilter === 'All' || r.type === activeFilter;
    return matchQ && matchF;
  });
  // With nothing to show, the original hid the table and left its last rows in place.
  const rowsRef = useRef([]);
  if (list.length) rowsRef.current = list;

  return (
    <DashboardLayout role="expert" activePath="expert-reports.html" pageTitle="My Reports" pageSubtitle="All your technical audit and dispute resolution reports">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div><div className="stat-val" id="statTotal">{reports.length}</div><div className="stat-label">Total Reports</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="file-text" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statAudit">{reports.filter((r) => r.type === 'Technical Audit').length}</div><div className="stat-label">Technical Audits</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="clipboard-check" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statDispute">{reports.filter((r) => r.type === 'Dispute Resolution').length}</div><div className="stat-label">Dispute Reports</div></div><div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="scale" style={{ width: 20, height: 20, color: '#a855f7' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" id="statPublished" style={{ color: '#10b981' }}>{reports.filter((r) => r.status === 'Published').length}</div><div className="stat-label">Published</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const on = activeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: on ? 'var(--foreground)' : 'var(--card)', color: on ? 'var(--primary-foreground)' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search reports..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '7px 12px 7px 32px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--input-bg)', width: 200 }} />
          </div>
        </div>
        <div id="reportsEmpty" style={{ display: list.length ? 'none' : 'block', padding: '64px 32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <Icon name="file-x" style={{ width: 40, height: 40, opacity: 0.4, margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No reports yet</div>
          <div style={{ fontSize: 14 }}>Complete audit requests and dispute resolutions to see reports here.</div>
        </div>
        <div id="reportsTableWrap" style={{ overflowX: 'auto', ...(list.length ? {} : { display: 'none' }) }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Report ID</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Project / Milestone</th>
                <th style={thStyle}>Worker</th>
                <th style={thStyle}>Verdict</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody id="reportsTbody">
              {rowsRef.current.map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
