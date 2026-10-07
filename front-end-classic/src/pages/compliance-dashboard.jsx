// Compliance desk. Read-only by design: this page has no control that changes
// anything, because the role that reaches it has no route that would let it.
import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './compliance-dashboard.css?inline';

const API = window.LANNENT_API || 'http://localhost:3000/api';
const KIND_LABEL = {
  'money': 'money', 'fee.change': 'fee change',
  'admin.change': 'admin change', 'admin.read': 'admin read',
};
const KIND_CLASS = {
  'money': 'kind-money', 'fee.change': 'kind-fee',
  'admin.change': 'kind-admin-change', 'admin.read': 'kind-admin-read',
};

function fetchLog(kind) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `${API}/audit-log?limit=200${kind ? '&kind=' + encodeURIComponent(kind) : ''}`, false);
  const token = localStorage.getItem('lannent_token');
  if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  const s = JSON.parse(localStorage.getItem('lannent_session') || '{}');
  if (s.role) xhr.setRequestHeader('role', s.role);
  if (s.userId) xhr.setRequestHeader('user-id', s.userId);
  try { xhr.send(); } catch (e) { return null; }
  if (xhr.status !== 200) return null;
  try { return (JSON.parse(xhr.responseText).data) || null; } catch (e) { return null; }
}

/** A rate change is the one event whose detail is worth reading inline. */
function detailText(e) {
  if (e.kind === 'fee.change' && e.detail && e.detail.changed) {
    const rows = Object.entries(e.detail.changed);
    if (!rows.length) return 'no rates changed';
    return rows.map(([k, v]) => `${k}: ${v.before} → ${v.after}`).join(', ');
  }
  if (e.detail && e.detail.durationMs != null) return e.detail.durationMs + 'ms';
  return '';
}

function Rows({ data }) {
  if (!data) return <tr><td colSpan="6" style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)' }}>The audit log could not be read.</td></tr>;
  if (!data.events.length) return <tr><td colSpan="6" style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)' }}>No events recorded yet.</td></tr>;
  return data.events.map((e, i) => (
    <tr key={i}>
      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{e.at.slice(0, 19).replace('T', ' ')}</td>
      <td><span className={`kind ${KIND_CLASS[e.kind] || 'kind-admin-read'}`}>{KIND_LABEL[e.kind] || e.kind}</span></td>
      <td>{e.actorId || '—'}<div style={{ color: 'var(--muted-foreground)', fontSize: '11.5px' }}>{e.actorRole || ''}</div></td>
      <td className="mono">{(e.method || '') + ' ' + (e.path || '')}</td>
      <td className={e.outcome === 'refused' ? 'outcome-refused' : ''}>{`${e.outcome || ''} `}{e.status ? <span style={{ color: 'var(--muted-foreground)' }}>{String(e.status)}</span> : null}</td>
      <td style={{ color: 'var(--muted-foreground)' }}>{detailText(e)}</td>
    </tr>
  ));
}

export default function ComplianceDashboard() {
  usePageStyle(css);
  // The summary note is computed once from the first read; the filter only
  // swaps the table rows, as before.
  const [initial] = useState(() => fetchLog(''));
  const [data, setData] = useState(initial);
  const [kind, setKind] = useState('');

  const note = initial
    ? `${initial.total} event${initial.total === 1 ? '' : 's'} matching · ${initial.stored} stored${initial.droppedFromCapacity ? ' · ' + initial.droppedFromCapacity + ' dropped at capacity' : ''}`
    : 'unavailable';

  return (
    <DashboardLayout
      role={(Auth.getCurrentUser() || {}).role}
      activePath="compliance-dashboard.html"
      pageTitle="Audit Log"
      pageSubtitle="Every financial read and every value-moving change, with the actor who asked."
    >
      <div className="filters">
        <select id="kindFilter" value={kind} onChange={(ev) => { setKind(ev.target.value); setData(fetchLog(ev.target.value)); }}>
          <option value="">All events</option>
          <option value="money">Money movements</option>
          <option value="fee.change">Fee changes</option>
          <option value="admin.change">Admin changes</option>
          <option value="admin.read">Admin reads</option>
        </select>
        <span style={{ fontSize: '12.5px', color: 'var(--muted-foreground)' }}>{note}</span>
        <a href={`${API}/audit-log/export`} style={{ marginLeft: 'auto', fontSize: 13, color: '#4f46e5', textDecoration: 'none' }}>Export CSV</a>
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="audit-table">
            <thead><tr><th>When</th><th>Event</th><th>Actor</th><th>Route</th><th>Outcome</th><th>Detail</th></tr></thead>
            <tbody id="auditRows"><Rows data={data} /></tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
