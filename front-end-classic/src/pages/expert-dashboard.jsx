import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle } from '../lib/hooks';
import css from './expert-dashboard.css?inline';

export default function ExpertDashboard() {
  usePageStyle(css);

  // Live stats from store
  const session = Auth.getCurrentUser();
  const userId = session?.userId || 'u3';
  const auditReqs = Store.getAuditRequests();
  const pendingAudits = auditReqs.filter((a) => a.status === 'Pending' || a.status === 'In Review').length;
  const openDisputes = Store.getDisputes().filter((d) => d.status === 'open').length;
  const expert = Store.getUserById(userId);
  const earned = Store.getTransactionsByUser(userId).filter((t) => t.type === 'milestone-release').reduce((s, t) => s + t.amount, 0);

  const auditList = Store.getAuditRequests().filter((a) => a.expertId === userId || !a.expertId).slice(0, 3);
  const disputeList = Store.getDisputes().filter((d) => d.expertId === userId || !d.expertId).slice(0, 3);

  return (
    <DashboardLayout
      role="expert"
      activePath="expert-dashboard.html"
      pageTitle="Expert Dashboard"
      pageSubtitle="Manage your audit requests and dispute cases"
    >
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div><div className="stat-val">{pendingAudits}</div><div className="stat-label">Pending Audits</div><div className="stat-change">{`${auditReqs.filter((a) => a.status === 'Pending').length} awaiting`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="clipboard-check" style={{ width: 20, height: 20, color: '#a855f7' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{openDisputes}</div><div className="stat-label">Dispute Cases</div><div className="stat-change">{`${Store.getDisputes().filter((d) => d.status === 'resolved').length} resolved`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#eff6ff' }}><Icon name="scale" style={{ width: 20, height: 20, color: '#6366f1' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val" style={{ color: '#10b981' }}>{`$${(earned || 0).toLocaleString()}`}</div><div className="stat-label">Total Earned</div><div className="stat-change">Lifetime earnings</div></div>
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5' }}><Icon name="wallet" style={{ width: 20, height: 20, color: '#10b981' }} /></div>
        </div>
        <div className="stat-card">
          <div><div className="stat-val">{`${expert?.rating || 0}★`}</div><div className="stat-label">Expert Rating</div><div className="stat-change">{`From ${expert?.reviewsDone || 0} reviews`}</div></div>
          <div className="stat-icon-wrap" style={{ background: '#fffbeb' }}><Icon name="star" style={{ width: 20, height: 20, color: '#f59e0b' }} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Audit Requests */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Audit Requests</h3>
            <A href="expert-audit-requests.html" className="btn-outline" style={{ fontSize: 13, padding: '5px 12px' }}>View All</A>
          </div>
          {auditList.length ? auditList.map((a) => {
            const ms = Store.getMilestoneById(a.milestoneId);
            const task = ms ? Store.getTaskById(ms.taskId) : null;
            const cl = task ? Store.getUserById(task.clientId) : null;
            const clName = cl ? cl.name : 'Unknown';
            const pTitle = ms ? ms.title : 'Audit Request';
            const pay = ms ? '$' + Math.floor(ms.budget * 0.1).toLocaleString() : '$150';
            const urgency = a.status === 'Pending' ? 'urgent' : 'normal';
            const tags = task ? task.skills || [] : ['Review', 'Audit'];
            return (
              <div key={a.id} className="audit-card-item" onClick={() => go('expert-audit-requests.html')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{pTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`Client: ${clName} · Technical Audit`}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: '#10b981', fontSize: 14, flexShrink: 0, marginLeft: 12 }}>{pay}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {tags.slice(0, 2).map((t, i) => <span key={i} className="skill-tag" style={{ fontSize: 11, padding: '2px 8px' }}>{t}</span>)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {urgency === 'urgent' ? <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: 9999 }}>New</span> : null}
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      <Icon name="clock" style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} />{` ${a.status}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          }) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No active audit requests.</div>}
        </div>

        {/* Dispute Cases */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Dispute Cases</h3>
            <A href="expert-dispute-cases.html" className="btn-outline" style={{ fontSize: 13, padding: '5px 12px' }}>View All</A>
          </div>
          {disputeList.length ? disputeList.map((d) => {
            const ms = Store.getMilestoneById(d.milestoneId);
            const task = ms ? Store.getTaskById(ms.taskId) : null;
            const cl = task ? Store.getUserById(task.clientId) : null;
            const wkr = task && task.workerId ? Store.getUserById(task.workerId) : null;

            const clName = cl ? cl.name.split(' ')[0] : 'Client';
            const wName = wkr ? wkr.name.split(' ')[0] : 'Worker';
            const pTitle = ms ? ms.title : 'Dispute Case';
            const pay = ms ? '$' + Math.floor(ms.budget * 0.15).toLocaleString() : '$200';
            return (
              <div key={d.id} className="audit-card-item" onClick={() => go('expert-dispute-cases.html')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{pTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`${clName} vs ${wName}`}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>{pay}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={'badge ' + (d.status === 'open' ? 'badge-orange' : 'badge-blue')} style={{ textTransform: 'capitalize' }}>{d.status}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    <Icon name="alert-circle" style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} /> Dispute
                  </span>
                </div>
              </div>
            );
          }) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No active dispute cases.</div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
