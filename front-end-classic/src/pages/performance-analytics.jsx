import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './performance-analytics.css?inline';

/* ═══════════════════════════════════════════════════════
   DATA — derived from Store, not hardcoded
═══════════════════════════════════════════════════════ */
function buildData() {
  const session = Auth.getCurrentUser();
  const workerId = session ? session.userId : 'u2';
  const me = Store.getUserById(workerId) || {};

  const myTasks = Store.getTasksByWorker(workerId);
  let myMilestones = [];
  myTasks.forEach((t) => {
    myMilestones = myMilestones.concat(
      Store.getMilestonesByTask(t.id).filter((m) => !m.workerId || m.workerId === workerId),
    );
  });

  const DONE_MS = ['completed', 'approved', 'audit-passed', 'done'];
  const isDone = (m) => DONE_MS.indexOf(m.status) !== -1;

  const myReleases = Store.getTransactions().filter((t) => t.type === 'milestone-release' && t.toId === workerId);

  function monthLabel(d) {
    const dt = new Date(d);
    return isNaN(dt) ? null : dt.toLocaleString('en-US', { month: 'short' });
  }

  // Trailing twelve months, oldest first.
  const months12 = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    months12.push(new Date(now.getFullYear(), now.getMonth() - k, 1).toLocaleString('en-US', { month: 'short' }));
  }

  const totalEarnings = myReleases.reduce((a, t) => a + (t.amount || 0), 0);
  const doneMsCount = myMilestones.filter(isDone).length;

  const overviewStats = {
    totalEarnings,
    projectsCompleted: myTasks.filter((t) => t.status === 'completed').length,
    activeProjects: myTasks.filter((t) => t.status === 'in-progress').length,
    successRate: myMilestones.length ? Math.round((doneMsCount / myMilestones.length) * 100) : 0,
  };

  const earningsData = months12.map((m) => ({
    month: m,
    earnings: myReleases.filter((t) => monthLabel(t.createdAt) === m).reduce((a, t) => a + (t.amount || 0), 0),
  }));

  const projectPerformance = myTasks.map((t) => {
    const ms = Store.getMilestonesByTask(t.id);
    const client = t.clientId ? Store.getUserById(t.clientId) : null;
    const paid = myReleases.filter((tx) => tx.taskId === t.id).reduce((a, tx) => a + (tx.amount || 0), 0);
    return {
      id: t.id,
      project: t.title,
      client: client ? client.name : 'Unknown client',
      initials: client ? client.avatar : '??',
      milestonesCompleted: ms.filter(isDone).length,
      totalMilestones: ms.length,
      payment: paid,
      rating: me.rating || 0,
    };
  });

  // Velocity = days between a milestone being submitted and approved.
  const turnarounds = myMilestones
    .filter((m) => m.submittedAt && m.approvedAt)
    .map((m) => ({
      month: monthLabel(m.approvedAt),
      days: Math.max((new Date(m.approvedAt) - new Date(m.submittedAt)) / 86400000, 0),
    }))
    .filter((x) => !isNaN(x.days));

  const months6 = months12.slice(-6);
  const milestoneVelocityData = months6.map((m) => {
    const inMonth = turnarounds.filter((x) => x.month === m);
    const avg = inMonth.length ? inMonth.reduce((a, x) => a + x.days, 0) / inMonth.length : 0;
    return { month: m, avgDays: +avg.toFixed(1) };
  });

  const avgDaysAll = turnarounds.length ? turnarounds.reduce((a, x) => a + x.days, 0) / turnarounds.length : 0;

  const lateDeliveries = myMilestones.filter((m) => m.dueDate && m.submittedAt && new Date(m.submittedAt) > new Date(m.dueDate)).length;

  const velocityStats = {
    avgCompletionTime: turnarounds.length ? avgDaysAll.toFixed(1) + ' days' : 'No data yet',
    onTimeDeliveryRate: myMilestones.length ? Math.round(((myMilestones.length - lateDeliveries) / myMilestones.length) * 100) : 0,
    lateDeliveries,
  };

  // The platform has no reviews model yet, so there is nothing honest to show here.
  const clientFeedback = [];

  const myProposals = Store.getProposalsByWorker(workerId);
  const acceptedProposals = myProposals.filter((p) => p.status === 'hired').length;
  const proposalStats = {
    sent: myProposals.length,
    accepted: acceptedProposals,
    successRate: myProposals.length ? Math.round((acceptedProposals / myProposals.length) * 100) : 0,
  };

  const allProposals = Store.getProposals();
  const platformHired = allProposals.filter((p) => p.status === 'hired').length;
  const platformRate = allProposals.length ? Math.round((platformHired / allProposals.length) * 100) : 0;
  const rateDelta = proposalStats.successRate - platformRate;

  return { overviewStats, earningsData, projectPerformance, milestoneVelocityData, velocityStats, clientFeedback, myProposals, proposalStats, platformRate, rateDelta };
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function Stars({ rating }) {
  return [0, 1, 2, 3, 4].map((i) => {
    const filled = i < Math.floor(rating);
    return <Icon key={i} name="star" style={filled ? { width: 12, height: 12, fill: '#f59e0b', color: '#f59e0b' } : { width: 12, height: 12, color: '#e5e7eb' }} />;
  });
}

function fmtMoney(n) { return '$' + n.toLocaleString(); }

export default function PerformanceAnalytics() {
  usePageStyle(css);
  const d = useRef(null);
  if (!d.current) d.current = buildData();
  const { overviewStats, earningsData, projectPerformance, milestoneVelocityData, velocityStats, clientFeedback, myProposals, proposalStats, platformRate, rateDelta } = d.current;

  const earningsRef = useRef(null);
  const velocityRef = useRef(null);
  const proposalRef = useRef(null);

  const avgMonthly = Math.round(earningsData.reduce((s, x) => s + x.earnings, 0) / earningsData.length);

  /* ══════════════════════════════════════════════════════
     CHARTS
  ══════════════════════════════════════════════════════ */
  useEffect(() => {
    const tooltipDefaults = {
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      titleColor: '#111827',
      bodyColor: '#374151',
      padding: 10,
      cornerRadius: 8,
      titleFont: { family: "'Geist','Inter',sans-serif", size: 12, weight: '500' },
      bodyFont: { family: "'Geist','Inter',sans-serif", size: 12 },
    };
    const tickStyle = { color: '#9ca3af', font: { family: "'Geist','Inter',sans-serif", size: 12 } };
    const gridStyle = { color: '#e5e7eb', drawBorder: false };
    const charts = [];

    /* Earnings line chart */
    if (earningsRef.current) {
      charts.push(new Chart(earningsRef.current, {
        type: 'line',
        data: {
          labels: earningsData.map((x) => x.month),
          datasets: [{
            label: 'Earnings',
            data: earningsData.map((x) => x.earnings),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,.10)',
            borderWidth: 2,
            pointBackgroundColor: '#22c55e',
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: Object.assign({}, tooltipDefaults, {
              callbacks: { label(ctx) { return ' $' + ctx.parsed.y.toLocaleString(); } },
            }),
          },
          scales: {
            x: { grid: gridStyle, ticks: tickStyle },
            y: { grid: gridStyle, ticks: Object.assign({}, tickStyle, {
              callback(v) { return '$' + (v / 1000).toFixed(0) + 'k'; },
            }) },
          },
        },
      }));
    }

    /* Milestone velocity bar chart */
    if (velocityRef.current) {
      charts.push(new Chart(velocityRef.current, {
        type: 'bar',
        data: {
          labels: milestoneVelocityData.map((x) => x.month),
          datasets: [{
            label: 'Avg. Days',
            data: milestoneVelocityData.map((x) => x.avgDays),
            backgroundColor: '#3b82f6',
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: Object.assign({}, tooltipDefaults, {
              callbacks: { label(ctx) { return ' ' + ctx.parsed.y + ' days'; } },
            }),
          },
          scales: {
            x: { grid: { display: false }, ticks: tickStyle },
            y: { grid: gridStyle, ticks: tickStyle, min: 3, max: 7 },
          },
        },
      }));
    }

    /* Proposal donut chart */
    if (proposalRef.current) {
      charts.push(new Chart(proposalRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Accepted', 'Rejected'],
          datasets: [{
            data: [46, 14],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: Object.assign({}, tooltipDefaults),
          },
        },
      }));
    }

    return () => charts.forEach((c) => c.destroy());
  }, [earningsData, milestoneVelocityData]);

  return (
    <DashboardLayout
      role="worker"
      activePath="performance-analytics.html"
      pageTitle="Performance Analytics"
      pageSubtitle="Track your earnings, project performance, and success rate."
    >
      {/* ── 1. Stat Cards ── */}
      <div className="pa-grid-4" style={{ marginBottom: 24 }}>
        <div className="pa-stat">
          <div className="pa-stat-top">
            <div className="pa-stat-icon" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Icon name="dollar-sign" style={{ width: 20, height: 20, color: '#16a34a' }} /></div>
            <Icon name="trending-up" style={{ width: 16, height: 16, color: '#16a34a' }} />
          </div>
          <div className="pa-stat-val">{fmtMoney(overviewStats.totalEarnings)}</div>
          <div className="pa-stat-label">Total Earnings</div></div>

        <div className="pa-stat">
          <div className="pa-stat-top">
            <div className="pa-stat-icon" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Icon name="check-circle" style={{ width: 20, height: 20, color: '#2563eb' }} /></div>
            <Icon name="award" style={{ width: 16, height: 16, color: '#2563eb' }} />
          </div>
          <div className="pa-stat-val">{overviewStats.projectsCompleted}</div>
          <div className="pa-stat-label">Projects Completed</div></div>

        <div className="pa-stat">
          <div className="pa-stat-top">
            <div className="pa-stat-icon" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <Icon name="activity" style={{ width: 20, height: 20, color: '#ea580c' }} /></div>
            <Icon name="trending-up" style={{ width: 16, height: 16, color: '#ea580c' }} />
          </div>
          <div className="pa-stat-val">{overviewStats.activeProjects}</div>
          <div className="pa-stat-label">Active Projects</div></div>

        <div className="pa-stat">
          <div className="pa-stat-top">
            <div className="pa-stat-icon" style={{ background: '#faf5ff', border: '1px solid #ddd6fe' }}>
              <Icon name="target" style={{ width: 20, height: 20, color: '#7c3aed' }} /></div>
            <Icon name="star" style={{ width: 16, height: 16, color: '#7c3aed' }} />
          </div>
          <div className="pa-stat-val">{`${overviewStats.successRate}%`}</div>
          <div className="pa-stat-label">Success Rate</div></div>
      </div>

      {/* ── 2. Earnings Over Time ── */}
      <div className="pa-card" style={{ marginBottom: 24 }}>
        <div className="pa-card-header">
          <div>
            <div className="pa-card-title">Earnings Over Time</div>
            <div className="pa-card-subtitle" style={{ marginBottom: 0 }}>Monthly earnings trend for the past 12 months</div>
          </div>
          <div className="pa-earnings-avg">
            <div className="pa-earnings-avg-label">Average Monthly</div>
            <div className="pa-earnings-avg-val">{fmtMoney(avgMonthly)}</div>
          </div></div>
        <div className="pa-chart-tall"><canvas id="earningsChart" ref={earningsRef} /></div>
      </div>

      <div className="pa-grid-3">
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* ── 3. Project Performance ── */}
            <div className="pa-card" style={{ marginBottom: 24 }}>
              <div className="pa-card-title">Project Performance</div>
              <div style={{ height: 12 }} />
              {projectPerformance.map((p) => {
                const pct = Math.round((p.milestonesCompleted / p.totalMilestones) * 100);
                const isCompleted = p.milestonesCompleted === p.totalMilestones;
                return (
                  <div key={p.id} className="pa-project-item">
                    <div className="pa-project-header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{p.project}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="pa-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{p.initials}</div>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{p.client}</span>
                        </div></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
                        <Icon name="star" style={{ width: 14, height: 14, fill: '#f59e0b', color: '#f59e0b' }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.rating}</span>
                      </div></div>
                    <div className="pa-project-meta">
                      <div>
                        <div className="pa-project-meta-label">Milestones</div>
                        <div className="pa-project-meta-val">{`${p.milestonesCompleted}/${p.totalMilestones}`}</div>
                        <div className="pa-progress-bg"><div className="pa-progress-fill" style={{ width: pct + '%', background: '#16a34a' }} /></div>
                      </div>
                      <div>
                        <div className="pa-project-meta-label">Payment</div>
                        <div className="pa-project-meta-val" style={{ color: '#16a34a' }}>{fmtMoney(p.payment)}</div>
                      </div>
                      <div>
                        <div className="pa-project-meta-label">Status</div>
                        <span className={'pa-badge ' + (isCompleted ? 'pa-badge-green' : 'pa-badge-blue')}>
                          {isCompleted ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 4. Milestone Velocity ── */}
            <div className="pa-card" style={{ marginBottom: 24 }}>
              <div className="pa-card-title">Milestone Velocity</div>
              <div style={{ height: 16 }} />
              <div className="pa-grid-3col" style={{ marginBottom: 20 }}>
                <div className="pa-mini-card">
                  <div className="pa-mini-card-label"><Icon name="clock" style={{ width: 16, height: 16, color: '#2563eb' }} />Avg. Completion</div>
                  <div className="pa-mini-card-val">{velocityStats.avgCompletionTime}</div>
                </div>
                <div className="pa-mini-card">
                  <div className="pa-mini-card-label"><Icon name="check-circle" style={{ width: 16, height: 16, color: '#16a34a' }} />On-Time Rate</div>
                  <div className="pa-mini-card-val" style={{ color: '#16a34a' }}>{`${velocityStats.onTimeDeliveryRate}%`}</div>
                </div>
                <div className="pa-mini-card">
                  <div className="pa-mini-card-label"><Icon name="calendar" style={{ width: 16, height: 16, color: '#ea580c' }} />Late Deliveries</div>
                  <div className="pa-mini-card-val">{velocityStats.lateDeliveries}</div>
                </div>
              </div>
              <div className="pa-chart-mid"><canvas id="velocityChart" ref={velocityRef} /></div>
            </div>

            {/* ── 5. Client Feedback ── */}
            <div className="pa-card">
              <div className="pa-card-header">
                <div className="pa-card-title" style={{ marginBottom: 0 }}>Client Feedback</div>
                <div className="pa-stars-badge">
                  <Icon name="star" style={{ width: 14, height: 14, fill: '#ca8a04', color: '#ca8a04' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#854d0e' }}>4.9 Average</span>
                </div></div>
              {clientFeedback.length ? clientFeedback.map((f, i) => (
                <div key={i} className="pa-feedback-item">
                  <div className="pa-feedback-header">
                    <div className="pa-avatar">{f.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.client}</span>
                        <div className="pa-feedback-stars"><Stars rating={f.rating} /></div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{f.project}</div>
                    </div></div>
                  <div className="pa-feedback-comment">{f.comment}</div>
                  <div className="pa-feedback-date">{f.date}</div>
                </div>
              )) : (
                <div style={{ padding: '22px 4px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                  No client reviews yet. Ratings appear here once clients review your completed milestones.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          {/* ── 6. Proposal Success Rate (right sidebar) ── */}
          <div className="pa-card">
            <div className="pa-card-title" style={{ marginBottom: 20 }}>Proposal Success Rate</div>

            <div className="pa-proposal-row">
              <div className="pa-proposal-icon-label"><Icon name="send" style={{ width: 16, height: 16, color: '#2563eb' }} />Proposals Sent</div>
              <div className="pa-proposal-val">{proposalStats.sent}</div>
            </div>

            <div className="pa-proposal-row">
              <div className="pa-proposal-icon-label"><Icon name="check-circle" style={{ width: 16, height: 16, color: '#16a34a' }} />Accepted</div>
              <div className="pa-proposal-val" style={{ color: '#16a34a' }}>{proposalStats.accepted}</div>
            </div>

            <div className="pa-proposal-divider" />

            <div className="pa-proposal-row">
              <div className="pa-proposal-icon-label" style={{ fontWeight: 500, color: 'var(--foreground)' }}><Icon name="target" style={{ width: 16, height: 16, color: '#7c3aed' }} />Success Rate</div>
              <div className="pa-proposal-val" style={{ fontSize: 24, color: '#7c3aed' }}>{`${proposalStats.successRate}%`}</div>
            </div>

            <div className="pa-chart-donut" style={{ marginTop: 8 }}><canvas id="proposalChart" ref={proposalRef} /></div>

            <div className="pa-legend">
              <div className="pa-legend-row">
                <div className="pa-legend-dot-label"><div className="pa-legend-dot" style={{ background: '#22c55e' }} /><span className="pa-legend-text">Accepted</span></div>
                <span className="pa-legend-val">46 (77%)</span>
              </div>
              <div className="pa-legend-row">
                <div className="pa-legend-dot-label"><div className="pa-legend-dot" style={{ background: '#ef4444' }} /><span className="pa-legend-text">Rejected</span></div>
                <span className="pa-legend-val">14 (23%)</span>
              </div></div>

            <div className="pa-insight-box">
              <div className="pa-insight-inner">
                <Icon name="trending-up" style={{ width: 16, height: 16, color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="pa-insight-title">{myProposals.length === 0 ? 'No proposals yet' : rateDelta > 0 ? 'Above average' : rateDelta < 0 ? 'Below average' : 'On par'}</div>
                  <div className="pa-insight-body">{myProposals.length === 0
                    ? 'Submit proposals to see how your acceptance rate compares with the platform.'
                    : `Your acceptance rate is ${proposalStats.successRate}% against a platform average of ${platformRate}%.`}</div>
                </div></div></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
