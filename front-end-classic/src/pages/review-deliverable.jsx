import { useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { getParam, usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './review-deliverable.css?inline';

const CHECKLIST_ITEMS = [
  { id: 1, label: 'Code meets project requirements' },
  { id: 2, label: 'Documentation is complete and clear' },
  { id: 3, label: 'Design files are properly organized' },
  { id: 4, label: 'All files are accessible and working' },
  { id: 5, label: 'Quality standards are met' },
];

// ── Expert Reviewer's verdict ──────────────────────────────────────
const VERDICTS = {
  pass: { label: 'Passed the technical audit', bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', icon: 'check-circle-2' },
  fail: { label: 'Failed the technical audit', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icon: 'x-circle' },
  conditional: { label: 'Passed with conditions', bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: 'alert-triangle' },
};

const cardStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 };
const btnIcon = { width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 6 };

function ScoreBar({ label, value }) {
  const v = Number(value) || 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, marginBottom: 6 }}>
      <span style={{ width: 104, color: 'var(--muted-foreground)', flex: 'none' }}>{label}</span>
      <span style={{ flex: 1, height: 6, background: 'var(--secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${(v / 5) * 100}%`, height: '100%', background: '#6366f1' }} />
      </span>
      <span style={{ width: 26, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{`${v}/5`}</span>
    </div>
  );
}

/** Everything the original computed once on DOMContentLoaded. */
function loadReview() {
  const session = Auth.getCurrentUser();
  const milestoneId = getParam('milestoneId') || getParam('id');

  // Load milestone from Store
  let milestone = milestoneId ? Store.getMilestoneById(milestoneId) : null;

  // The workroom records the milestone the client actually selected before
  // sending them here. Honour it before guessing — the scan below picks the
  // first submitted milestone across every project, which is rarely the one
  // they clicked.
  if (!milestone) {
    try {
      const stored = JSON.parse(localStorage.getItem('selectedMilestone') || 'null');
      if (stored && stored.id) milestone = Store.getMilestoneById(stored.id);
    } catch (e) { /* nothing usable stored */ }
  }

  // Last resort: the first submitted milestone for the client's tasks.
  if (!milestone) {
    const tasks = Store.getTasksByClient(session.userId);
    for (const t of tasks) {
      const ms = Store.getMilestonesByTask(t.id).find((m) => m.status === 'submitted' || m.status === 'review');
      if (ms) { milestone = ms; break; }
    }
  }

  if (!milestone) return null;

  const task = Store.getTaskById(milestone.taskId);
  const worker = milestone.workerId ? Store.getUserById(milestone.workerId) : null;

  // The Expert Reviewer's verdict on this work. The client releases escrow
  // from this page, and previously had no sight of the audit at all — the
  // report existed but was two clicks away under Reports.
  // Match this milestone specifically, or a project-wide audit not yet
  // pointed at one. Falling back to any engagement on the task showed
  // another milestone's verdict on this page.
  const engagements = (Store.getAuditRequests() || [])
    .filter((a) => a.taskId === milestone.taskId && a.kind !== 'dispute-audit');
  const engagement = engagements.find((a) => a.milestoneId === milestone.id)
    || engagements.find((a) => !a.milestoneId)
    || null;
  const auditReport = engagement ? Store.getAuditReportByRequest(engagement.id) : null;
  const reviewer = engagement && engagement.expertId ? Store.getUserById(engagement.expertId) : null;
  const deliverable = {
    project: task ? task.title : 'Unknown Project',
    milestone: milestone.title,
    worker: worker ? worker.name : 'Gig Worker',
    workerAvatar: worker ? worker.avatar : 'GW',
    workerColor: worker ? worker.avatarColor : 'linear-gradient(135deg,#6366f1,#4f46e5)',
    workerId: milestone.workerId || 'u2',
    submittedDate: milestone.submittedAt ? new Date(milestone.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently submitted',
    budget: milestone.budget || 0,
    id: milestone.id,
    deliverable: milestone.deliverable || null,
  };
  return { milestone, task, engagement, auditReport, reviewer, deliverable };
}

function AuditCard({ engagement, auditReport, reviewer }) {
  if (auditReport && auditReport.verdict) {
    const v = VERDICTS[auditReport.verdict] || VERDICTS.conditional;
    const scores = ['codequality', 'security', 'performance', 'documentation']
      .filter((k) => auditReport[k] != null);
    const avg = scores.length
      ? (scores.reduce((a, k) => a + Number(auditReport[k] || 0), 0) / scores.length).toFixed(1)
      : null;

    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Expert Reviewer&apos;s verdict</h3>
          <A href={`expert-report-audit.html?id=${engagement.id}`} style={{ fontSize: 12.5, color: 'var(--muted-foreground)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Read the full report</A>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: v.bg, border: `1px solid ${v.border}`, marginBottom: 16 }}>
          <Icon name={v.icon} style={{ width: 22, height: 22, color: v.text, flex: 'none' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: v.text }}>{v.label}</div>
            <div style={{ fontSize: 12.5, color: v.text, opacity: 0.85 }}>
              {`Reviewed by ${reviewer ? reviewer.name : 'an Expert Reviewer'}${avg ? ' · overall ' + avg + '/5' : ''}`}
            </div>
          </div>
        </div>

        {scores.length ? (
          <div style={{ marginBottom: 14 }}>
            <ScoreBar label="Code quality" value={auditReport.codequality} />
            <ScoreBar label="Security" value={auditReport.security} />
            <ScoreBar label="Performance" value={auditReport.performance} />
            <ScoreBar label="Documentation" value={auditReport.documentation} />
          </div>
        ) : null}

        {auditReport.findings ? (
          <>
            <div style={{ fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 6 }}>Findings</div>
            <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-foreground)' }}>{auditReport.findings}</div>
          </>
        ) : null}
      </div>
    );
  }
  if (engagement && !['declined', 'cancelled'].includes(engagement.status)) {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="clock" style={{ width: 20, height: 20, color: 'var(--muted-foreground)', flex: 'none' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Technical audit in progress</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
            {`${reviewer ? reviewer.name + ' has' : 'The Expert Reviewer has'} not filed a report yet. You can still approve, but the audit will not have informed your decision.`}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function ReviewDeliverable() {
  usePageStyle(css);
  const role = getParam('role') || 'client';
  const [data] = useState(loadReview);
  // toggleCheck only ever updated the box and the counter, never the label's
  // strike-through, so the labels keep their initial (unchecked) style.
  const [checked, setChecked] = useState(() => CHECKLIST_ITEMS.map(() => false));
  const [confirmDisplay, setConfirmDisplay] = useState('none');
  const [comments, setComments] = useState('');
  const [commentsErr, setCommentsErr] = useState({ text: '', display: 'none' });
  const [commentsBorder, setCommentsBorder] = useState('');

  if (!data) {
    return (
      <EmptyState
        role="client"
        activePath="client-my-projects.html"
        pageTitle="Review Deliverable"
        message="No deliverable pending review."
        linkHref="client-my-projects.html"
        linkLabel="Go to Projects"
      />
    );
  }

  const { milestone, task, engagement, auditReport, reviewer, deliverable } = data;
  const checkedCount = checked.filter(Boolean).length;
  const allChecked = checked.every(Boolean);

  const toggleCheck = (idx) => {
    setChecked((list) => list.map((c, i) => (i === idx ? !c : c)));
  };

  const handleApprove = () => {
    if (!allChecked) { Validate.toast('Please complete the checklist before approving.', 'error'); return; }
    setConfirmDisplay('flex');
  };

  const confirmRelease = () => {
    setConfirmDisplay('none');
    try {
      Store.approveDeliverable(milestone.id);
      Store.addNotification({ userId: deliverable.workerId, type: 'payment', text: `$${deliverable.budget.toLocaleString()} released from escrow`, subtext: deliverable.milestone + ' approved · just now', read: false });
    } catch (e) { console.warn('Store error:', e); }
    Validate.toast('✓ $' + deliverable.budget.toLocaleString() + ' released to ' + deliverable.worker, 'success');
    setTimeout(() => go('client-my-projects.html'), 2000);
  };

  const handleRequestChanges = () => {
    const text = comments.trim();
    if (!text) {
      setCommentsErr({ text: 'Please add revision comments before requesting changes.', display: 'block' });
      setCommentsBorder('#ef4444');
      return;
    }
    setCommentsErr((e) => ({ ...e, display: 'none' }));
    setCommentsBorder('');
    // The money stays in escrow; the worker revises and resubmits.
    const result = Store.requestRevision(milestone.id, text);
    if (!result.ok) {
      Validate.toast(result.message || 'The revision request could not be sent.', 'error');
      return;
    }
    Validate.toast('Revision request sent to ' + deliverable.worker, 'success');
    setTimeout(() => go('client-my-projects.html'), 1800);
  };

  const handleDispute = () => {
    // Store milestone + project info so dispute page can display it
    try {
      localStorage.setItem('disputeTargetMilestone', JSON.stringify({
        id: milestone.id,
        taskId: milestone.taskId,
        title: milestone.title,
        amount: milestone.budget || 0,
        project: task ? task.title : 'Unknown Project',
        workerId: deliverable.workerId,
        workerName: deliverable.worker,
      }));
    } catch (e) {
      console.warn('Could not set disputeTargetMilestone in localStorage', e);
    }
    go('dispute.html');
  };

  const files = deliverable.deliverable && deliverable.deliverable.files && deliverable.deliverable.files.length
    ? deliverable.deliverable.files
    : null;

  return (
    <DashboardLayout role={role} activePath={role === 'expert' ? 'expert-audit-requests.html' : 'client-my-projects.html'} pageTitle="Review Deliverable" pageSubtitle={deliverable.milestone}>
      <div style={{ marginBottom: 16 }}>
        <A
          href={role === 'expert' ? 'expert-audit-requests.html' : 'client-my-projects.html'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} />{` Back to ${role === 'expert' ? 'Audit Requests' : 'Projects'}`}
        </A>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: deliverable.workerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>{deliverable.workerAvatar}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{deliverable.worker}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{`Submitted ${deliverable.submittedDate}`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '12px 20px', borderRadius: 12, background: '#ecfdf5' }}>
            <div style={{ fontWeight: 700, color: '#10b981', fontSize: 18 }}>{`$${deliverable.budget.toLocaleString()}`}</div>
            <div style={{ fontSize: 11, color: '#065f46' }}>Milestone Value</div>
          </div>
          <span className="badge badge-orange" style={{ fontSize: 13, padding: '8px 16px' }}>Pending Review</span>
        </div>
      </div>

      <div className="review-layout">
        <div>
          <AuditCard engagement={engagement} auditReport={auditReport} reviewer={reviewer} />
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Submitted Files</h3>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>{`${deliverable.project} · ${deliverable.milestone}`}</div>
            {files ? files.map((f, i) => {
              // Submissions made before the file store exists carry a bare name
              // and nothing to fetch, so the control says so instead of being a
              // button that does nothing.
              const name = typeof f === 'string' ? f : (f && f.name) || 'File';
              const href = typeof f === 'object' ? Store.fileUrl(f) : '';
              const size = typeof f === 'object' && f.size ? (Number(f.size) / 1024).toFixed(0) + ' KB' : 'Submitted file';
              return (
                <div key={i} className="file-row">
                  <div className="file-icon-wrap" style={{ background: '#eef2ff' }}>
                    <Icon name="file" style={{ width: 18, height: 18, color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{size}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {href
                      ? <a className="btn-sm" href={href} download={name} title="Download"><Icon name="download" style={{ width: 14, height: 14 }} /></a>
                      : <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }} title="Uploaded before the file store existed, so only the name was kept.">Not stored</span>}
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                <Icon name="file-x" style={{ width: 32, height: 32, opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: 13 }}>No files attached to this submission.</div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Worker&apos;s Notes</h3>
            {deliverable.deliverable && deliverable.deliverable.description ? (
              <div style={{ background: 'var(--input-bg)', borderRadius: 12, padding: 16, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{deliverable.deliverable.description}</div>
            ) : (
              <div style={{ background: 'var(--input-bg)', borderRadius: 12, padding: 16, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 12 }}><strong>Deliverable submitted</strong> for review.</p>
                <p>Worker has submitted work for this milestone. Review the files and checklist before approving.</p>
              </div>
            )}
          </div>

          {role === 'client' ? (
            <>
              <div style={cardStyle}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Your Review Comments</h3>
                <textarea
                  className="form-input"
                  id="reviewComments"
                  rows="4"
                  placeholder="Add your feedback, questions, or specific revision requests here..."
                  style={commentsBorder ? { borderColor: commentsBorder } : undefined}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
                <div id="commentsErr" style={{ fontSize: 12, color: '#ef4444', marginTop: 4, display: commentsErr.display }}>{commentsErr.text}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <button
                  id="approveBtn"
                  onClick={handleApprove}
                  className="btn-primary"
                  style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#059669)', opacity: allChecked ? '1' : '0.6' }}
                  title={allChecked ? '' : 'Complete the checklist to approve'}
                >
                  <Icon name="check-circle" style={btnIcon} />Approve &amp; Release
                </button>
                <button onClick={handleRequestChanges} className="btn-outline" style={{ padding: 12, borderRadius: 12, borderColor: '#f59e0b', color: '#d97706' }}>
                  <Icon name="refresh-cw" style={btnIcon} />Request Changes
                </button>
                <button onClick={handleDispute} className="btn-outline" style={{ padding: 12, borderRadius: 12, borderColor: '#ef4444', color: '#ef4444' }}>
                  <Icon name="alert-triangle" style={btnIcon} />Raise Dispute
                </button>
              </div>
            </>
          ) : (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Expert Action</h3>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 20 }}>After reviewing the checklist and files, submit your final audit report.</p>
              <button onClick={() => go(`expert-report-audit.html?id=${getParam('auditId')}`)} className="btn-primary" style={{ padding: '12px 24px', borderRadius: 12, width: '100%' }}>
                <Icon name="clipboard-check" style={btnIcon} />Submit Audit Report
              </button>
            </div>
          )}
        </div>

        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16, position: 'sticky', top: 80 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Review Checklist</h3>
            <div id="checklistContainer">
              {CHECKLIST_ITEMS.map((item, i) => (
                <div key={item.id} className="checklist-item" onClick={() => toggleCheck(i)}>
                  <div className={'check-box' + (checked[i] ? ' checked' : '')} id={`chkBox${item.id}`}>
                    {checked[i] ? <Icon name="check" style={{ width: 12, height: 12, color: 'white' }} /> : null}
                  </div>
                  <span style={{ fontSize: 14 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--input-bg)', textAlign: 'center' }}>
              <span id="checkCount" style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{`${checkedCount}/${CHECKLIST_ITEMS.length} items checked`}</span>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(145deg,#fff7ed,#ffedd5)', border: '1.5px solid #fed7aa', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#c2410c', marginBottom: 12 }}>⚠ Before Approving</h3>
            <p style={{ fontSize: 13, color: '#7c2d12', lineHeight: 1.6 }}>
              {role === 'expert'
                ? 'Submitting the report will finalize this audit and append the results back to the associated project escrow automatically.'
                : <>{'Approving will release '}<strong>{`$${deliverable.budget.toLocaleString()}`}</strong>{` from escrow to ${deliverable.worker}. This action cannot be undone.`}</>}
            </p>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      <div id="confirmModal" style={{ display: confirmDisplay, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, margin: '0 16px', boxShadow: '0 32px 80px rgba(0,0,0,0.15)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Confirm Release</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 20 }}>{'Release '}<strong>{`$${deliverable.budget.toLocaleString()}`}</strong>{' from escrow to '}<strong>{deliverable.worker}</strong>? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setConfirmDisplay('none')} className="btn-outline" style={{ flex: 1, padding: 12, borderRadius: 12 }}>Cancel</button>
            <button onClick={confirmRelease} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#059669)' }}>Release Funds</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
