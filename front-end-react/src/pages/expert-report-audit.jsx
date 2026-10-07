import { useEffect, useRef, useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './expert-report-audit.css?inline';

// The page's esc(): used only for values that were stored escaped
// (notification text). React escapes everything rendered.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

const INITIAL_CHECKLIST = [
  { id: 'c1', label: 'Code meets project requirements', passed: null },
  { id: 'c2', label: 'Documentation is complete and clear', passed: null },
  { id: 'c3', label: 'All files are accessible and working', passed: null },
  { id: 'c4', label: 'No critical security vulnerabilities', passed: null },
  { id: 'c5', label: 'Quality standards are met', passed: null },
];
const SCORE_CATS = ['codequality', 'security', 'performance', 'documentation'];

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', margin: '14px 0 6px' }}>{children}</div>;
}

/**
 * A file the worker attached. Downloading needs the file to actually be
 * stored — until uploads land, a submission carries the name only, so the
 * control says so rather than pretending to be a working button.
 */
function FileRow({ f }) {
  const name = typeof f === 'string' ? f : (f && f.name) || 'File';
  const url = typeof f === 'object' ? Store.fileUrl(f) : '';
  const size = typeof f === 'object' && f.size ? ` · ${(Number(f.size) / 1024).toFixed(0)} KB` : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
      <Icon name="file" style={{ width: 16, height: 16, color: '#6366f1', flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`${name}${size}`}</span>
      {url ? (
        <a href={url} download={name} className="btn-outline" style={{ textDecoration: 'none', padding: '5px 11px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="download" style={{ width: 13, height: 13 }} />Download</a>
      ) : (
        <span title="The file store is not enabled yet, so only the filename was recorded with this submission." style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>Not stored</span>
      )}
    </div>
  );
}

/**
 * What the worker actually submitted — all of it.
 *
 * This card used to show the engagement's status, severity and due date
 * and nothing else: no repository, no branch, no files. A reviewer was
 * asked to judge work they could not see.
 */
function DeliverableCard({ milestone, work }) {
  const wrap = (inner) => (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{`Submitted Deliverable${milestone ? ` — ${milestone.title}` : ''}`}</h3>
      {inner}
    </div>
  );

  if (!milestone) return wrap(<p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>No milestone is attached to this engagement yet.</p>);
  if (!work) return wrap(<p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>The worker has not submitted anything for <strong>{milestone.title}</strong> yet, so there is nothing to audit.</p>);

  const repo = safeUrl(work.link);
  return wrap(
    <>
      {work.title ? <><Label>Title</Label><div style={{ fontSize: 14, fontWeight: 600 }}>{work.title}</div></> : null}
      {work.description ? <><Label>Notes from the worker</Label><p style={{ fontSize: '13.5px', lineHeight: '1.65', color: '#374151' }}>{work.description}</p></> : null}
      {repo ? <><Label>Repository</Label><a href={repo} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13.5px', color: '#4f46e5', wordBreak: 'break-all' }}><Icon name="git-branch" style={{ width: 14, height: 14, flex: 'none' }} />{work.link}</a></> : null}
      {work.branch ? <><Label>Branch</Label><code style={{ fontSize: 13, background: 'var(--secondary)', padding: '3px 8px', borderRadius: 6 }}>{work.branch}</code></> : null}
      <Label>Files</Label>
      {(work.files && work.files.length)
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{work.files.map((f, i) => <FileRow key={i} f={f} />)}</div>
        : <p style={{ fontSize: '13.5px', color: 'var(--muted-foreground)' }}>No files were attached to this submission.</p>}
      {milestone.submittedAt ? <div style={{ marginTop: 14, fontSize: '12.5px', color: 'var(--muted-foreground)' }}>{`Submitted ${milestone.submittedAt} · milestone value $${milestone.budget}`}</div> : null}
    </>,
  );
}

function ScoreBar({ label, val }) {
  const pct = ((val || 0) / 5) * 100;
  const color = (val || 0) >= 4 ? '#10b981' : (val || 0) >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{`${val || 0}/5`}</span>
      </div>
      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function ExpertReportAudit() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();
  const auditId = getParam('id') || getParam('reportId');
  const role = getParam('role') || (session ? session.role : 'expert');

  // Load audit request + linked objects
  let req = auditId ? Store.getAuditRequestById(auditId) : null;

  // Fallback: load first pending/in-review request assigned to this expert
  if (!req) {
    const all = Store.getAuditRequests();
    req = all.find((a) => a.status !== 'Completed' && (a.expertId === session.userId || !a.expertId)) || all[0] || null;
  }

  if (!req) {
    return (
      <EmptyState
        role="expert"
        activePath="expert-audit-requests.html"
        pageTitle="Audit Report"
        message="No audit request found."
        linkHref="expert-audit-requests.html"
        linkLabel="Go to Audit Requests"
      />
    );
  }

  return <AuditReport session={session} req={req} role={role} />;
}

function AuditReport({ session, req, role }) {
  const task = Store.getTaskById(req.taskId);
  const worker = Store.getUserById(req.workerId);

  // One engagement covers every milestone on the project, so the milestone
  // has to come from the URL. Keyed on the engagement alone, this page
  // loaded the first report filed under it — which meant opening milestone
  // two showed milestone one's answers already filled in, and locked the
  // form for a milestone that had never been audited.
  const milestoneId = getParam('milestoneId') || req.milestoneId || null;
  const milestone = milestoneId ? Store.getMilestoneById(milestoneId) : null;
  const existingReport = Store.getAuditReportByRequest(req.id, milestoneId);
  const work = milestone ? milestone.deliverable : null;

  // ── State ─────────────────────────────────────────────────────
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [scores, setScores] = useState(() => (existingReport && existingReport.verdict
    // Pre-populate if report exists
    ? { codequality: existingReport.codequality || 0, security: existingReport.security || 0, performance: existingReport.performance || 0, documentation: existingReport.documentation || 0 }
    : { codequality: 0, security: 0, performance: 0, documentation: 0 }));
  const [verdict, setVerdictState] = useState(existingReport && existingReport.verdict ? existingReport.verdict : null);
  // Hover preview per score category (paintStars); null repaints the committed score.
  const [preview, setPreview] = useState({});
  const [findErr, setFindErr] = useState(null); // { text, shown }
  const [findBorder, setFindBorder] = useState(null);
  const [vErr, setVErr] = useState(null);
  const findingsRef = useRef(null);
  const redirectTimer = useRef(null);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  // Only the assigned reviewer may score an audit. Clients and workers are
  // allowed on this page to READ the report about their own project — they
  // were previously handed the full scoring form and a live Submit button.
  const isReviewer = session && session.role === 'expert';
  const hasReport = !!(existingReport && existingReport.verdict);
  // 'paid' is the settled state in the engagement lifecycle ('Completed' is legacy).
  const isSettled = req.status === 'paid' || req.status === 'Completed';
  const isCompleted = isSettled || hasReport || !isReviewer;
  const awaitingReview = !hasReport && !isReviewer;

  // ── Actions ────────────────────────────────────────────────
  const toggleCheck = (id, passed) => {
    setChecklist((list) => list.map((c) => (c.id === id ? { ...c, passed: c.passed === passed ? null : passed } : c)));
  };

  /** Colours the existing stars. `val` omitted repaints the committed score. */
  const paintStars = (cat, val) => setPreview((p) => ({ ...p, [cat]: val === undefined ? null : val }));

  const setScore = (cat, val) => {
    if (isCompleted) return;
    setScores((s) => ({ ...s, [cat]: val }));
    paintStars(cat);
  };

  const setVerdict = (v) => {
    if (isCompleted) return;
    setVerdictState(v);
    setVErr((e) => (e ? { ...e, shown: false } : e));
  };

  const submitAuditReport = () => {
    const findings = findingsRef.current?.value?.trim() || '';
    let valid = true;

    // Validate findings
    let nextFindErr = findErr ? { ...findErr, shown: false } : null;
    let border = 'var(--border)';
    if (!findings || findings.length < 30) {
      nextFindErr = { text: 'Findings must be at least 30 characters.', shown: true };
      border = '#ef4444';
      valid = false;
    }
    setFindErr(nextFindErr);
    setFindBorder(border);

    // Validate verdict
    let nextVErr = vErr ? { ...vErr, shown: false } : null;
    if (!verdict) {
      nextVErr = { text: 'Please select a verdict (Pass or Fail).', shown: true };
      valid = false;
    }
    setVErr(nextVErr);

    // Validate checklist — at least 3 items reviewed
    const reviewed = checklist.filter((c) => c.passed !== null).length;
    if (reviewed < 3) {
      Validate.toast('Please review at least 3 checklist items before submitting.', 'error');
      valid = false;
    }

    if (!valid) return;

    // Save to Store
    try {
      Store.saveAuditReport({
        auditRequestId: req.id,
        taskId: req.taskId,
        milestoneId,
        expertId: session.userId,
        verdict,
        overall: verdict === 'pass' ? 'Pass' : 'Fail',
        findings,
        codequality: scores.codequality,
        security: scores.security,
        performance: scores.performance,
        documentation: scores.documentation,
        createdAt: new Date().toISOString().slice(0, 10),
        milestoneTitle: milestone ? milestone.title : req.milestone,
        projectTitle: req.project || (task ? task.title : ''),
        workerName: req.worker || (worker ? worker.name : ''),
      });

      // Update audit request status
      Store.updateAuditRequest(req.id, { status: 'Completed', expertId: session.userId });

      // Note: Expert audit report does not change milestone status - that's for client approval or dispute resolution only

      // Notify client and worker
      if (req.clientId) Store.addNotification({ userId: req.clientId, type: 'audit-complete', text: `Audit ${verdict === 'pass' ? 'passed' : 'failed'}: ${esc(req.milestone)}`, subtext: req.project + ' · just now', read: false });
      if (req.workerId) Store.addNotification({ userId: req.workerId, type: 'audit-complete', text: `Your milestone audit result: ${verdict === 'pass' ? 'PASS ✓' : 'FAIL ✗'}`, subtext: req.milestone + ' · just now', read: false });

      Validate.toast(`Audit report submitted. Verdict: ${verdict === 'pass' ? 'PASS' : 'FAIL'}`, verdict === 'pass' ? 'success' : 'error');
      redirectTimer.current = setTimeout(() => { go('expert-audit-requests.html'); }, 2000);
    } catch (e) {
      Validate.toast('Error saving report: ' + e.message, 'error');
    }
  };

  // ── Header info (always shown) ──
  const header = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
      <div className="stat-card">
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Project</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{req.project || (task ? task.title : 'N/A')}</div>
        </div>
        <div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="folder" style={{ width: 18, height: 18, color: '#6366f1' }} /></div>
      </div>
      <div className="stat-card">
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Milestone</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{req.milestone || (milestone ? milestone.title : 'N/A')}</div>
        </div>
        <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-square" style={{ width: 18, height: 18, color: '#10b981' }} /></div>
      </div>
      <div className="stat-card">
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Worker</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{req.worker || (worker ? worker.name : 'N/A')}</div>
        </div>
        <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="user" style={{ width: 18, height: 18, color: '#a855f7' }} /></div>
      </div>
    </div>
  );

  let content;
  if (isCompleted) {
    // ── COMPLETED: Read-only report view ──
    if (!existingReport || !existingReport.verdict) {
      // No report yet. For the client or worker that means the reviewer
      // has not filed one — not that the audit is finished.
      const backHref = isReviewer ? 'expert-audit-requests.html' : 'milestone-reports.html';
      const backText = isReviewer ? '← Back to Audit Requests' : '← Back to Reports';
      content = (
        <>
          {header}
          {awaitingReview ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <Icon name="clock" style={{ width: 40, height: 40, color: 'var(--muted-foreground)', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Audit in progress</div>
              <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                The Expert Reviewer has not filed a report for this project yet. It will appear here once they do.
              </div>
              <A href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>{backText}</A>
            </div>
          ) : (
            <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <Icon name="check-circle-2" style={{ width: 40, height: 40, color: '#065f46', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#065f46', marginBottom: 6 }}>Audit Completed</div>
              <div style={{ fontSize: 14, color: '#047857' }}>This audit request has been completed. Report data is not available.</div>
              <A href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 20px', borderRadius: 10, background: '#065f46', color: '#fff', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>{backText}</A>
            </div>
          )}
        </>
      );
    } else {
      const vPass = existingReport.verdict === 'pass';
      const expertUser = Store.getUserById(existingReport.expertId);
      const expertName = expertUser ? expertUser.name : 'Expert Reviewer';
      const expertInitials = expertName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

      content = (
        <>
          {header}
          {isReviewer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <Icon name="lock" style={{ width: 18, height: 18, color: '#047857', flex: 'none' }} />
              <div style={{ fontSize: '13.5px', color: '#065f46' }}>
                <strong>{`Report submitted${existingReport.createdAt ? ' on ' + existingReport.createdAt : ''}.`}</strong>
                {' This milestone has been audited and cannot be audited again.'}
              </div>
              <A href={`expert-audit-preview.html?id=${req.id}`} style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#047857', textDecoration: 'underline', textUnderlineOffset: 2, whiteSpace: 'nowrap' }}>Back to milestones</A>
            </div>
          ) : null}

          {/* Verdict Banner */}
          <div className={`verdict-banner ${vPass ? 'verdict-approved' : 'verdict-rejected'}`} style={{ marginBottom: 24 }}>
            <div className="verdict-icon-wrap">
              <Icon name={vPass ? 'check-circle-2' : 'x-circle'} style={{ width: 22, height: 22, color: '#fff' }} />
            </div>
            <div>
              <div className="verdict-label">{vPass ? 'APPROVED' : 'REJECTED'}</div>
              <div className="verdict-text">{vPass ? 'This deliverable meets all quality standards and has been approved.' : 'This deliverable does not meet quality standards and needs revision.'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left column */}
            <div>
              {/* Quality Scores */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="bar-chart-2" style={{ width: 16, height: 16, color: '#6366f1' }} /> Quality Scores
                </h3>
                <ScoreBar label="Code Quality" val={existingReport.codequality} />
                <ScoreBar label="Security" val={existingReport.security} />
                <ScoreBar label="Performance" val={existingReport.performance} />
                <ScoreBar label="Documentation" val={existingReport.documentation} />
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Overall Average</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{`${(((existingReport.codequality || 0) + (existingReport.security || 0) + (existingReport.performance || 0) + (existingReport.documentation || 0)) / 4).toFixed(1)}/5`}</span>
                </div>
              </div>

              {/* Expert Signature */}
              <div className="expert-sig">
                <div className="expert-avatar">{expertInitials}</div>
                <div className="expert-name">{expertName}</div>
                <div className="expert-role">Technical Expert Reviewer</div>
                <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 8 }}>{`Report submitted on ${existingReport.createdAt || 'N/A'}`}</div>
              </div>
            </div>

            {/* Right column */}
            <div>
              {/* Technical Findings */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="file-text" style={{ width: 16, height: 16, color: '#6366f1' }} /> Technical Findings
                </h3>
                <div className="summary-box" style={{ minHeight: 120, whiteSpace: 'pre-wrap' }}>{existingReport.findings || 'No findings recorded.'}</div>
              </div>

              {/* Report Details */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="info" style={{ width: 16, height: 16, color: '#6366f1' }} /> Report Details
                </h3>
                <div className="info-grid">
                  <div className="info-cell">
                    <span className="info-label">Report ID</span>
                    <span className="info-value mono">{existingReport.id}</span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Audit Request</span>
                    <span className="info-value mono">{existingReport.auditRequestId}</span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Verdict</span>
                    <span className="info-value"><span className={`badge ${vPass ? 'badge-green' : 'badge-red'}`}>{vPass ? 'PASS' : 'FAIL'}</span></span>
                  </div>
                  <div className="info-cell">
                    <span className="info-label">Date</span>
                    <span className="info-value">{existingReport.createdAt || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Print Button */}
              <button onClick={() => window.print()} className="btn-print" style={{ width: '100%' }}>
                <Icon name="printer" style={{ width: 15, height: 15 }} /> Print Report
              </button>
            </div>
          </div>
        </>
      );
    }
  } else if (!work) {
    // ── Nothing submitted yet: there is no work to score. ──
    content = (
      <>
        {header}
        <DeliverableCard milestone={milestone} work={work} />
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <Icon name="clock" style={{ width: 40, height: 40, color: 'var(--muted-foreground)', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Nothing to audit yet</div>
          <div style={{ fontSize: 14, color: 'var(--muted-foreground)', maxWidth: 440, margin: '0 auto' }}>
            {`${milestone ? milestone.title + ' has not been submitted by the worker.' : 'No milestone is attached to this engagement.'} You can file a report once the deliverable arrives.`}
          </div>
          <A href={`expert-audit-preview.html?id=${req.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 20px', borderRadius: 10, background: 'var(--foreground)', color: 'var(--background)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>← Back to milestones</A>
        </div>
      </>
    );
  } else {
    // ── NOT COMPLETED: Show editable form ──
    const verdictBtnStyle = (v, onBorder, onBg, onColor) => ({
      flex: 1, padding: 10, borderRadius: 10, border: '2px solid var(--border)', background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--foreground)',
      ...(verdict ? { borderColor: verdict === v ? onBorder : 'var(--border)', background: verdict === v ? onBg : 'white', color: verdict === v ? onColor : 'var(--foreground)' } : {}),
    });
    content = (
      <>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: Deliverable info + checklist */}
          <div>
            <DeliverableCard milestone={milestone} work={work} />

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Quality Checklist</h3>
              <div id="checklistContainer">
                {checklist.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, background: 'var(--secondary)', marginBottom: 8 }}>
                    <button onClick={isCompleted ? undefined : () => toggleCheck(item.id, true)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: item.passed === true ? '#10b981' : '#e5e7eb', color: item.passed === true ? 'white' : '#9ca3af', cursor: isCompleted ? 'default' : 'pointer', fontSize: 14, transition: 'all 0.15s' }}>✓</button>
                    <button onClick={isCompleted ? undefined : () => toggleCheck(item.id, false)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: item.passed === false ? '#ef4444' : '#e5e7eb', color: item.passed === false ? 'white' : '#9ca3af', cursor: isCompleted ? 'default' : 'pointer', fontSize: 14, transition: 'all 0.15s' }}>✗</button>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, ...(item.passed === false ? { textDecoration: 'line-through', color: 'var(--muted-foreground)' } : {}) }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: item.passed === true ? '#10b981' : item.passed === false ? '#ef4444' : '#9ca3af' }}>{item.passed === true ? 'Pass' : item.passed === false ? 'Fail' : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Scores + findings + submit */}
          <div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Quality Scores</h3>
              {SCORE_CATS.map((cat) => {
                const shown = preview[cat] != null ? preview[cat] : scores[cat];
                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, textTransform: 'capitalize' }}>{cat.replace('codequality', 'Code Quality')}</div>
                    <div id={`stars-${cat}`}>
                      {[1, 2, 3, 4, 5].map((n) => [
                        n > 1 ? ' ' : null,
                        <span
                          key={n}
                          data-star={n}
                          onClick={isCompleted ? undefined : () => setScore(cat, n)}
                          onMouseEnter={isCompleted ? undefined : () => paintStars(cat, n)}
                          onMouseLeave={isCompleted ? undefined : () => paintStars(cat)}
                          style={{ cursor: isCompleted ? 'default' : 'pointer', fontSize: 24, color: n <= shown ? '#f59e0b' : '#d1d5db', transition: 'color 0.15s' }}
                        >★</span>,
                      ])}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Findings &amp; Verdict</h3>
              <textarea id="findingsText" ref={findingsRef} rows="5" placeholder="Describe your technical findings, issues found, and overall assessment..." style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--input-bg)', ...(findBorder ? { borderColor: findBorder } : {}) }} />
              <div id="findingsErr" style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: findErr && findErr.shown ? 'block' : 'none' }}>{findErr ? findErr.text : ''}</div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Verdict</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button id="verdictPass" onClick={() => setVerdict('pass')} style={verdictBtnStyle('pass', '#10b981', '#d1fae5', '#065f46')}>✓ Pass</button>
                  <button id="verdictFail" onClick={() => setVerdict('fail')} style={verdictBtnStyle('fail', '#ef4444', '#fee2e2', '#b91c1c')}>✗ Fail</button>
                </div>
                <div id="verdictErr" style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: vErr && vErr.shown ? 'block' : 'none' }}>{vErr ? vErr.text : ''}</div>
              </div>
            </div>

            <button onClick={submitAuditReport} className="btn-primary" style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600 }}>
              Submit Audit Report
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <DashboardLayout
      role={role}
      activePath={role === 'worker' ? 'worker-milestone-board.html' : role === 'client' ? 'client-my-projects.html' : 'expert-audit-requests.html'}
      pageTitle="Technical Audit Report"
      pageSubtitle={`Audit request for ${req.project || 'project'}`}
    >
      {content}
    </DashboardLayout>
  );
}
