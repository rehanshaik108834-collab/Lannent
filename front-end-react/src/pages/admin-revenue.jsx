import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import css from './admin-revenue.css?inline';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
  return '$' + v.toFixed(0);
};
const prettyFee = (t) => ({
  'deposit-processing': 'Deposit processing',
  'client-marketplace': 'Client marketplace',
  'contract-initiation': 'Contract initiation',
  'worker-service': 'Worker service',
  'expert-service': 'Reviewer commission',
  'withdrawal-processing': 'Withdrawal payout',
}[t] || t);

// The subtitle was written once with the initial period and never updated.
const INITIAL_PERIOD = 'month';

function load() {
  return {
    summary: Store.getRevenueSummary(),
    byFeeType: Store.getRevenueByFeeType(),
    timeseries: Store.getRevenueTimeseries(INITIAL_PERIOD),
    distribution: Store.getRevenueDistribution(),
    byProject: Store.getRevenueByProject(),
  };
}

// ── Tooltip ────────────────────────────────────────────────────────────
// Created in <body> on first hover, then kept (hidden) like the original.
function useTip() {
  const [tip, setTip] = useState(null);
  const elRef = useRef(null);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !tip || !tip.on) return;
    const pad = 14;
    let x = tip.clientX + pad, y = tip.clientY - pad;
    const r = el.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = tip.clientX - r.width - pad;
    if (y < 8) y = tip.clientY + pad;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }, [tip]);

  const showTip = (evt, content) => setTip({ on: true, content, clientX: evt.clientX, clientY: evt.clientY });
  const hideTip = () => setTip((t) => (t ? { ...t, on: false } : { on: false, content: null }));

  const node = tip
    ? createPortal(<div id="vizTip" className={'viz-tip' + (tip.on ? ' on' : '')} ref={elRef}>{tip.content}</div>, document.body)
    : null;
  return { showTip, hideTip, node };
}

const emptyPlot = (text) => (
  <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>{text}</div>
);

// ── Chart 1: revenue over time (single series, no legend) ──────────────
function Timeseries({ rows, period, showTip, hideTip }) {
  const crossRef = useRef(null);
  if (!rows.length) return emptyPlot('No revenue recorded yet.');

  const W = 720, H = 250, L = 58, R = 22, T = 26, B = 34;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const x = (i) => (rows.length === 1 ? L + iw / 2 : L + (i / (rows.length - 1)) * iw);
  const y = (v) => T + ih - (v / niceMax) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.revenue).toFixed(1)}`).join(' ');
  const area = rows.length > 1
    ? `${line} L${x(rows.length - 1).toFixed(1)},${(T + ih).toFixed(1)} L${x(0).toFixed(1)},${(T + ih).toFixed(1)} Z`
    : '';

  // Label the ends only — never a number on every point.
  // Anchor the first and last labels inward so they cannot overrun the viewBox.
  const anchorFor = (i) => (i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle');
  const labelIdx = new Set([0, rows.length - 1]);

  // With many buckets, thin the labels rather than letting them collide.
  const step = Math.ceil(rows.length / 8);

  const onMove = (e, i) => {
    const r = rows[i];
    const cross = crossRef.current;
    if (!cross) return;
    cross.setAttribute('x1', x(i).toFixed(1));
    cross.setAttribute('x2', x(i).toFixed(1));
    cross.setAttribute('opacity', '1');
    showTip(e, <>{r.period}<br /><b>{money(r.revenue)}</b>{` from ${r.events} fee${r.events === 1 ? '' : 's'}`}</>);
  };
  const onLeave = () => { crossRef.current?.setAttribute('opacity', '0'); hideTip(); };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Platform revenue by ${period}`}>
      {ticks.map((t, k) => [
        <line key={'l' + k} className="viz-grid-line" x1={L} x2={W - R} y1={y(t).toFixed(1)} y2={y(t).toFixed(1)} />,
        <text key={'t' + k} className="viz-tick" x={L - 9} y={(y(t) + 4).toFixed(1)} textAnchor="end">{compact(t)}</text>,
      ])}
      {area ? <path d={area} fill="var(--series-1)" opacity="0.10" /> : null}
      <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {rows.map((r, i) => [
        <circle key={'c' + i} cx={x(i).toFixed(1)} cy={y(r.revenue).toFixed(1)} r="4.5" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />,
        labelIdx.has(i) ? (
          <text key={'v' + i} className="viz-value" x={x(i).toFixed(1)} y={Math.max(y(r.revenue) - 12, 12).toFixed(1)} textAnchor={anchorFor(i)}>{compact(r.revenue)}</text>
        ) : null,
      ])}
      <line className="viz-axis-line" x1={L} x2={W - R} y1={T + ih} y2={T + ih} />
      {rows.map((r, i) => {
        const keep = i === 0 || i === rows.length - 1 || i % step === 0;
        return keep
          ? <text key={i} className="viz-tick" x={x(i).toFixed(1)} y={H - 12} textAnchor={anchorFor(i)}>{r.period}</text>
          : null;
      })}
      <line id="tsCross" ref={crossRef} x1="0" x2="0" y1={T} y2={T + ih} stroke="var(--viz-axis)" strokeWidth="1" strokeDasharray="3 3" opacity="0" />
      {/* Hit targets wider than the marks. */}
      {rows.map((r, i) => {
        const w = rows.length === 1 ? iw : iw / (rows.length - 1);
        return (
          <rect
            key={i} x={(x(i) - w / 2).toFixed(1)} y={T} width={w.toFixed(1)} height={ih}
            fill="transparent" data-i={i} className="ts-hit" style={{ cursor: 'crosshair' }}
            onMouseMove={(e) => onMove(e, i)} onMouseLeave={onLeave}
          />
        );
      })}
    </svg>
  );
}

// ── Chart 2: revenue by fee type (ranked magnitude, one hue) ───────────
function ByFeeType({ rows, showTip, hideTip }) {
  if (!rows.length) return emptyPlot('No fees charged yet.');
  const rowH = 34, gap = 8, L = 150, R = 74;
  const W = 620, H = rows.length * (rowH + gap) + 8;
  const iw = W - L - R;
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Revenue by fee type">
      {rows.map((r, i) => {
        const y = i * (rowH + gap) + 4;
        const w = Math.max((r.total / max) * iw, 2);
        return [
          <text key={'l' + i} className="viz-label" x={L - 12} y={y + rowH / 2 + 4} textAnchor="end">{prettyFee(r.feeType)}</text>,
          <rect
            key={'r' + i} x={L} y={y} width={w.toFixed(1)} height={rowH} rx="4"
            fill="var(--series-1)" className="fee-bar" data-i={i} style={{ cursor: 'pointer' }}
            onMouseMove={(e) => showTip(e, <>{prettyFee(r.feeType)}<br /><b>{money(r.total)}</b>{` · ${r.share}% of revenue`}<br />{`${r.count} charge${r.count === 1 ? '' : 's'} on ${money(r.baseTotal)}`}</>)}
            onMouseLeave={hideTip}
          />,
          <text key={'v' + i} className="viz-value" x={(L + w + 10).toFixed(1)} y={y + rowH / 2 + 4}>{money(r.total)}</text>,
        ];
      })}
      <line className="viz-axis-line" x1={L} x2={L} y1="0" y2={H} />
    </svg>
  );
}

// ── Chart 3: where each escrowed dollar goes (part-to-whole) ───────────
function distSegments(d) {
  return d.segments.filter((s) => s.amount > 0);
}

function Distribution({ d, showTip, hideTip }) {
  if (!d || !d.totalFunded) return emptyPlot('Nothing has been funded into escrow yet.');
  const segs = distSegments(d);
  const W = 660, H = 62, gapPx = 2;
  let cx = 0;

  // 2px surface gap between adjacent fills.
  const bars = segs.map((s, i) => {
    const w = Math.max((s.amount / d.totalFunded) * W - (i < segs.length - 1 ? gapPx : 0), 1);
    const x = cx;
    cx += w + gapPx;
    const first = i === 0, last = i === segs.length - 1;
    const r = 4;
    // Round only the outer ends of the whole bar.
    const path = `M${(x + (first ? r : 0)).toFixed(1)},0
          H${(x + w - (last ? r : 0)).toFixed(1)}
          ${last ? `a${r},${r} 0 0 1 ${r},${r}` : ''}
          V${(H - (last ? r : 0)).toFixed(1)}
          ${last ? `a${r},${r} 0 0 1 -${r},${r}` : ''}
          H${(x + (first ? r : 0)).toFixed(1)}
          ${first ? `a${r},${r} 0 0 1 -${r},-${r}` : ''}
          V${first ? r : 0}
          ${first ? `a${r},${r} 0 0 1 ${r},-${r}` : ''} Z`;
    return (
      <path
        key={'p' + i} d={path} fill={`var(--series-${(i % 5) + 1})`} className="dist-seg" data-i={i} style={{ cursor: 'pointer' }}
        onMouseMove={(e) => showTip(e, <>{s.label}<br /><b>{money(s.amount)}</b>{` · ${s.share}% of ${money(d.totalFunded)}`}</>)}
        onMouseLeave={hideTip}
      />
    );
  });

  // Direct labels on any segment wide enough — the relief for low-contrast slots.
  cx = 0;
  const labels = segs.map((s, i) => {
    const w = Math.max((s.amount / d.totalFunded) * W - (i < segs.length - 1 ? gapPx : 0), 1);
    const x = cx; cx += w + gapPx;
    if (w < 62) return null;
    return (
      <text key={'t' + i} x={(x + w / 2).toFixed(1)} y={H / 2 + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#fff' }}>{`${s.share}%`}</text>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="How escrowed funds are distributed">
      {bars}{labels}
    </svg>
  );
}

function DistLegend({ d }) {
  if (!d || !d.totalFunded) return null;
  return distSegments(d).map((s, i) => (
    <span key={i} className="viz-legend-item">
      <span className="viz-swatch" style={{ background: `var(--series-${(i % 5) + 1})` }} />
      {` ${s.label} · `}<b style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{money(s.amount)}</b>{' '}
    </span>
  ));
}

// ── Projects, and one project's full money flow ────────────────────────
function line(label, value, opts = {}) {
  const color = opts.fee ? '#b45309' : opts.good ? '#0d9488' : 'inherit';
  const weight = opts.total ? '700' : '400';
  const border = opts.total ? { borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 9 } : {};
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', fontSize: 13, ...border }}>
      <span style={{ color: 'var(--muted-foreground)', fontWeight: weight }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: opts.total ? '700' : '600', color }}>{value}</span>
    </div>
  );
}

const card = (title, body) => (
  <div style={{ background: 'var(--secondary)', borderRadius: 12, padding: 16 }}>
    <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 8 }}>{title}</div>
    {body}
  </div>
);

function ProjectDetail({ b, onClose }) {
  if (!b) return <div style={{ padding: 18, color: 'var(--muted-foreground)' }}>Could not load that project.</div>;
  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{b.project.title}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted-foreground)' }}>
            {`
                ${b.project.category} · budget ${money(b.project.budget)}
                ${b.project.client ? ' · client ' + b.project.client.name : ''}
                ${b.project.worker ? ' · worker ' + b.project.worker.name : ''}
              `}
          </div>
        </div>
        <button className="viz-toggle" onClick={onClose}>Close</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14 }}>
        {card('Client paid in', <>
          {line('Into project escrow', money(b.clientPaid.intoProjectEscrow))}
          {line('Into audit escrow', money(b.clientPaid.intoAuditEscrow))}
          {line('Marketplace fee', money(b.clientPaid.marketplaceFee), { fee: true })}
          {line('Contract initiation', money(b.clientPaid.initiationFee), { fee: true })}
          {line('Total charged', money(b.clientPaid.total), { total: true })}
        </>)}

        {card('Gig worker' + (b.worker.name ? ' — ' + b.worker.name : ''), <>
          {line('Gross released', money(b.worker.grossReleased))}
          {line('Service fees', '−' + money(b.worker.serviceFees), { fee: true })}
          {line('Net received', money(b.worker.netReceived), { total: true, good: true })}
          {line('Milestones paid', String(b.worker.milestonesPaid))}
        </>)}

        {card('Reviewer — audit', <>
          {line('Agreed fees', money(b.reviewerAudit.grossFees))}
          {line('Platform commission', '−' + money(b.reviewerAudit.commission), { fee: true })}
          {line('Net received', money(b.reviewerAudit.netReceived), { total: true, good: true })}
          {line('Audits', String(b.reviewerAudit.count) + (b.reviewerAudit.reviewers.length ? ' · ' + b.reviewerAudit.reviewers.join(', ') : ''))}
        </>)}

        {card('Reviewer — disputes', <>
          {line('Agreed fees', money(b.reviewerDispute.grossFees))}
          {line('Platform commission', '−' + money(b.reviewerDispute.commission), { fee: true })}
          {line('Net received', money(b.reviewerDispute.netReceived), { total: true, good: true })}
          {line('Disputes', String(b.reviewerDispute.count) + (b.reviewerDispute.reviewers.length ? ' · ' + b.reviewerDispute.reviewers.join(', ') : ''))}
        </>)}

        {card('Still held & refunded', <>
          {line('Project escrow', money(b.stillHeld.project))}
          {line('Audit escrow', money(b.stillHeld.audit))}
          {line('Refunded to client', money(b.refundedToClient))}
          {line('Total held', money(b.stillHeld.total), { total: true })}
        </>)}

        {card('Platform earnings', <>
          {line('Marketplace fee', money(b.platformEarnings.marketplaceFee))}
          {line('Contract initiation', money(b.platformEarnings.initiationFee))}
          {line('Worker service fees', money(b.platformEarnings.workerServiceFees))}
          {line('Reviewer commission', money(b.platformEarnings.reviewerCommission))}
          {line('Total earned', money(b.platformEarnings.total), { total: true, good: true })}
        </>)}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 8 }}>Every movement on this project</div>
        <div className="viz-table-wrap">
          <table className="viz-table">
            <thead><tr><th>Movement</th><th>From</th><th>To</th><th className="num">Gross</th><th className="num">Fee</th><th className="num">Net</th><th>Date</th></tr></thead>
            <tbody>
              {b.ledger.map((t, i) => (
                <tr key={i}>
                  <td>{t.type}</td><td>{t.from}</td><td>{t.to}</td>
                  <td className="num">{money(t.gross)}</td>
                  <td className="num" style={{ color: t.fee ? '#b45309' : 'inherit' }}>{t.fee ? money(t.fee) : '—'}</td>
                  <td className="num">{money(t.net)}</td><td>{t.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminRevenue() {
  usePageStyle(css);
  const [data, setData] = useState(load);
  const [period, setPeriodState] = useState(INITIAL_PERIOD);
  const [feeTableOpen, setFeeTableOpen] = useState(false);
  const [distTableOpen, setDistTableOpen] = useState(false);
  // { b, n }: the loaded breakdown, and a counter so re-opening scrolls again.
  const [detail, setDetail] = useState(null);
  const detailRef = useRef(null);
  const { showTip, hideTip, node: tipNode } = useTip();

  useEffect(() => {
    if (detail) detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [detail]);

  const setPeriod = (p) => {
    setPeriodState(p);
    setData((d) => ({ ...d, timeseries: Store.getRevenueTimeseries(p) }));
  };

  const showProject = (taskId) => {
    const b = Store.getProjectBreakdown(taskId);
    setDetail((cur) => ({ b, n: (cur ? cur.n : 0) + 1 }));
  };

  const s = data.summary || {};
  const d = data.distribution || { segments: [], totalFunded: 0 };
  const fees = data.byFeeType || [];
  const projects = data.byProject || [];

  return (
    <DashboardLayout
      role={(Auth.getCurrentUser() || {}).role}
      activePath="admin-revenue.html"
      pageTitle="Revenue"
      pageSubtitle="How the platform earns, and what every user receives"
    >
      <div className="viz">
        <div className="rev-tiles">
          <div className="rev-tile">
            <div className="rev-tile-k">Total revenue</div>
            <div className="rev-tile-v" style={{ color: 'var(--series-1)' }}>{money(s.totalRevenue)}</div>
            <div className="rev-tile-s">{`across ${s.feeEvents || 0} fee events`}</div>
          </div>
          <div className="rev-tile">
            <div className="rev-tile-k">Gross volume</div>
            <div className="rev-tile-v">{money(s.grossVolume)}</div>
            <div className="rev-tile-s">paid to workers and reviewers</div>
          </div>
          <div className="rev-tile">
            <div className="rev-tile-k">Take rate</div>
            <div className="rev-tile-v">{`${s.takeRate ?? 0}%`}</div>
            <div className="rev-tile-s">of value delivered</div>
          </div>
          <div className="rev-tile">
            <div className="rev-tile-k">Held in escrow</div>
            <div className="rev-tile-v">{money(s.escrowHeld)}</div>
            <div className="rev-tile-s">{`${s.activeContracts || 0} active · ${s.draftProjects || 0} draft`}</div>
          </div>
        </div>

        <div className="viz-card">
          <div className="viz-head">
            <div>
              <div className="viz-title">Platform revenue over time</div>
              <div className="viz-sub">{`Every fee the platform charged, bucketed by ${INITIAL_PERIOD}.`}</div>
            </div>
            <div className="rev-period">
              <button className={period === 'day' ? 'on' : undefined} onClick={() => setPeriod('day')}>Day</button>
              <button className={period === 'week' ? 'on' : undefined} onClick={() => setPeriod('week')}>Week</button>
              <button className={period === 'month' ? 'on' : undefined} onClick={() => setPeriod('month')}>Month</button>
            </div>
          </div>
          <div className="viz-plot" id="tsPlot">
            <Timeseries rows={data.timeseries || []} period={period} showTip={showTip} hideTip={hideTip} />
          </div>
        </div>

        <div className="rev-two">
          <div className="viz-card">
            <div className="viz-title">Revenue by fee type</div>
            <div className="viz-sub">Which charges the revenue actually comes from.</div>
            <div className="viz-plot" id="feePlot">
              <ByFeeType rows={fees} showTip={showTip} hideTip={hideTip} />
            </div>
            <button className="viz-toggle" onClick={() => setFeeTableOpen((o) => !o)}>{feeTableOpen ? 'Hide data table' : 'Show data table'}</button>
            <div id="feeTable" hidden={!feeTableOpen} style={{ marginTop: 12 }}>
              <div className="viz-table-wrap">
                <table className="viz-table">
                  <thead><tr><th>Fee type</th><th className="num">Revenue</th><th className="num">Share</th><th className="num">Charges</th><th className="num">Charged on</th></tr></thead>
                  <tbody>
                    {fees.map((r, i) => (
                      <tr key={i}>
                        <td>{prettyFee(r.feeType)}</td>
                        <td className="num">{money(r.total)}</td>
                        <td className="num">{`${r.share}%`}</td>
                        <td className="num">{r.count}</td>
                        <td className="num">{money(r.baseTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="viz-card">
            <div className="viz-title">Where each escrowed dollar goes</div>
            <div className="viz-sub">{`${money(d.totalFunded)} funded into escrow all-time.`}</div>
            <div className="viz-plot" id="distPlot">
              <Distribution d={data.distribution} showTip={showTip} hideTip={hideTip} />
            </div>
            <div className="viz-legend" id="distLegend"><DistLegend d={data.distribution} /></div>
            <button className="viz-toggle" style={{ marginTop: 10 }} onClick={() => setDistTableOpen((o) => !o)}>{distTableOpen ? 'Hide data table' : 'Show data table'}</button>
            <div id="distTable" hidden={!distTableOpen} style={{ marginTop: 12 }}>
              <div className="viz-table-wrap">
                <table className="viz-table">
                  <thead><tr><th>Destination</th><th className="num">Amount</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    {d.segments.map((x, i) => <tr key={i}><td>{x.label}</td><td className="num">{money(x.amount)}</td><td className="num">{`${x.share}%`}</td></tr>)}
                    <tr><td style={{ fontWeight: 700 }}>Total funded</td><td className="num" style={{ fontWeight: 700 }}>{money(d.totalFunded)}</td><td className="num">100%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="viz-card">
          <div className="viz-title">Revenue by project</div>
          <div className="viz-sub">Select a project to see exactly where its money came from and went.</div>
          <div className="viz-table-wrap" id="projectTable">
            {projects.length ? (
              <table className="viz-table">
                <thead><tr>
                  <th>Project</th><th>Status</th>
                  <th className="num">Funded</th><th className="num">Held</th>
                  <th className="num">Platform revenue</th><th />
                </tr></thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.taskId}>
                      <td>{p.title}</td>
                      <td><span className="rev-role">{p.status}</span></td>
                      <td className="num">{money(p.funded)}</td>
                      <td className="num">{money(p.escrowHeld)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{money(p.platformRevenue)}</td>
                      <td className="num"><button className="viz-toggle" onClick={() => showProject(p.taskId)}>Breakdown</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 26, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No project activity yet.</div>
            )}
          </div>
          <div id="projectDetail" ref={detailRef}>
            {detail ? <ProjectDetail key={detail.n} b={detail.b} onClose={() => setDetail(null)} /> : null}
          </div>
        </div>
      </div>
      {tipNode}
    </DashboardLayout>
  );
}
