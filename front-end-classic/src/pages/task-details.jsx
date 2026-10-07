import { useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { getParam, usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './task-details.css?inline';

// main.js escapeHtml: the original stored notification text escaped, so the
// same strings are written here.
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const milestoneColors = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
const metaStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)' };
const rowLabel = { fontSize: 13, color: 'var(--muted-foreground)' };
const rowValue = { fontSize: 13, fontWeight: 600 };

export default function TaskDetails() {
  usePageStyle(css);
  const [modalDisplay, setModalDisplay] = useState('none');
  const [timeline, setTimeline] = useState('3 weeks');
  const [coverLetter, setCoverLetter] = useState('');

  const urlId = getParam('id');

  let task = null;
  if (urlId) task = Store.getTaskById(urlId);
  // The original rendered once; submitting a proposal did not update the
  // "Proposals: N submitted" count until the next page load.
  const [taskProposals] = useState(() => (task ? Store.getProposalsByTask(task.id).filter((p) => p.type !== 'invitation') : []));

  // A missing task used to fall back to a fabricated one — five hardcoded
  // fixtures plus a default — so a wrong or stale id rendered an invented
  // project, complete with a client name, a budget and a skill list, as
  // though it were real. Better to say the task is not there.
  if (!task) {
    return (
      <EmptyState
        role={(Auth.getCurrentUser() || {}).role}
        activePath="browse-tasks.html"
        pageTitle="Task"
        message={urlId
          ? `No task found with the id "${urlId}". It may have been removed, or the link may be out of date.`
          : 'No task was specified. Open a task from the list to see its details.'}
        linkHref="browse-tasks.html"
        linkLabel="Browse tasks"
      />
    );
  }

  const clientInfo = task.clientId ? Store.getUserById(task.clientId) : null;
  const clientName = clientInfo ? clientInfo.name : (task.clientName || 'Unknown Client');
  const clientInitials = clientInfo ? clientInfo.avatar : (task.clientInitials || '??');
  const clientMemberDate = clientInfo ? ('Member since ' + clientInfo.joinDate) : '';
  const clientProjects = clientInfo ? (Store.getTasksByClient(task.clientId)?.length || 0) : 0;
  const clientRating = clientInfo?.rating || 0;
  const budgetDisplay = task.budget && typeof task.budget === 'number' ? ('$' + task.budget.toLocaleString()) : (task.budget || '$0');
  const budgetNum = task.numBudget || (typeof task.budget === 'number' ? task.budget : parseInt(budgetDisplay.replace(/[^0-9]/g, '')) || 0);
  const paragraphs = (task.description || '').split('\n').filter((p) => p.trim());
  const taskMilestones = Store.getMilestonesByTask(task.id);
  const taskStatus = task.status || 'open';
  const statusLabel = taskStatus.charAt(0).toUpperCase() + taskStatus.slice(1).replace('-', ' ');
  const statusBadgeClass = taskStatus === 'open' ? 'badge-green' : taskStatus === 'in-progress' ? 'badge-blue' : taskStatus === 'completed' ? 'badge-purple' : 'badge-yellow';

  const currentTaskId = task.id;

  const submitProposal = () => {
    if (!coverLetter) {
      Validate.toast('Please write a cover letter', 'error');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      Validate.toast('Please log in to submit a proposal', 'error');
      return;
    }

    const t = Store.getTaskById(currentTaskId);

    // ── Guard: only open tasks accept proposals ───────────────────
    if (t && t.status !== 'open') {
      Validate.toast('This project is no longer accepting proposals.', 'error');
      setModalDisplay('none');
      return;
    }

    const taskBudget = t ? (typeof t.budget === 'number' ? t.budget : parseInt(String(t.budget).replace(/[^0-9]/g, '')) || 1000) : 1000;

    try {
      Store.createProposal({
        taskId: currentTaskId || 't1',
        workerId: currentUser.userId,
        workerName: currentUser.name || 'Worker',
        avatar: currentUser.avatar || 'WK',
        avatarColor: currentUser.avatarColor || '#6366f1',
        bidPrice: '$' + taskBudget.toLocaleString(),
        timeline: timeline,
        coverLetter: coverLetter,
        skills: currentUser.skills || [],
        status: 'pending',
      });

      // Notify the task's client about the new proposal
      if (t && t.clientId) {
        Store.addNotification({
          userId: t.clientId,
          type: 'proposal',
          text: `New proposal from ${escapeHtml(currentUser.name || 'a worker')}`,
          subtext: `${escapeHtml(t.title)} — Bid: $${taskBudget.toLocaleString()}, Timeline: ${timeline}`,
        });
      }
    } catch (e) {
      console.error('[submitProposal] Error:', e);
    }

    setModalDisplay('none');
    Validate.toast('✓ Proposal submitted successfully!', 'success');
  };

  const statusBoxColors = taskStatus === 'in-progress'
    ? { background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }
    : taskStatus === 'completed'
      ? { background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }
      : { background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' };

  return (
    <DashboardLayout role={Auth.getCurrentUser()?.role || 'worker'} activePath="browse-tasks.html" pageTitle="Task Details" pageSubtitle="">
      <div style={{ marginBottom: 16 }}>
        <A
          href="browse-tasks.html"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> Back to Browse
        </A>
      </div>

      <div className="detail-layout">
        {/* LEFT: Main Details */}
        <div>
          <div className="detail-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {task.auditEnabled ? <span className="badge badge-purple">Audit Enabled</span> : null}
                  <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>{task.title}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={metaStyle}>
                    <Icon name="user" style={{ width: 13, height: 13 }} /> {clientName}
                  </div>
                  <div style={metaStyle}>
                    <Icon name="clock" style={{ width: 13, height: 13 }} /> Posted recently
                  </div>
                  <div style={metaStyle}>
                    <Icon name="map-pin" style={{ width: 13, height: 13 }} /> Remote
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{budgetDisplay}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Fixed Price</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="detail-card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Project Description</h3>
            {paragraphs.map((p, i) => <p key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 16 }}>{p}</p>)}
          </div>

          {/* Milestones */}
          <div className="detail-card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Project Milestones</h3>
            <div>
              {taskMilestones.length > 0 ? taskMilestones.map((m, i) => {
                const color = milestoneColors[i % milestoneColors.length];
                const msStatus = m.status || 'pending';
                const msStatusLabel = msStatus === 'completed' ? '✓ Completed' : msStatus === 'submitted' ? '⬆ Submitted' : msStatus === 'in-progress' ? '⏳ In Progress' : msStatus === 'disputed' ? '⚠ Disputed' : '○ Pending';
                return (
                  <div key={m.id} className="milestone-item">
                    <div className="milestone-dot" style={{ background: color, marginTop: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{`Milestone ${i + 1}: ${m.title}`}</span>
                        <span style={{ fontWeight: 700, color }}>{`$${(m.budget || 0).toLocaleString()}`}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>{m.description || ''}</p>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{msStatusLabel}</span>
                    </div>
                  </div>
                );
              }) : <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>No milestones defined yet.</p>}
            </div>
          </div>

          {/* Required Skills */}
          <div className="detail-card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Required Skills</h3>
            <div className="skills-list">
              {(task.skills || []).map((s, i) => <span key={i} className="skill-tag" style={{ padding: '6px 14px', fontSize: 13 }}>{s}</span>)}
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div>
          {/* Apply Card */}
          <div className="detail-card" style={{ position: 'sticky', top: 80 }}>
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>{`$${budgetNum.toLocaleString()}`}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Total budget</div>
            </div>
            {taskStatus === 'open' ? (
              <>
                <button className="btn-primary" style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 15, marginBottom: 12 }} onClick={() => setModalDisplay('flex')}>
                  Apply Now
                </button>{' '}
                <button className="btn-outline" style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 15 }}>
                  <Icon name="bookmark" style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Save Task
                </button>
              </>
            ) : (
              <div style={{ width: '100%', padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 12, ...statusBoxColors }}>
                {taskStatus === 'in-progress' ? '🔄 In Progress — Not Accepting Proposals' : taskStatus === 'completed' ? '✅ Completed' : '⚠️ ' + statusLabel}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={rowLabel}>Status</span>
                <span style={rowValue}>{statusLabel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={rowLabel}>Category</span>
                <span style={rowValue}>{task.category || 'General'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={rowLabel}>Milestones</span>
                <span style={rowValue}>{`${taskMilestones.length} defined`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={rowLabel}>Proposals</span>
                <span style={rowValue}>{`${taskProposals.length} submitted`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={rowLabel}>Progress</span>
                <span style={rowValue}>{`${task.progress || 0}%`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={rowLabel}>Deadline</span>
                <span style={rowValue}>{task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--input-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>{clientInitials}</div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{clientName}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{clientMemberDate}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{clientProjects}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Projects</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{clientRating > 0 ? clientRating + '★' : 'N/A'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Rating</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{task.auditEnabled ? 'Yes' : 'No'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Audit</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <div id="applyModal" style={{ display: modalDisplay, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, margin: '0 16px', boxShadow: '0 32px 80px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Submit Proposal</h2>
            <button onClick={() => setModalDisplay('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
              <Icon name="x" style={{ width: 20, height: 20 }} />
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Delivery Timeline</label>
            <select id="timelineInput" className="form-input filter-select" style={{ padding: '12px 16px' }} value={timeline} onChange={(e) => setTimeline(e.target.value)}>
              <option>3 weeks</option>
              <option>4 weeks</option>
              <option>5 weeks</option>
              <option>6 weeks</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cover Letter</label>
            <textarea id="coverLetterInput" className="form-input" rows="4" placeholder="Describe your relevant experience and why you're the best fit for this project..." value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={() => setModalDisplay('none')} className="btn-outline" style={{ flex: 1, padding: 12, borderRadius: 12 }}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 12 }} onClick={submitProposal}>Submit Proposal</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
