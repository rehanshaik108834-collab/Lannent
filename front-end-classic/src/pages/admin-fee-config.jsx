import { useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { usePageStyle } from '../lib/hooks';
import css from './admin-fee-config.css?inline';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const band = (n) => (n === Infinity || n === null || n > 1e9 ? 'above' : '$' + Number(n).toLocaleString());

const tierLabels = ['first band', 'middle band', 'top band'];

function serverShape(c) {
  return {
    depositPercent: c.deposit.percent,
    depositFixed: c.deposit.fixed,
    clientMarketplacePercent: c.clientMarketplace.percent,
    expertServicePercent: c.expertService.percent,
    withdrawalPercent: c.withdrawal.percent,
    withdrawalFixed: c.withdrawal.fixed,
    workerServicePercents: c.workerService.map((t) => t.percent),
    contractInitiationFees: c.contractInitiation.map((t) => t.fee),
  };
}

// The input values, keyed by input id, as the original's value="" attributes.
function inputValues(c) {
  const s = serverShape(c);
  const vals = {
    depositPercent: String(s.depositPercent),
    depositFixed: String(s.depositFixed),
    marketplacePercent: String(s.clientMarketplacePercent),
    expertPercent: String(s.expertServicePercent),
    withdrawalPercent: String(s.withdrawalPercent),
    withdrawalFixed: String(s.withdrawalFixed),
  };
  s.workerServicePercents.forEach((p, i) => { vals['workerTier' + i] = String(p); });
  s.contractInitiationFees.forEach((f, i) => { vals['initBand' + i] = String(f); });
  return vals;
}

function readDraft(vals, cfg) {
  const num = (id) => parseFloat(vals[id]);
  return {
    depositPercent: num('depositPercent'),
    depositFixed: num('depositFixed'),
    clientMarketplacePercent: num('marketplacePercent'),
    expertServicePercent: num('expertPercent'),
    withdrawalPercent: num('withdrawalPercent'),
    withdrawalFixed: num('withdrawalFixed'),
    workerServicePercents: cfg.workerService.map((_, i) => num('workerTier' + i)),
    contractInitiationFees: cfg.contractInitiation.map((_, i) => num('initBand' + i)),
  };
}

const isBad = (draft) => Object.values(draft).flat().some((v) => typeof v !== 'number' || isNaN(v) || v < 0);

// The worked example is computed from the DRAFT, so the effect of a change
// is visible before it is saved.
function Example({ draft }) {
  if (isBad(draft)) return <div style={{ fontSize: 13, color: '#b91c1c' }}>Every rate must be zero or greater.</div>;

  const depFee = r2(1000 * (draft.depositPercent / 100) + draft.depositFixed);
  const mkt = r2(2500 * (draft.clientMarketplacePercent / 100));
  const init = draft.contractInitiationFees[2];              // the $2k–$10k band
  const wFee = r2(800 * (draft.workerServicePercents[1] / 100)); // the mid tier
  const eFee = r2(300 * (draft.expertServicePercent / 100));
  const wd = r2(Math.max(500 * (draft.withdrawalPercent / 100) + draft.withdrawalFixed, 0.25));

  return (
    <>
      <div className="fc-ex-title">Client tops up $1,000</div>
      <div className="fc-ex-row"><span>Charged</span><span className="v">{money(1000)}</span></div>
      <div className="fc-ex-row fc-ex-fee"><span>Processing fee</span><span className="v">{`−${money(depFee)}`}</span></div>
      <div className="fc-ex-row fc-ex-net"><span>Credited to wallet</span><span className="v">{money(1000 - depFee)}</span></div>

      <div className="fc-ex-title">Funding a $2,500 project</div>
      <div className="fc-ex-row"><span>Into escrow</span><span className="v">{money(2500)}</span></div>
      <div className="fc-ex-row fc-ex-fee"><span>Marketplace fee</span><span className="v">{`+${money(mkt)}`}</span></div>
      <div className="fc-ex-row fc-ex-fee"><span>Contract initiation</span><span className="v">{`+${money(init)}`}</span></div>
      <div className="fc-ex-row fc-ex-net"><span>Client pays</span><span className="v">{money(2500 + mkt + init)}</span></div>

      <div className="fc-ex-title">Releasing an $800 milestone</div>
      <div className="fc-ex-row"><span>From escrow</span><span className="v">{money(800)}</span></div>
      <div className="fc-ex-row fc-ex-fee"><span>Service fee (mid tier)</span><span className="v">{`−${money(wFee)}`}</span></div>
      <div className="fc-ex-row fc-ex-net"><span>Worker receives</span><span className="v">{money(800 - wFee)}</span></div>

      <div className="fc-ex-title">Paying a $300 audit</div>
      <div className="fc-ex-row fc-ex-fee"><span>Commission</span><span className="v">{`−${money(eFee)}`}</span></div>
      <div className="fc-ex-row fc-ex-net"><span>Reviewer receives</span><span className="v">{money(300 - eFee)}</span></div>

      <div className="fc-ex-title">Worker withdraws $500</div>
      <div className="fc-ex-row fc-ex-fee"><span>Payout fee</span><span className="v">{`−${money(wd)}`}</span></div>
      <div className="fc-ex-row fc-ex-net"><span>Reaches their bank</span><span className="v">{money(500 - wd)}</span></div>
    </>
  );
}

export default function AdminFeeConfig() {
  usePageStyle(css);
  const [cfg, setCfg] = useState(() => Store.getFeeConfig()); // what the server currently has
  const [vals, setVals] = useState(() => (cfg ? inputValues(cfg) : {})); // local edits
  // renderExample() only rewrote the "Unsaved changes" note when every rate
  // was valid; with an invalid rate the previous note stayed.
  const [dirty, setDirty] = useState('');

  if (!cfg) {
    return (
      <EmptyState
        role={(Auth.getCurrentUser() || {}).role} activePath="admin-fee-config.html" pageTitle="Fee Configuration"
        message="Fee rates could not be loaded. Check that the API is running, then reload."
        linkHref="admin-dashboard.html" linkLabel="Back to Dashboard"
      />
    );
  }

  const renderExample = (nextVals, nextCfg) => {
    const draft = readDraft(nextVals, nextCfg);
    if (isBad(draft)) return;
    const changed = JSON.stringify(draft) !== JSON.stringify(serverShape(nextCfg));
    setDirty(changed ? 'Unsaved changes' : '');
  };

  const onInput = (id, value) => {
    const next = { ...vals, [id]: value };
    setVals(next);
    renderExample(next, cfg);
  };

  const saveConfig = () => {
    const patch = readDraft(vals, cfg);
    if (isBad(patch)) { Validate.toast('Every rate must be zero or greater.', 'error'); return; }

    const result = Store.updateFeeConfig(patch);
    if (!result) { Validate.toast('Could not save the fee configuration.', 'error'); return; }
    setCfg(result);
    Validate.toast('Fee rates saved. They apply to future charges only.', 'success');
    renderExample(vals, result);
  };

  const resetForm = () => {
    const next = { ...vals, ...inputValues(cfg) };
    setVals(next);
    renderExample(next, cfg);
  };

  const numRow = (id, label, note, unit) => (
    <div className="fc-row" key={id}>
      <label htmlFor={id}>{label}<span className="fc-note">{note}</span></label>
      <span className="fc-unit">{unit === '%' ? '' : '$'}</span>
      <input className="fc-input" id={id} type="number" min="0" step="0.01" value={vals[id]} onChange={(e) => onInput(id, e.target.value)} />
      <span className="fc-unit">{unit === '%' ? '%' : ''}</span>
    </div>
  );

  return (
    <DashboardLayout
      role={(Auth.getCurrentUser() || {}).role}
      activePath="admin-fee-config.html"
      pageTitle="Fee Configuration"
      pageSubtitle="Every rate the platform charges"
    >
      <div className="fc-layout">
        <div>
          <div className="fc-card">
            <h2>Money entering and leaving</h2>
            <p className="hint">Charged when a client tops up a wallet, and when anyone withdraws to an external account.</p>
            {numRow('depositPercent', 'Deposit processing rate', 'Percentage of the amount deposited', '%')}
            {numRow('depositFixed', 'Deposit fixed fee', 'Flat amount added to every deposit', '$')}
            {numRow('withdrawalPercent', 'Withdrawal payout rate', 'Percentage of the amount withdrawn', '%')}
            {numRow('withdrawalFixed', 'Withdrawal fixed fee', `Flat amount, with a ${money(cfg.withdrawal.min)} minimum`, '$')}
          </div>

          <div className="fc-card">
            <h2>What the client pays</h2>
            <p className="hint">Charged on top of the project budget when a worker is hired.</p>
            {numRow('marketplacePercent', 'Marketplace fee', 'Percentage of the project budget', '%')}
            {cfg.contractInitiation.map((t, i) => numRow('initBand' + i,
              `Contract initiation — up to ${band(t.upTo)}`,
              i === cfg.contractInitiation.length - 1 ? 'Budgets above the previous band' : 'One-time fee per contract',
              '$'))}
          </div>

          <div className="fc-card">
            <h2>What providers pay</h2>
            <p className="hint">Deducted from a payout before it reaches the recipient. The worker tier is chosen by their lifetime billings with that client, so long relationships get cheaper.</p>
            {cfg.workerService.map((t, i) => numRow('workerTier' + i,
              `Worker service fee — ${tierLabels[i] || 'band ' + (i + 1)}`,
              `Applies up to ${band(t.upTo)} of lifetime billings`, '%'))}
            {numRow('expertPercent', 'Reviewer commission', 'Percentage of an agreed audit fee', '%')}
          </div>

          <div className="fc-card">
            <div className="fc-actions">
              <button className="btn-primary" onClick={saveConfig}>Save rates</button>
              <button className="btn-outline" onClick={resetForm}>Discard changes</button>
              <span className="fc-dirty" id="fcDirty">{dirty}</span>
            </div>
            <p className="hint" style={{ margin: '14px 0 0' }}>Changes apply to future charges only — revenue already recorded keeps the rate it was charged at.</p>
          </div>
        </div>

        <div className="fc-example">
          <div className="fc-card">
            <h2>What this costs, worked through</h2>
            <p className="hint">Updates as you type, before anything is saved.</p>
            <div id="fcExample"><Example draft={readDraft(vals, cfg)} /></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
