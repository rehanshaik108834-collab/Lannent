import { useRef, useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './expert-audit-preview.css?inline';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One milestone in the reviewer's list.
 *
 * Three states, and only one of them is a way in:
 *   audited    — the report is filed; open it to read, never to re-file.
 *   submitted  — the worker has handed the work over; this is auditable.
 *   waiting    — nothing submitted yet, so there is nothing to audit.
 */
function MilestoneRow({ m, a, session }) {
  const audited = !!(a.auditProgress && a.auditProgress.auditedMilestoneIds.includes(m.id));
  const submitted = ['submitted', 'review', 'disputed'].includes(m.status) || !!m.deliverable;
  const engaged = a.status === 'in-progress' || a.status === 'paid';
  const mine = session && a.expertId === session.userId;

  let tag = null;
  let action = null;
  if (audited) {
    tag = <span className="st" style={{ color: '#047857' }}>✓ Report submitted</span>;
    action = mine
      ? <A href={`expert-report-audit.html?id=${a.id}&milestoneId=${m.id}`} className="btn-outline" style={{ textDecoration: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '12.5px', whiteSpace: 'nowrap' }}>View report</A>
      : null;
  } else if (!submitted) {
    tag = <span className="st">Awaiting the worker&apos;s submission</span>;
  } else if (engaged && mine) {
    tag = <span className="st" style={{ color: '#b45309' }}>Ready to audit</span>;
    action = <A href={`expert-report-audit.html?id=${a.id}&milestoneId=${m.id}`} className="btn-primary" style={{ textDecoration: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '12.5px', whiteSpace: 'nowrap' }}>Audit this milestone</A>;
  } else {
    tag = <span className="st">Submitted</span>;
  }

  return (
    <div className="pv-ms" style={audited ? { opacity: '.72' } : undefined}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{m.title}</div>
        <div style={{ color: 'var(--muted-foreground)' }}>{m.description || ''}</div>
        <div style={{ marginTop: 4 }}>{tag}</div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ fontWeight: 700 }}>{money(m.budget)}</div>
        {action}
      </div>
    </div>
  );
}

const skillStyle = { fontSize: 11, padding: '4px 9px', borderRadius: 6, background: 'var(--secondary)' };
const avatarStyle = { width: 40, height: 40, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 };

export default function ExpertAuditPreview() {
  usePageStyle(css);
  const arId = getParam('id');
  // reload(): re-fetch the preview and rebuild the whole dashboard, as the
  // original did by calling initDashboard() again.
  const [state, setState] = useState(() => ({ pv: arId ? Store.getAuditPreview(arId) : null, ver: 0 }));
  const quoteRef = useRef(null);
  const reload = () => setState((s) => ({ pv: Store.getAuditPreview(arId), ver: s.ver + 1 }));

  if (!arId) {
    return (
      <EmptyState
        role="expert" activePath="expert-audit-requests.html" pageTitle="Review before accepting"
        message="No audit request selected."
        linkHref="expert-audit-requests.html" linkLabel="Back to Audit Requests"
      />
    );
  }
  const { pv } = state;
  if (!pv) {
    return (
      <EmptyState
        role="expert" activePath="expert-audit-requests.html" pageTitle="Review before accepting"
        message="This audit request could not be loaded."
        linkHref="expert-audit-requests.html" linkLabel="Back to Audit Requests"
      />
    );
  }

  function quote() {
    const amount = parseFloat(quoteRef.current?.value);
    if (!amount || amount < 1) { Validate.toast('Enter a price greater than zero.', 'error'); return; }
    const r = Store.makeAuditOffer(arId, { amount, offeredBy: 'expert', note: 'Quote from reviewer' });
    if (!r) { Validate.toast('Could not send that quote.', 'error'); return; }
    // The original showed a toast here, but reload() re-ran initDashboard(),
    // whose document.body.innerHTML wiped it at once, so it was never seen:
    // Validate.toast(`Quote of $${amount.toLocaleString()} sent to the client.`, 'success');
    reload();
  }

  function acceptOffer(offerId) {
    const r = Store.acceptAuditOffer(arId, offerId);
    if (!r) { Validate.toast('Could not accept that offer.', 'error'); return; }
    // The original showed a toast here, but reload() re-ran initDashboard(),
    // whose document.body.innerHTML wiped it at once, so it was never seen:
    // Validate.toast('Fee agreed. The client now funds escrow.', 'success');
    reload();
  }

  function takeJob() {
    const s = Auth.getCurrentUser();
    const r = Store.acceptAuditEngagement(arId, s.userId);
    if (!r) { Validate.toast('Could not accept the engagement.', 'error'); return; }
    // The original showed a toast here, but reload() re-ran initDashboard(),
    // whose document.body.innerHTML wiped it at once, so it was never seen:
    // Validate.toast('Engagement accepted. You can now file your report.', 'success');
    reload();
  }

  function decline() {
    Validate.confirm('Decline this audit? The client will need to find another reviewer.', () => {
      const r = Store.declineAuditEngagement(arId, 'Declined by reviewer');
      if (!r) { Validate.toast('Could not decline.', 'error'); return; }
      // The original toasted 'Audit declined.' and navigated at once, so the
      // toast went with the old page; here it would survive the in-app navigation.
      // Validate.toast('Audit declined.', 'info');
      go('expert-audit-requests.html');
    });
  }

  const a = pv.auditRequest;
  const p = pv.project;
  const live = (pv.offers || []).find((o) => o.status === 'pending');
  const canAccept = live && live.offeredBy === 'client';
  const negotiating = ['preview-sent', 'negotiating'].includes(a.status);
  const session = Auth.getCurrentUser();

  const offers = (pv.offers || []).length
    ? pv.offers.map((o) => (
      <div key={o.id} className="offer-row">
        <span className="offer-who">{o.offeredBy === 'expert' ? 'You' : 'Client'}</span>
        <span className="offer-amt">{money(o.amount)}</span>
        <span className={`offer-tag ${o.status}`}>{o.status}</span>
        <span style={{ color: 'var(--muted-foreground)', flex: 1, minWidth: 0 }}>{o.note || ''}</span>
      </div>
    ))
    : <div className="offer-row" style={{ color: 'var(--muted-foreground)' }}>No offers yet — name your price below.</div>;

  const actions = [];
  if (canAccept) {
    actions.push(<button key="accept" className="btn-primary" onClick={() => acceptOffer(live.id)}>{`Accept ${money(live.amount)}`}</button>);
  }
  if (a.status === 'escrow-funded') {
    actions.push(<button key="take" className="btn-primary" onClick={takeJob}>Accept engagement &amp; start</button>);
    actions.push(<div key="fee" className="pv-fee">{`${money(a.agreedAmount)} is already in escrow. You receive ${money(Store.Fees.expertPayout(a.agreedAmount).net)} after the ${money(Store.Fees.expertPayout(a.agreedAmount).fee)} platform commission.`}</div>);
  }
  if (a.status === 'agreed') {
    actions.push(<div key="agreed" className="pv-fee">{`Fee agreed at ${money(a.agreedAmount)}. Waiting for the client to fund escrow.`}</div>);
  }
  if (a.status === 'in-progress' && a.kind === 'dispute-audit') {
    // A dispute is one claim, so there is a single place to go.
    actions.push(<A key="resolve" href={`resolve-dispute.html?id=${a.disputeId}`} className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>Resolve this dispute</A>);
  }
  // A project audit has no single report to "go to" — it has one per
  // milestone, reached from the milestone list below. A blanket button here
  // always opened the same form regardless of which milestone was ready.

  if (!['paid', 'declined', 'cancelled', 'in-progress'].includes(a.status)) {
    actions.push(<button key="decline" className="btn-outline" style={{ color: '#b91c1c', borderColor: '#fca5a5' }} onClick={decline}>Decline this audit</button>);
  }

  return (
    <DashboardLayout
      key={state.ver}
      role="expert"
      activePath="expert-audit-requests.html"
      pageTitle="Review before accepting"
      pageSubtitle={`${pv.kind === 'dispute-audit' ? 'Dispute audit' : 'Technical audit'} · status: ${a.status.replace(/-/g, ' ')}`}
    >
      <div className="pv-grid">
        <div>
          <div className="pv-card">
            <h2>{p ? p.title : 'Project'}</h2>
            <div className="pv-meta">
              <div><div className="k">Budget</div><div className="v">{p ? money(p.budget) : '—'}</div></div>
              <div><div className="k">Category</div><div className="v">{p ? p.category : '—'}</div></div>
              <div><div className="k">Deadline</div><div className="v">{p && p.deadline ? p.deadline : 'Not set'}</div></div>
              <div><div className="k">Progress</div><div className="v">{p ? p.progress + '%' : '—'}</div></div>
            </div>
            <div style={{ fontSize: 13, lineHeight: '1.65', color: 'var(--muted-foreground)' }}>{p ? p.description : ''}</div>
            {p && p.skills && p.skills.length ? (
              <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.skills.map((sk, i) => <span key={i} style={skillStyle}>{sk}</span>)}
              </div>
            ) : null}
          </div>

          {pv.dispute ? (
            <div className="pv-card">
              <h2>The dispute you would be arbitrating</h2>
              <div className="pv-claim">{pv.dispute.reason}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 10 }}>
                {`Raised by ${pv.dispute.raisedByName} against ${pv.dispute.againstName} · amount in question ${pv.dispute.amount || 'n/a'}`}
              </div>
            </div>
          ) : null}

          <div className="pv-card">
            <h2>{`Milestones (${pv.milestones.length})`}</h2>
            {a.auditProgress ? (
              <div className="pv-fee" style={{ margin: '-4px 0 12px' }}>
                {`${a.auditProgress.audited} of ${a.auditProgress.total} audited. You are paid once every milestone has a report.`}
              </div>
            ) : null}
            {pv.milestones.length
              ? pv.milestones.map((m) => <MilestoneRow key={m.id} m={m} a={a} session={session} />)
              : <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No milestones defined yet.</div>}
          </div>
        </div>

        <div>
          <div className="pv-card">
            <h2>Client</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ ...avatarStyle, background: pv.client ? pv.client.avatarColor : '#94a3b8' }}>{pv.client ? pv.client.avatar : '?'}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{pv.client ? pv.client.name : 'Unknown'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{pv.client && pv.client.company ? pv.client.company : ''}</div>
              </div>
            </div>
            {pv.worker ? (
              <>
                <h2 style={{ marginTop: 18 }}>Worker</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ ...avatarStyle, background: pv.worker.avatarColor }}>{pv.worker.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{pv.worker.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`Rating ${pv.worker.rating || '—'}`}</div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="pv-card">
            <h2>Your fee</h2>
            {offers}
            {negotiating ? (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
                  <span style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>$</span>
                  <input className="form-input" type="number" min="1" step="1" id="quoteInput" placeholder="Your price" style={{ maxWidth: 130 }} ref={quoteRef} />
                  <button className="btn-outline" onClick={quote}>Send</button>
                </div>
                <div className="pv-fee">The platform keeps 10% of the agreed fee. Nothing is committed until the client funds escrow.</div>
              </>
            ) : null}
            <div className="pv-actions">{actions}</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
