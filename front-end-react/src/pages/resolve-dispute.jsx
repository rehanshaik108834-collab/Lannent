import { useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './resolve-dispute.css?inline';

// main.js escapeHtml: the notification texts below were stored escaped.
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

const SEV_CLASS = { high: 'high', medium: 'medium', low: 'low' };
const STATUS_CLASS = { Open: 'spill-open', Resolved: 'spill-resolved', 'Under Investigation': 'spill-invest' };
const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: 6 };

const fmtDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ── Dispute data keyed by milestoneId ── */
function loadDispute() {
  const disputeId = getParam('id') || getParam('disputeId');

  // Load real dispute from Store
  let raw = disputeId ? Store.getDisputeById(disputeId) : null;
  if (!raw) {
    const all = Store.getDisputes();
    raw = all.find((d) => d.status === 'open') || all[0] || null;
  }
  if (!raw) return null;

  const task = Store.getTaskById(raw.taskId);
  const raiser = Store.getUserById(raw.raisedBy);
  const respondent = Store.getUserById(raw.againstId);
  const escrowAmt = raw.amount || '$0';

  // The work under dispute. A reviewer was being asked to decide the case
  // without ever seeing what the worker actually delivered — the files,
  // the repository, the notes — none of it reached this page.
  const disputedMilestone = raw.milestoneId ? Store.getMilestoneById(raw.milestoneId) : null;
  const disputedWork = disputedMilestone ? disputedMilestone.deliverable : null;

  // Build the `d` object that the rest of the template uses
  const d = {
    project: raw.project || (task ? task.title : 'Unknown Project'),
    milestone: raw.milestone || (disputedMilestone ? disputedMilestone.title : 'Milestone'),
    milestoneId: raw.milestoneId || null,
    caseId: raw.id,
    issue: raw.reason ? raw.reason.substring(0, 60) + '...' : 'Dispute',
    description: raw.reason || 'No description provided.',
    status: raw.status === 'open' ? 'Open' : raw.status === 'resolved' ? 'Resolved' : 'Under Investigation',
    severity: raw.severity || 'medium',
    escrow: escrowAmt,
    raisedDate: raw.createdAt ? fmtDate(raw.createdAt) : 'Recently',
    raisedBy: raiser ? raiser.role.charAt(0).toUpperCase() + raiser.role.slice(1) : 'User',
    raisedByName: raiser ? raiser.name : (raw.raisedByName || 'Unknown'),
    raisedByInitials: raiser ? raiser.avatar : '?',
    raisedByColor: raiser ? raiser.avatarColor : '#6366f1',
    respondent: respondent ? respondent.role.charAt(0).toUpperCase() + respondent.role.slice(1) : 'User',
    respondentName: respondent ? respondent.name : (raw.againstName || 'Unknown'),
    respondentInitials: respondent ? respondent.avatar : '?',
    respondentColor: respondent ? respondent.avatarColor : '#10b981',
    timeline: [
      { dot: 'blue', time: raw.createdAt ? fmtDate(raw.createdAt) : 'N/A', text: 'Task posted', sub: 'Project requirements defined.' },
      { dot: 'green', time: '—', text: 'Work submitted', sub: 'Gig worker submitted deliverable for review.' },
      { dot: 'orange', time: raw.createdAt ? fmtDate(raw.createdAt) : 'N/A', text: 'Dispute raised', sub: 'Escrow frozen. Case assigned to Expert Reviewer.' },
    ],
    files: [],
    deliverable: disputedWork,
  };
  return { raw, d, disputedMilestone, disputedWork };
}

function Deliverable({ disputedMilestone, disputedWork }) {
  if (!disputedMilestone) {
    return <p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>This dispute is not tied to a specific milestone, so there is no single submission to review.</p>;
  }
  if (!disputedWork) {
    return <p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>The worker has not submitted a deliverable for <strong>{disputedMilestone.title == null ? '' : String(disputedMilestone.title)}</strong> yet.</p>;
  }
  const link = safeUrl(disputedWork.link);
  return (
    <>
      {disputedWork.title ? (
        <>
          <div style={labelStyle}>Title</div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{String(disputedWork.title)}</p>
        </>
      ) : null}

      {disputedWork.description ? (
        <>
          <div style={labelStyle}>Notes from the worker</div>
          <p style={{ fontSize: 14, lineHeight: '1.65', marginBottom: 14 }}>{String(disputedWork.description)}</p>
        </>
      ) : null}

      {link ? (
        <>
          <div style={labelStyle}>Repository / link</div>
          <a
            href={link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13.5px', color: '#4f46e5', wordBreak: 'break-all', marginBottom: 14 }}
          >
            <Icon name="git-branch" style={{ width: 14, height: 14, flex: 'none' }} />{String(disputedWork.link)}
          </a>
        </>
      ) : null}

      <div style={labelStyle}>Files</div>
      {(disputedWork.files && disputedWork.files.length) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {disputedWork.files.map((f, i) => {
            const name = typeof f === 'string' ? f : (f && f.name) || 'File';
            const href = typeof f === 'object' ? Store.fileUrl(f) : '';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <Icon name="file" style={{ width: 16, height: 16, color: '#6366f1', flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(name)}</span>
                {href
                  ? <a href={href} download={String(name)} style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><Icon name="download" style={{ width: 13, height: 13 }} />Download</a>
                  : <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Not stored</span>}
              </div>
            );
          })}
        </div>
      ) : <p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>No files were attached to this submission.</p>}

      {disputedMilestone.submittedAt ? (
        <div style={{ marginTop: 14, fontSize: '12.5px', color: 'var(--muted-foreground)' }}>{`Submitted ${disputedMilestone.submittedAt} · milestone value $${disputedMilestone.budget == null ? '' : disputedMilestone.budget}`}</div>
      ) : null}
    </>
  );
}

const VERDICTS = [
  { id: 'v1', value: 'favour_worker', title: 'Rule in favour of Gig Worker', desc: (d) => `Work meets requirements. Release ${d.escrow} escrow to worker immediately.` },
  { id: 'v2', value: 'favour_client', title: 'Rule in favour of Client', desc: () => 'Work does not meet requirements. Return escrow to client. Worker must revise and resubmit.' },
  { id: 'v3', value: 'partial', title: 'Split the milestone', desc: (d) => `Partial delivery. Half of ${d.escrow} is released to the worker and half returned to the client.` },
];

export default function ResolveDispute() {
  usePageStyle(css);
  const [data] = useState(loadDispute);
  const [selectedVerdict, setSelectedVerdict] = useState('');
  const [note, setNote] = useState('');
  const [noteBorder, setNoteBorder] = useState('');
  const [noteErr, setNoteErr] = useState({ text: '', shown: false });

  if (!data) {
    return (
      <EmptyState
        role="expert"
        activePath="expert-dispute-cases.html"
        pageTitle="Resolve Dispute"
        message="No dispute found."
        linkHref="expert-dispute-cases.html"
        linkLabel="Go to Disputes"
      />
    );
  }
  const { raw, d, disputedMilestone, disputedWork } = data;

  /* submit */
  const submitVerdict = () => {
    const value = note.trim() || '';
    let valid = true;

    // Validate verdict selection
    if (!selectedVerdict) {
      Validate.toast('Please select a verdict outcome before submitting.', 'error');
      valid = false;
    }

    // Validate resolution notes (min 50 chars for meaningful reasoning)
    if (!value || value.length < 50) {
      setNoteBorder('#ef4444');
      setNoteErr({ text: 'Resolution notes must be at least 50 characters. Provide detailed reasoning.', shown: true });
      valid = false;
    } else {
      setNoteBorder('');
      setNoteErr((e) => ({ ...e, shown: false }));
    }
    if (!valid) return;

    // Map verdict to store format
    const verdictMap = { favour_worker: 'worker-favour', favour_client: 'client-favour', partial: 'split' };
    const storeVerdict = verdictMap[selectedVerdict] || selectedVerdict;

    // Save to store
    try {
      const disputeId = getParam('id') || getParam('disputeId');
      const session = Auth.getCurrentUser();
      if (disputeId) {
        Store.resolveDispute(disputeId, { verdict: storeVerdict, resolution: value, expertId: session?.userId || 'u3' });

        // Notify the client (dispute raiser) about the resolution
        Store.getDisputeById(disputeId);
        const verdictLabel = storeVerdict === 'worker-favour' ? 'in favour of the Worker' : storeVerdict === 'client-favour' ? 'in favour of the Client' : 'with a partial resolution';

        if (raw.raisedBy) {
          Store.addNotification({
            userId: raw.raisedBy,
            type: 'dispute-resolved',
            text: `Dispute resolved: ${escapeHtml(d.project)}`,
            subtext: `Expert verdict ${verdictLabel} — ${escapeHtml(d.milestone)}`,
          });
        }

        // Notify the respondent (worker/client being disputed)
        if (raw.againstId) {
          Store.addNotification({
            userId: raw.againstId,
            type: 'dispute-resolved',
            text: `Dispute resolved: ${escapeHtml(d.project)}`,
            subtext: `Expert verdict ${verdictLabel} — ${escapeHtml(d.milestone)}`,
          });
        }
      }
    } catch (e) { console.warn('Store save failed', e); }

    const msgs = {
      favour_worker: `✓ Verdict submitted. Escrow of ${d.escrow} released to ${d.respondentName}.`,
      favour_client: '✓ Verdict submitted. Escrow returned to client. Worker notified to revise.',
      partial: '✓ Partial resolution submitted. Escrow split and worker notified.',
    };
    Validate.toast(msgs[selectedVerdict], 'success');
    setTimeout(() => { go('expert-dispute-cases.html'); }, 2800);
  };

  return (
    <DashboardLayout
      role="expert"
      activePath="expert-dispute-cases.html"
      pageTitle="Resolve Dispute"
      pageSubtitle={`Case #DIS-${d.caseId} · ${d.project} — ${d.milestone}`}
    >
      {/* ── What is a dispute? info banner ── */}
      <div className="explain-box">
        <div className="explain-title">
          <Icon name="info" style={{ width: 15, height: 15 }} />
          What is a Dispute on Lannent?
        </div>
        <div className="explain-body">
          {'A dispute is a formal conflict raised by either the '}<strong>Client</strong>{' or the '}<strong>Gig Worker</strong>{' when they cannot agree on a milestone outcome. Common triggers include: '}
          <ul>
            <li><strong>Client-raised:</strong> Deliverable does not meet quality standards, performance benchmarks not met, features are missing, or the deadline was breached.</li>
            <li><strong>Worker-raised:</strong> Scope was expanded beyond the original agreement, an approved milestone payment was not released, or additional work was requested without compensation.</li>
          </ul>
          {' Once raised, '}<strong>escrow funds are frozen</strong>{' and the case is escalated to an Expert Reviewer. The Expert\'s verdict is '}<strong>binding</strong>{' — a resolution in favour of the Client may trigger a rework request; in favour of the Worker, funds are released immediately. '}
        </div>
      </div>

      {/* ── Severity alert ── */}
      <div className={`dispute-alert ${SEV_CLASS[d.severity]}`}>
        <Icon name="alert-triangle" style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, color: d.severity === 'high' ? '#ef4444' : d.severity === 'medium' ? '#f59e0b' : '#eab308' }} />
        <div>
          <div className="dispute-alert-title">{`${d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}-Severity Dispute — Escrow Frozen`}</div>
          <div className="dispute-alert-body">{`Funds of ${d.escrow} are held in escrow and will not be released until a verdict is issued. Review all files and the event timeline before making your decision.`}</div>
        </div>
      </div>

      <div className="resolve-layout">

        {/* ═══ LEFT COLUMN ═══ */}
        <div>

          {/* Case Overview */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#eef2ff' }}>
                <Icon name="scale" style={{ width: 16, height: 16, color: '#6366f1' }} />
              </div>
              <span className="rc-head-title">Case Overview</span>
              <span className={`spill ${STATUS_CLASS[d.status]}`} style={{ marginLeft: 'auto' }}>{d.status}</span>
            </div>
            <div className="rc-body">
              <div className="info-grid" style={{ marginBottom: 16 }}>
                <div className="info-cell">
                  <span className="info-label">Project</span>
                  <span className="info-value">{d.project}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Milestone</span>
                  <span className="info-value">{d.milestone}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Dispute ID</span>
                  <span className="info-value mono">{`#DIS-${d.caseId}`}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Date Raised</span>
                  <span className="info-value">{d.raisedDate}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Issue Type</span>
                  <span className="info-value">{d.issue}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Escrow Held</span>
                  <span className="info-value" style={{ color: '#10b981', fontWeight: 700 }}>{d.escrow}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: 8 }}>Dispute Description</div>
              <p style={{ fontSize: 14, lineHeight: '1.65', color: 'var(--foreground)' }}>{d.description}</p>
            </div>
          </div>

          {/* The work under dispute */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#eef2ff' }}>
                <Icon name="package" style={{ width: 16, height: 16, color: '#6366f1' }} />
              </div>
              <span className="rc-head-title">Submitted Deliverable</span>
              {disputedMilestone ? <span className="spill" style={{ marginLeft: 'auto', background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' }}>{disputedMilestone.title == null ? '' : String(disputedMilestone.title)}</span> : null}
            </div>
            <div className="rc-body">
              <Deliverable disputedMilestone={disputedMilestone} disputedWork={disputedWork} />
            </div>
          </div>

          {/* Parties Involved */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#ecfdf5' }}>
                <Icon name="users" style={{ width: 16, height: 16, color: '#10b981' }} />
              </div>
              <span className="rc-head-title">Parties Involved</span>
            </div>
            <div className="rc-body">
              <div className="party-row">
                <div className="party-avatar" style={{ background: d.raisedByColor }}>{d.raisedByInitials}</div>
                <div>
                  <div className="party-name">{d.raisedByName}</div>
                  <div className="party-role">{d.raisedBy}</div>
                </div>
                <span className="party-tag tag-raiser">Raised Dispute</span>
              </div>
              <div className="party-row">
                <div className="party-avatar" style={{ background: d.respondentColor }}>{d.respondentInitials}</div>
                <div>
                  <div className="party-name">{d.respondentName}</div>
                  <div className="party-role">{d.respondent}</div>
                </div>
                <span className="party-tag tag-respondent">Respondent</span>
              </div>
            </div>
          </div>

          {/* Event Timeline */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#fff7ed' }}>
                <Icon name="clock" style={{ width: 16, height: 16, color: '#f59e0b' }} />
              </div>
              <span className="rc-head-title">Event Timeline</span>
            </div>
            <div className="rc-body">
              <div className="timeline">
                {d.timeline.map((t, i) => (
                  <div key={i} className="tl-item">
                    <div className={`tl-dot ${t.dot}`} />
                    <div className="tl-time">{t.time}</div>
                    <div className="tl-text">{t.text}</div>
                    <div className="tl-sub">{t.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Files Submitted by Gig Worker (d.files is always empty) */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#faf5ff' }}>
                <Icon name="folder-open" style={{ width: 16, height: 16, color: '#a855f7' }} />
              </div>
              <span className="rc-head-title">Files Submitted by Gig Worker</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>{`${d.files.length} files`}</span>
            </div>
            <div className="rc-body" />
          </div>

        </div>{/* /LEFT */}

        {/* ═══ RIGHT COLUMN ═══ */}
        <div>

          {/* Escrow snapshot */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#ecfdf5' }}>
                <Icon name="wallet" style={{ width: 16, height: 16, color: '#10b981' }} />
              </div>
              <span className="rc-head-title">Escrow Status</span>
            </div>
            <div className="rc-body">
              <div className="escrow-bar">
                <div className="escrow-label">Frozen Amount</div>
                <div className="escrow-val">{d.escrow}</div>
                <div className="escrow-sub">Held pending Expert verdict</div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: '1.55' }}>
                {'Per platform rules, funds are '}<strong>never released</strong>{' while a dispute is active. Your verdict will trigger an automatic escrow action — release to the worker or return to client. '}
              </p>
            </div>
          </div>

          {/* Verdict */}
          <div className="rc">
            <div className="rc-head">
              <div className="rc-head-icon" style={{ background: '#eef2ff' }}>
                <Icon name="gavel" style={{ width: 16, height: 16, color: '#6366f1' }} />
              </div>
              <span className="rc-head-title">Issue Your Verdict</span>
            </div>
            <div className="rc-body">
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: '1.5' }}>Select a resolution outcome. Your decision is <strong>binding</strong> and will be logged against this case.</p>

              {VERDICTS.map((v) => (
                <div key={v.id} className={'verdict-option' + (selectedVerdict === v.value ? ' selected' : '')} id={v.id} onClick={() => setSelectedVerdict(v.value)}>
                  <div className="verdict-radio"><div className="verdict-radio-dot" /></div>
                  <div>
                    <div className="verdict-title">{v.title}</div>
                    <div className="verdict-desc">{v.desc(d)}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Resolution Notes <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(required)</span></label>
                <textarea
                  id="resolutionNote"
                  className="resolution-note"
                  placeholder="Summarise your findings and reasoning for this verdict. This note is visible to both parties."
                  style={noteBorder ? { borderColor: noteBorder } : undefined}
                  value={note}
                  onChange={(e) => { setNote(e.target.value); setNoteBorder(e.target.value.trim().length >= 50 ? 'var(--border)' : ''); }}
                />
                <div id="resolutionNoteErr" style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: noteErr.shown ? 'block' : 'none' }}>{noteErr.text}</div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button className="btn-resolve-confirm" onClick={submitVerdict}>
                  <Icon name="shield-check" style={{ width: 15, height: 15 }} />
                  Submit Verdict
                </button>
                <A href="expert-dispute-cases.html" className="btn-back">
                  <Icon name="arrow-left" style={{ width: 14, height: 14 }} />
                  Back to Disputes
                </A>
              </div>
            </div>
          </div>

        </div>{/* /RIGHT */}
      </div>{/* /resolve-layout */}
    </DashboardLayout>
  );
}
