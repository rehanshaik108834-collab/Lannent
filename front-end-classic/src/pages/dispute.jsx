import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import ExpertPicker from '../components/ExpertPicker';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './dispute.css?inline';

// main.js escapeHtml: the notification text was stored escaped.
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readTarget() {
  try {
    return JSON.parse(localStorage.getItem('disputeTargetMilestone') || 'null');
  } catch (e) {
    console.warn('Could not get disputeTargetMilestone from localStorage', e);
    return undefined;
  }
}

let toastSeq = 0;

export default function Dispute() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();
  const userRole = session?.role || 'client';
  const workroomURL = userRole === 'worker' ? 'worker-workroom.html' : 'project-workroom.html';

  const [target] = useState(() => readTarget() || null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [outcome, setOutcome] = useState('');
  const [expertId, setExpertId] = useState(null);
  const [expertErr, setExpertErr] = useState(false);
  const [toasts, setToasts] = useState([]);

  // The page's own showToast(): a plain div appended to <body>, removed after 3.2s.
  const showToast = useCallback((msg, type = 'success') => {
    const bg = type === 'success' ? '#10b981' : type === 'warn' ? '#f59e0b' : '#ef4444';
    const id = ++toastSeq;
    setToasts((list) => [...list, { id, msg, bg }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3200);
  }, []);

  const redirectTimer = useRef(null);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const onExpertChange = useCallback((id) => {
    setExpertId(id);
    setExpertErr(false);
  }, []);

  function submitDispute() {
    const t = readTarget();
    if (t === undefined) {
      showToast('No milestone selected for dispute.', 'warn');
      return;
    }
    if (!t) {
      showToast('No milestone selected for dispute.', 'warn');
      return;
    }

    const reasonVal = reason.trim();
    const detailsVal = details.trim();
    const outcomeVal = outcome.trim();
    if (!reasonVal || !detailsVal || !outcomeVal) {
      showToast('Please complete all dispute fields.', 'warn');
      return;
    }

    const taskIdFromTarget = t.taskId || null;
    const task = taskIdFromTarget ? Store.getTaskById(taskIdFromTarget) : Store.getMilestoneById(t.id)?.taskId ? Store.getTaskById(Store.getMilestoneById(t.id).taskId) : null;
    const workerId = t.workerId || (task ? task.workerId : null);
    const worker = workerId ? Store.getUserById(workerId) : null;

    const disputeData = {
      taskId: task?.id || t.taskId || null,
      milestoneId: t.id,
      project: task ? task.title : t.project || t.title || 'Project',
      milestone: t.title || t.milestone || 'Milestone',
      amount: t.amount ? (typeof t.amount === 'number' ? '$' + t.amount.toLocaleString() : t.amount) : '$0',
      reason: reasonVal,
      details: detailsVal,
      outcome: outcomeVal,
      raisedBy: session?.userId || null,
      raisedByName: session?.name || session?.email || 'Client',
      expertId,
      againstId: worker ? worker.id : t.workerId || null,
      againstName: worker ? worker.name : t.workerName || t.worker || 'Worker',
      status: 'open',
    };

    if (!expertId) {
      setExpertErr(true);
      showToast('Select an Expert Reviewer to handle this dispute.', 'warn');
      return;
    }

    try {
      Store.createDispute(disputeData);

      // Notify all expert reviewers about the new dispute
      const allUsers = Store.getUsers();
      const experts = allUsers.filter((u) => u.role === 'expert' && u.status === 'active');
      experts.forEach((expert) => {
        Store.addNotification({
          userId: expert.id,
          type: 'dispute',
          text: `New dispute raised: ${escapeHtml(disputeData.project)}`,
          subtext: `${escapeHtml(disputeData.raisedByName)} raised a dispute — ${escapeHtml(disputeData.reason)}`,
        });
      });

      // Also notify the worker being disputed
      if (disputeData.againstId) {
        Store.addNotification({
          userId: disputeData.againstId,
          type: 'dispute',
          text: 'A dispute has been raised against you',
          subtext: `${escapeHtml(disputeData.project)} — ${escapeHtml(disputeData.milestone)}: ${escapeHtml(disputeData.reason)}`,
        });
      }

      showToast('Dispute submitted successfully.', 'success');
      const redirectTaskId = disputeData.taskId ? `?id=${disputeData.taskId}` : '';
      redirectTimer.current = setTimeout(() => { go(`project-milestone-board.html${redirectTaskId}`); }, 1300);
    } catch (e) {
      console.error('Dispute submit error:', e);
      showToast('Unable to submit dispute. Please try again.', 'error');
    }
  }

  // Offer only reviewers who cover this project's category.
  const task = target && target.taskId ? Store.getTaskById(target.taskId) : null;

  return (
    <DashboardLayout
      role={userRole}
      activePath={userRole === 'worker' ? 'worker-my-projects.html' : 'client-my-projects.html'}
      pageTitle="Raise Dispute"
      pageSubtitle="Dispute details"
    >
      <div className="dispute-form" id="disputeBody" style={{ padding: 20, margin: '0 auto', maxWidth: 800 }}>
        {!target ? (
          <div style={{ padding: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
            No dispute target found. Return to your <A href={workroomURL}>workroom</A>.
          </div>
        ) : (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Dispute Milestone</h2>
            <p style={{ marginBottom: 18, color: 'var(--muted-foreground)' }}>Provide details to raise a dispute for the selected milestone.</p>

            <div className="field-group"><label>Milestone</label><div id="disputeMilestoneField" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--secondary)', fontWeight: 600 }}>{target.title || 'Untitled milestone'}</div></div>
            <div className="field-group"><label>Amount</label><div id="disputeAmountField" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--secondary)', fontWeight: 600 }}>{target.amount || '$0'}</div></div>
            <div className="field-group">
              <label htmlFor="disputeReason">Reason</label>
              <select id="disputeReason" className="field-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select reason</option>
                <option value="Incomplete work">Incomplete work</option>
                <option value="Quality issues">Quality issues</option>
                <option value="Scope mismatch">Scope mismatch</option>
                <option value="Missed deadline">Missed deadline</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field-group"><label htmlFor="disputeDetails">Details</label><textarea id="disputeDetails" className="field-textarea" placeholder="Describe what is wrong and what you'd like changed" value={details} onChange={(e) => setDetails(e.target.value)} /></div>
            <div className="field-group"><label htmlFor="disputeOutcome">Desired outcome</label><input id="disputeOutcome" className="field-input" placeholder="E.g., revision, partial refund, cancellation" value={outcome} onChange={(e) => setOutcome(e.target.value)} /></div>

            <div className="field-group">
              <label>Expert Reviewer</label>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>
                Choose who arbitrates this dispute. Only reviewers covering this project&apos;s category are shown, and only they will be able to see the case.
              </div>
              <div id="disputeExpertList">
                <ExpertPicker category={task ? task.category : null} selectedId={expertId} onChange={onExpertChange} />
              </div>
              <div className="field-error" id="disputeExpertErr" style={{ display: expertErr ? 'block' : 'none', color: '#ef4444', fontSize: 12, marginTop: 6 }}>
                Select an Expert Reviewer to continue.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn-primary btn-action" onClick={submitDispute}>Submit Dispute</button>
              <A href={workroomURL} className="btn-outline btn-action">Back to Workroom</A>
            </div>
          </div>
        )}
      </div>
      {toasts.map((t) => createPortal(
        <div key={t.id} style={{ position: 'fixed', bottom: 24, right: 24, background: t.bg, color: 'white', padding: '14px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{t.msg}</div>,
        document.body,
        String(t.id),
      ))}
    </DashboardLayout>
  );
}
