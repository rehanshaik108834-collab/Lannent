import { Fragment, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { useLucideRefresh } from '../lib/hooks';

function loadInvitations(session) {
  const raw = Store.getInvitationsByWorker(session.userId);
  return raw.map((p) => {
    const task = Store.getTaskById(p.taskId);
    const client = task && task.clientId ? Store.getUserById(task.clientId) : null;
    return {
      id: p.id,
      projectName: task ? task.title : 'Unknown Task',
      client: client ? client.name : 'Unknown Client',
      budget: task ? task.budget : 0,
      status: (p.status || '').toLowerCase() === 'pending' ? 'Pending' : (p.status || '').toLowerCase() === 'hired' ? 'Accepted' : 'Declined',
      rawStatus: p.status,
      received: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
      message: p.coverLetter || '',
      taskId: p.taskId,
    };
  });
}

const statusBadgeMap = { Pending: 'badge-orange', Accepted: 'badge-green', Declined: 'badge-red' };
const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['accepted', 'Accepted'], ['declined', 'Declined']];
const metaStyle = { fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 };

function renderInvitations(invitations, filter, acceptInvite, declineInvite) {
  const list = filter === 'all' ? invitations : invitations.filter((p) => p.status.toLowerCase() === filter);
  if (!list.length) return (
    <div style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
      <div style={{ width: 48, height: 48, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon name="mail-open" style={{ width: 22, height: 22 }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No invitations found</div>
      <div style={{ fontSize: 14, marginBottom: 20 }}>You are all caught up on your project invitations.</div>
    </div>
  );

  return list.map((p) => (
    <div
      key={p.id}
      id={`invite-row-${p.id}`}
      style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f9fb'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{p.projectName}</span>
          <span className={`badge ${statusBadgeMap[p.status] || 'badge-blue'}`}>{p.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={metaStyle}><Icon name="user" style={{ width: 12, height: 12 }} />{p.client}</span>
          <span style={metaStyle}><Icon name="calendar" style={{ width: 12, height: 12 }} />{`Received ${p.received}`}</span>
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 12, background: 'var(--input-bg)', padding: 12, borderRadius: 12, borderLeft: '3px solid #6366f1' }}>
          <strong>Message:</strong><br />{p.message}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>{`$${typeof p.budget === 'number' ? p.budget.toLocaleString() : p.budget} Budget`}</div>

        {p.status === 'Pending' ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-primary" style={{ fontSize: 13, padding: '8px 16px', borderRadius: 10 }} onClick={() => acceptInvite(p.id)}>Accept</button>
            <button className="btn-outline" style={{ fontSize: 13, padding: '8px 16px', borderRadius: 10, color: '#ef4444', borderColor: '#fecaca' }} onClick={() => declineInvite(p.id)}>Reject</button>
          </div>
        ) : null}

        {p.status === 'Accepted' ? (
          <A href={`worker-workroom.html?id=${p.taskId}`} className="btn-primary" style={{ display: 'inline-block', fontSize: 13, padding: '8px 16px', borderRadius: 10, textDecoration: 'none' }}>Go to Project</A>
        ) : null}
      </div>
    </div>
  ));
}

export default function WorkerInvitations() {
  const session = Auth.getCurrentUser();
  const [filter, setFilter] = useState('all');
  // Accepting or rejecting rebuilt the whole page content, which also reset
  // the filter bar; bumping this key does the same.
  const [version, setVersion] = useState(0);
  const refreshIcons = useLucideRefresh();

  const invitations = loadInvitations(session);
  const counts = {
    all: invitations.length,
    pending: invitations.filter((p) => p.status === 'Pending').length,
    accepted: invitations.filter((p) => p.status === 'Accepted').length,
    declined: invitations.filter((p) => p.status === 'Declined').length,
  };

  const filterInvitations = (f) => { setFilter(f); refreshIcons(); };

  const rebuild = () => { setFilter('all'); setVersion((n) => n + 1); refreshIcons(); };

  const acceptInvite = (id) => {
    Validate.confirm('Accept this invitation? The project will be moved to your active projects and escrow will be locked.', () => {
      Store.acceptInvitation(id);
      rebuild();
      Validate.toast('Invitation accepted! Project is now active in My Projects.', 'success');
    });
  };

  const declineInvite = (id) => {
    Validate.confirm('Reject this invitation? The client will be notified.', () => {
      Store.declineInvitation(id);
      rebuild();
      Validate.toast('Invitation rejected.', 'success');
    });
  };

  return (
    <DashboardLayout role="worker" activePath="worker-invitations.html" pageTitle="Invitations" pageSubtitle="Review and respond to client project invitations">
      <Fragment key={version}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card"><div><div className="stat-val">{counts.all}</div><div className="stat-label">Total</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="mail" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
          <div className="stat-card"><div><div className="stat-val">{counts.pending}</div><div className="stat-label">Pending</div></div><div className="stat-icon-wrap" style={{ background: '#fff7ed' }}><Icon name="clock" style={{ width: 20, height: 20, color: '#f97316' }} /></div></div>
          <div className="stat-card"><div><div className="stat-val" style={{ color: '#10b981' }}>{counts.accepted}</div><div className="stat-label">Accepted</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
          <div className="stat-card"><div><div className="stat-val">{counts.declined}</div><div className="stat-label">Declined</div></div><div className="stat-icon-wrap" style={{ background: '#fee2e2' }}><Icon name="x-circle" style={{ width: 20, height: 20, color: '#ef4444' }} /></div></div>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div id="filterBar" style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', padding: 4, borderRadius: 12, overflowX: 'auto' }}>
              {FILTERS.map(([val, label]) => {
                const on = filter === val;
                return (
                  <button
                    key={val}
                    onClick={() => filterInvitations(val)}
                    style={{ padding: '6px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div id="invitationsContainer">{renderInvitations(invitations, filter, acceptInvite, declineInvite)}</div>
        </div>
      </Fragment>
    </DashboardLayout>
  );
}
