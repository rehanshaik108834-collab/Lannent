import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { useLucideRefresh } from '../lib/hooks';

function loadProposals(session) {
  const raw = Store.getProposalsByWorker(session.userId);
  return raw.map((p) => {
    const task = Store.getTaskById(p.taskId);
    const client = task && task.clientId ? Store.getUserById(task.clientId) : null;
    return {
      id: p.id,
      projectName: task ? task.title : 'Unknown Task',
      client: client ? client.name : 'Unknown Client',
      bidAmount: parseFloat((p.bidPrice || '').toString().replace(/[^\d.-]/g, '')) || (task ? task.budget : 0),
      status: p.status === 'hired' ? 'Accepted' : p.status === 'rejected' ? 'Rejected' : 'Pending',
      rawStatus: p.status,
      submitted: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
      delivery: p.timeline || '14 days',
      letter: p.coverLetter || '',
      taskId: p.taskId,
    };
  });
}

const statusBadgeMap = { Pending: 'badge-orange', Accepted: 'badge-green', Rejected: 'badge-red' };
const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['accepted', 'Accepted'], ['rejected', 'Rejected']];
const metaStyle = { fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 };
const filterList = (proposals, filter) => (filter === 'all' ? proposals : proposals.filter((p) => p.status.toLowerCase() === filter));

export default function MyProposals() {
  const session = Auth.getCurrentUser();
  // The original rendered the stats and list once and only re-rendered the
  // list on a filter click (from the reloaded proposals). A withdrawn row
  // fades out and is removed; the counts never change.
  const [initial] = useState(() => loadProposals(session));
  const proposalsRef = useRef(initial);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState({ gen: 0, list: initial });
  const timers = useRef([]);
  const refreshIcons = useLucideRefresh();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const counts = {
    all: initial.length,
    pending: initial.filter((p) => p.status === 'Pending').length,
    accepted: initial.filter((p) => p.status === 'Accepted').length,
    rejected: initial.filter((p) => p.status === 'Rejected').length,
  };

  const filterProposals = (f) => {
    setFilter(f);
    setView((v) => ({ gen: v.gen + 1, list: filterList(proposalsRef.current, f) }));
    refreshIcons();
  };

  const withdrawProposal = (id) => {
    Validate.confirm('Withdraw this proposal? This action cannot be undone.', () => {
      Store.updateProposal(id, { status: 'withdrawn' });
      proposalsRef.current = loadProposals(session);
      const row = document.getElementById('proposal-row-' + id);
      if (row) {
        row.style.transition = 'opacity 0.3s';
        row.style.opacity = '0';
        // A filter click in the meantime replaced the list (the original then
        // removed an already-detached row).
        const gen = view.gen;
        timers.current.push(setTimeout(() => {
          setView((cur) => (cur.gen === gen ? { gen, list: cur.list.filter((x) => x.id !== id) } : cur));
        }, 300));
      }
      Validate.toast('Proposal withdrawn.', 'success');
    });
  };

  const renderProposals = (list) => {
    if (!list.length) return (
      <div style={{ padding: '64px 32px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        <div style={{ width: 48, height: 48, background: 'var(--secondary)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Icon name="file-text" style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No proposals yet</div>
        <div style={{ fontSize: 14, marginBottom: 20 }}>Browse open tasks and submit your first proposal.</div>
        <A href="browse-tasks.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" style={{ width: 16, height: 16 }} /> Browse Tasks
        </A>
      </div>
    );
    return list.map((p) => (
      <div
        key={`${view.gen}-${p.id}`}
        id={`proposal-row-${p.id}`}
        style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f9fb'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{p.projectName}</span>
            <span className={`badge ${statusBadgeMap[p.status]}`}>{p.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={metaStyle}><Icon name="user" style={{ width: 12, height: 12 }} />{p.client}</span>
            <span style={metaStyle}><Icon name="calendar" style={{ width: 12, height: 12 }} />{p.submitted}</span>
            <span style={metaStyle}><Icon name="clock" style={{ width: 12, height: 12 }} />{p.delivery}</span>
          </div>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.letter}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>{`$${typeof p.bidAmount === 'number' ? p.bidAmount.toLocaleString() : p.bidAmount}`}</div>
          {p.status === 'Accepted' ? <A href={`worker-workroom.html?id=${p.taskId}`} className="btn-primary" style={{ display: 'inline-block', fontSize: 13, padding: '6px 14px', borderRadius: 10, textDecoration: 'none' }}>Open Workroom</A> : null}

          {p.status === 'Pending' ? <button className="btn-outline" style={{ fontSize: 13, padding: '6px 14px', borderRadius: 10, color: '#ef4444', borderColor: '#fecaca' }} onClick={() => withdrawProposal(p.id)}>Withdraw</button> : null}
        </div>
      </div>
    ));
  };

  return (
    <DashboardLayout role="worker" activePath="my-proposals.html" pageTitle="My Proposals" pageSubtitle="Track all your submitted proposals">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><div><div className="stat-val">{counts.all}</div><div className="stat-label">Total</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="file-text" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val">{counts.pending}</div><div className="stat-label">Pending</div></div><div className="stat-icon-wrap" style={{ background: '#fff7ed' }}><Icon name="clock" style={{ width: 20, height: 20, color: '#f97316' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val" style={{ color: '#10b981' }}>{counts.accepted}</div><div className="stat-label">Accepted</div></div><div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="check-circle" style={{ width: 20, height: 20, color: '#10b981' }} /></div></div>
        <div className="stat-card"><div><div className="stat-val">{counts.rejected}</div><div className="stat-label">Rejected</div></div><div className="stat-icon-wrap" style={{ background: '#fee2e2' }}><Icon name="x-circle" style={{ width: 20, height: 20, color: '#ef4444' }} /></div></div>
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div id="filterBar" style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', padding: 4, borderRadius: 12, overflowX: 'auto' }}>
            {FILTERS.map(([val, label]) => {
              const on = filter === val;
              return (
                <button
                  key={val}
                  onClick={() => filterProposals(val)}
                  style={{ padding: '6px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap' }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <A href="browse-tasks.html" className="btn-primary" style={{ fontSize: 13, padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="search" style={{ width: 14, height: 14 }} />Browse Tasks
          </A>
        </div>
        <div id="proposalsContainer">{renderProposals(view.list)}</div>
      </div>
    </DashboardLayout>
  );
}
