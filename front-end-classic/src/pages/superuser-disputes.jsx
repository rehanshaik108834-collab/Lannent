import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle, useRerender } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './superuser-disputes.css?inline';

// main.js escapeHtml: the original escaped the project name inside the
// notification text it stored, so the same text is sent here.
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notifyParties(d, verdict) {
  // Notify both parties
  const vLabel = verdict === 'worker-favour' ? 'in favour of the Worker' : verdict === 'client-favour' ? 'in favour of the Client' : 'with a 50/50 split';
  if (d && d.raisedBy) {
    Store.addNotification({ userId: d.raisedBy, type: 'dispute-resolved', text: `Dispute resolved: ${escapeHtml(d.project)}`, subtext: `Verdict ${vLabel}` });
  }
  if (d && d.againstId) {
    Store.addNotification({ userId: d.againstId, type: 'dispute-resolved', text: `Dispute resolved: ${escapeHtml(d.project)}`, subtext: `Verdict ${vLabel}` });
  }
}

const verdictLabels = { 'worker-favour': 'Worker receives full payment', 'client-favour': 'Client receives full refund', split: 'Funds split equally between both parties' };

export default function SuperuserDisputes() {
  usePageStyle(css);
  const v = useFieldErrors();
  const rerender = useRerender();

  // The original filled the list 100ms after the layout rendered.
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeDisputeId, setActiveDisputeId] = useState(null);
  const [overrideTitle, setOverrideTitle] = useState('Override Dispute');
  const [overrideVerdict, setOverrideVerdict] = useState('');
  const [overrideResolution, setOverrideResolution] = useState('');

  // Superuser is no longer permitted to access the disputes page — redirect to dashboard.
  const session = Auth.getCurrentUser();
  const redirect = !session ? 'login.html' : session.role === 'superuser' ? 'superuser-dashboard.html' : null;

  useEffect(() => {
    if (redirect) { go(redirect); return undefined; }
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The stat cards were rendered once and never refreshed.
  const [stats] = useState(() => {
    const all = Store.getDisputes();
    return { total: all.length, open: all.filter((d) => d.status === 'open').length, resolved: all.filter((d) => d.status === 'resolved').length };
  });

  if (redirect) return null;

  const disputes = Store.getDisputes().filter((d) => filter === 'all' || d.status === filter);

  function quickResolve(disputeId, verdict) {
    Validate.confirm(
      `Apply verdict: "${verdict.replace(/-/g, ' ')}"? ${verdictLabels[verdict]}.`,
      () => {
        const d = Store.getDisputeById(disputeId);
        Store.resolveDispute(disputeId, { verdict, resolution: verdictLabels[verdict], expertId: Auth.getCurrentUser()?.userId || 'u4' });
        notifyParties(d, verdict);
        Validate.toast('Dispute resolved successfully.', 'success');
        rerender();
      },
    );
  }

  function openOverrideModal(disputeId) {
    setActiveDisputeId(disputeId);
    const d = Store.getDisputeById(disputeId);
    setOverrideTitle('Override: ' + d.project);
    setOverrideVerdict('');
    setOverrideResolution('');
    setModalOpen(true);
  }

  function closeOverrideModal() {
    setModalOpen(false);
    setActiveDisputeId(null);
    v.clearAllErrors();
  }

  function submitOverride() {
    const verdict = overrideVerdict;
    const resolution = overrideResolution.trim();

    const { valid } = v.form([
      { fieldId: 'overrideVerdict', value: verdict, checks: [(val) => Validate.selected(val, 'verdict')] },
      { fieldId: 'overrideResolution', value: resolution, checks: [(val) => Validate.required(val, 'Resolution'), (val) => Validate.minLength(val, 20, 'Resolution')] },
    ]);
    if (!valid) return;

    const d = Store.getDisputeById(activeDisputeId);
    Store.resolveDispute(activeDisputeId, { verdict, resolution, expertId: Auth.getCurrentUser()?.userId || 'u4' });
    notifyParties(d, verdict);
    closeOverrideModal();
    Validate.toast('Dispute override applied.', 'success');
    rerender();
  }

  let list = null;
  if (ready) {
    list = !disputes.length ? (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted-foreground)' }}>No disputes found.</div>
    ) : disputes.map((d) => (
      <div key={d.id} className={`dispute-card ${d.status === 'resolved' ? 'resolved' : ''}`} id={`dispute_${d.id}`}>
        <div className="dispute-header">
          <div>
            <div className="dispute-project">{d.project}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{`Raised ${d.createdAt}`}</div>
          </div>
          <span className={`badge ${d.status === 'open' ? 'badge-orange' : 'badge-green'}`}>{d.status}</span>
        </div>
        <div className="dispute-meta">
          <span><strong>Raised by:</strong>{` ${d.raisedByName}`}</span>
          <span><strong>Against:</strong>{` ${d.againstName}`}</span>
          <span><strong>Amount:</strong>{` ${d.amount}`}</span>
          {d.milestone ? <span><strong>Milestone:</strong>{` ${d.milestone}`}</span> : null}
        </div>
        <div className="dispute-reason">{d.reason}</div>
        {d.status === 'resolved' ? (
          <div className="resolution-box">
            <strong>{`Resolution (${d.verdict?.replace(/-/g, ' ')}):`}</strong>{` ${d.resolution} `}
            {d.resolvedAt ? <><br /><span style={{ opacity: 0.7 }}>{`Resolved on ${d.resolvedAt}`}</span></> : null}
          </div>
        ) : (
          <div className="dispute-actions">
            <button className="btn-worker" onClick={() => quickResolve(d.id, 'worker-favour')}>✓ Favour Worker</button>
            <button className="btn-client" onClick={() => quickResolve(d.id, 'client-favour')}>✓ Favour Client</button>
            <button className="btn-split" onClick={() => quickResolve(d.id, 'split')}>⟺ Split 50/50</button>
            <button className="btn-edit" onClick={() => openOverrideModal(d.id)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Custom Override</button>
          </div>
        )}
      </div>
    ));
  }

  return (
    <DashboardLayout role="superuser" activePath="superuser-disputes.html" pageTitle="All Disputes" pageSubtitle="Review and override dispute verdicts across the platform">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div><div className="stat-val">{stats.total}</div><div className="stat-label">Total Disputes</div></div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="scale" style={{ width: 20, height: 20, color: '#a855f7' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{stats.open}</div><div className="stat-label">Open Disputes</div></div>
          <div className="stat-icon-wrap" style={{ background: '#fff7ed' }}><Icon name="alert-circle" style={{ width: 20, height: 20, color: '#f97316' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{stats.resolved}</div><div className="stat-label">Resolved</div></div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div>
        </div>
      </div>

      <div className="su-toolbar">
        <select className="su-filter" id="statusFilterD" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Disputes</option>
          <option value="open">Open Only</option>
          <option value="resolved">Resolved Only</option>
        </select>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>Showing <strong id="disputeCount">{ready ? disputes.length + ' dispute' + (disputes.length !== 1 ? 's' : '') : ''}</strong></div>

      <div id="disputesList">{list}</div>

      {/* Override Modal */}
      <div className={'modal-overlay' + (modalOpen ? ' open' : '')} id="overrideModal" onClick={(e) => { if (e.target.id === 'overrideModal') closeOverrideModal(); }}>
        <div className="modal">
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }} id="overrideDisputeTitle">{overrideTitle}</p>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 20 }}>As Super User, your override is binding and final.</p>
          <div className="form-group">
            <label className="form-label">Verdict <span style={{ color: '#ef4444' }}>*</span></label>
            <select className="form-select" id="overrideVerdict" style={v.fieldStyle('overrideVerdict')} value={overrideVerdict} onChange={(e) => { setOverrideVerdict(e.target.value); v.clearError('overrideVerdict'); }}>
              <option value="">Select verdict</option>
              <option value="worker-favour">Favour Worker — release payment</option>
              <option value="client-favour">Favour Client — refund escrow</option>
              <option value="split">Split 50/50 — divide equally</option>
            </select>
            {v.error('overrideVerdict')}
          </div>
          <div className="form-group">
            <label className="form-label">Resolution Notes <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea className="form-textarea" id="overrideResolution" rows={4} placeholder="Explain the reasoning for this verdict..." style={v.fieldStyle('overrideResolution')} value={overrideResolution} onChange={(e) => { setOverrideResolution(e.target.value); v.clearError('overrideResolution'); }} />
            {v.error('overrideResolution')}
          </div>
          <div className="modal-actions">
            <button className="btn-cancel-modal" onClick={closeOverrideModal}>Cancel</button>
            <button className="btn-save-modal" onClick={submitOverride}>Apply Override</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
