import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { usePageStyle, useRerender } from '../lib/hooks';
import { useLucideRefresh } from '../lib/hooks';
import css from './worker-wallet.css?inline';

const RELEASED_MS = ['completed', 'approved', 'done', 'paid'];
const PENDING_MS = ['submitted', 'review', 'audit-requested', 'audit-passed', 'disputed'];
const ESCROW_MS = ['pending', 'todo', 'not-started', 'in-progress'];

const statusMap = {
  Released: { cls: 'badge-green', icon: 'check-circle', color: '#10b981' },
  'In Escrow': { cls: 'badge-blue', icon: 'lock', color: '#6366f1' },
  'Pending Approval': { cls: 'badge-orange', icon: 'clock', color: '#f59e0b' },
  Withdrawn: { cls: 'badge-red', icon: 'arrow-up-circle', color: '#ef4444' },
};

function computeWorkerWalletData(userId) {
  const user = Store.getUserById(userId);
  const userTxs = Store.getTransactionsByUser(userId);
  const allTxs = Store.getTransactions();
  const tasks = Store.getTasksByWorker(userId);
  const workerTaskIds = new Set(tasks.map((t) => t.id));

  // Calculate from milestones
  let totalEarned = 0;
  let pending = 0;
  let inEscrow = 0;

  tasks.forEach((t) => {
    const msList = Store.getMilestonesByTask(t.id);
    msList.forEach((m) => {
      if (RELEASED_MS.includes(m.status)) {
        // Counted from the ledger below, not from the gross milestone budget.
      } else if (PENDING_MS.includes(m.status)) {
        pending += (m.budget || 0);
      } else if (ESCROW_MS.includes(m.status)) {
        inEscrow += (m.budget || 0);
      }
    });
  });

  // Build combined transactions: user's own txs + milestone-releases for their tasks
  const releaseTxs = allTxs.filter((t) => t.type === 'milestone-release' && workerTaskIds.has(t.taskId));
  const escrowTxs = allTxs.filter((t) => t.type === 'escrow-lock' && workerTaskIds.has(t.taskId));
  const userTxIds = new Set(userTxs.map((t) => t.id));
  const combinedTxs = [
    ...userTxs,
    ...releaseTxs.filter((t) => !userTxIds.has(t.id)),
    ...escrowTxs.filter((t) => !userTxIds.has(t.id)),
  ];

  // Map transactions for display
  const transactions = combinedTxs.map((t) => {
    const task = Store.getTaskById(t.taskId);
    let status = 'Released';
    if (t.type === 'milestone-release' || t.type === 'escrow-release') status = 'Released';
    else if (t.type === 'escrow-lock') status = 'In Escrow';
    else if (t.type === 'pending') status = 'Pending Approval';
    else if (t.type === 'withdrawal') status = 'Withdrawn';

    const isWithdrawal = t.type === 'withdrawal';
    return {
      id: t.id,
      project: task ? task.title : (t.description || 'Transaction'),
      milestone: t.description || 'Payment',
      amount: t.amount || 0,
      isWithdrawal,
      date: t.createdAt ? String(t.createdAt).slice(0, 10) : 'Recent',
      status,
    };
  });

  // Available = the authoritative server-side wallet balance, not a derived figure.
  const available = user ? (user.walletBalance || 0) : 0;

  // Total earned is what actually reached this worker: the NET of every
  // release, after the platform's service fee.
  totalEarned = allTxs
    .filter((t) => t.type === 'milestone-release' && t.toId === userId)
    .reduce((sum, t) => sum + (t.netAmount != null ? t.netAmount : (t.amount || 0)), 0);

  return { totalEarned, pending, inEscrow, available, transactions };
}

function renderTxRows(transactions, filter) {
  const list = filter === 'all' ? transactions : transactions.filter((e) => e.status === filter);
  if (!list.length) return <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted-foreground)' }}><Icon name="wallet" style={{ width: 40, height: 40, opacity: 0.3, margin: '0 auto 12px', display: 'block' }} /><div>No transactions found.</div></div>;
  return list.map((e, i) => {
    const s = statusMap[e.status] || { cls: 'badge-gray', icon: 'circle', color: '#6366f1' };
    return (
      <div key={e.id ?? i} className="tx-row">
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={s.icon} style={{ width: 18, height: 18, color: s.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.project}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`${e.milestone} · ${e.date}`}</div>
        </div>
        <span className={`badge ${s.cls}`}>{e.status}</span>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
          <div style={{ fontWeight: 700, color: e.isWithdrawal ? '#ef4444' : s.color, fontSize: 15 }}>{`${e.isWithdrawal ? '-' : '+'}$${Math.abs(e.amount).toLocaleString()}`}</div>
        </div>
      </div>
    );
  });
}

const FILTERS = [['all', 'All'], ['Released', 'Released'], ['In Escrow', 'In Escrow'], ['Pending Approval', 'Pending']];
const fmt = (n) => '$' + n.toFixed(2);
const previewRow = { display: 'flex', justifyContent: 'space-between', marginBottom: 8 };

export default function WorkerWallet() {
  usePageStyle(css);
  const session = Auth.getCurrentUser();
  const workerUserId = session.userId;
  const rerender = useRerender();
  const refreshIcons = useLucideRefresh();
  const [currentFilter, setCurrentFilter] = useState('all');

  // Withdraw modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBal, setModalBal] = useState(null); // filled in when the modal is opened
  const [amount, setAmount] = useState('');
  const [amountErr, setAmountErr] = useState('');

  const d = computeWorkerWalletData(workerUserId);

  const filterEarnings = (filter) => { setCurrentFilter(filter); refreshIcons(); };

  const showWithdrawModal = () => {
    setModalBal(computeWorkerWalletData(workerUserId).available);
    setAmount('');
    setModalOpen(true);
  };

  const amt = parseFloat(amount) || 0;
  const q = Store.Fees.withdrawal(amt);

  const confirmWithdraw = () => {
    const value = parseFloat(amount) || 0;
    const bal = computeWorkerWalletData(workerUserId).available;
    setAmountErr('');

    if (value < 50) {
      setAmountErr('Minimum withdrawal is $50.');
      return;
    }
    if (value > bal) {
      setAmountErr('Amount exceeds your available balance of $' + bal.toLocaleString() + '.');
      return;
    }

    // One call: the server debits the gross, keeps the payout fee and writes
    // the ledger row, so a partial failure cannot leave the books unbalanced.
    const result = Store.withdrawFromWallet(workerUserId, value);
    if (!result) {
      setAmountErr('Withdrawal failed. Your balance may have changed — reopen this dialog and try again.');
      return;
    }

    // Close modal and refresh all wallet data
    setModalOpen(false);
    rerender();
    refreshIcons();

    Validate.toast('Withdrew $' + result.gross.toLocaleString() + ' — $' + result.net.toLocaleString()
      + ' sent to your account after a $' + result.fee + ' payout fee.', 'success');
  };

  return (
    <DashboardLayout role="worker" activePath="worker-wallet.html" pageTitle="Wallet & Earnings" pageSubtitle="Track your earnings and manage withdrawals">
      <div id="workerWalletDynamic">
        <div className="wallet-hero" style={{ gridTemplateColumns: '1fr' }}>
          <div className="wallet-hero-card" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginBottom: 8 }}>Available Balance</div>
              <div id="availableBalanceDisplay" style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20 }}>{`$${d.available.toLocaleString()}`}</div>
              <button
                onClick={showWithdrawModal}
                style={{ padding: '9px 22px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              >
                Withdraw Funds
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card"><div><div className="stat-val" style={{ color: '#6366f1' }}>{`$${d.totalEarned.toLocaleString()}`}</div><div className="stat-label">Total Earned</div></div><div className="stat-icon-wrap" style={{ background: '#eef2ff' }}><Icon name="trending-up" style={{ width: 20, height: 20, color: '#6366f1' }} /></div></div>
          <div className="stat-card"><div><div className="stat-val" style={{ color: '#f59e0b' }}>{`$${d.pending.toLocaleString()}`}</div><div className="stat-label">Pending</div></div><div className="stat-icon-wrap" style={{ background: '#fffbeb' }}><Icon name="clock" style={{ width: 20, height: 20, color: '#f59e0b' }} /></div></div>
          <div className="stat-card"><div><div className="stat-val" style={{ color: '#a855f7' }}>{`$${d.inEscrow.toLocaleString()}`}</div><div className="stat-label">In Escrow</div></div><div className="stat-icon-wrap" style={{ background: '#faf5ff' }}><Icon name="lock" style={{ width: 20, height: 20, color: '#a855f7' }} /></div></div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Transaction History</span>
            <div id="earningsFilterBar" style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', padding: 4, borderRadius: 12 }}>
              {FILTERS.map(([val, label]) => {
                const on = val === currentFilter;
                return (
                  <button
                    key={val}
                    onClick={() => filterEarnings(val)}
                    style={{ padding: '5px 12px', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: '0 24px' }} id="earningsContainer">{renderTxRows(d.transactions, currentFilter)}</div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <div id="withdrawModal" style={{ display: modalOpen ? 'flex' : 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', overflow: 'auto' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 26, width: '100%', maxWidth: 520, maxHeight: '90vh', margin: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.15)', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#5f46ff' }}>Withdraw Funds</h2>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>Securely transfer funds to your bank account</p>
            </div>
            <button onClick={() => setModalOpen(false)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#e9e7ff', color: '#5f46ff', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>{'×'}</button>
          </div>
          <div style={{ background: '#f7f4ff', border: '1px solid #e5dbff', borderRadius: 18, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#6b46ff', marginBottom: 8 }}>Available Balance</div>
            <div id="availableBalanceDisplayLarge" style={{ fontSize: 40, fontWeight: 800, color: '#5f46ff' }}>{modalBal === null ? '$0' : '$' + modalBal.toLocaleString()}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Amount to withdraw</label>
            <div style={{ marginTop: 10, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#7c3aed', fontSize: 18, fontWeight: 700 }}>$</span>
              <input
                id="withdrawAmount" type="number" min="50" step="1" placeholder="0.00"
                style={{ width: '100%', padding: '14px 14px 14px 40px', border: amountErr ? '2px solid #ef4444' : '2px solid #e5e7eb', borderRadius: 14, fontSize: 22, fontWeight: 800, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div id="withdrawAmountErr" style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: amountErr ? 'block' : 'none' }}>{amountErr}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>{'Minimum: $50 · Maximum: $'}<span id="withdrawMaxAmount">{modalBal === null ? '0' : String(modalBal)}</span></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Quick Amounts</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[100, 500, 1000, 2500].map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #d7cffd', background: 'white', color: '#5f46ff', fontWeight: 700, cursor: 'pointer' }}>{`$${v}`}</button>)}
            </div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
            <div style={previewRow}><span style={{ color: '#6b7280' }}>Amount</span><span id="previewAmount" style={{ fontWeight: 700 }}>{fmt(amt)}</span></div>
            <div style={previewRow}><span style={{ color: '#6b7280' }}>Payout fee (0.25% + $0.25)</span><span id="previewFee" style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(q.fee)}</span></div>
            <div style={{ height: 1, background: '#eef2ff', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}><span>You&apos;ll Receive</span><span id="previewNet" style={{ color: '#059669' }}>{fmt(q.net)}</span></div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#111827', display: 'block', marginBottom: 8 }}>Withdraw to</label>
            <select id="withdrawDestination" style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 14, color: '#111827' }}>
              <option>{'🏦 Chase Bank ••••5241'}</option>
              <option>{'💳 PayPal ••••1234'}</option>
              <option>{'₿ Crypto Wallet ••••ABCD'}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: 14, border: '1px solid #dcd6ff', borderRadius: 12, background: 'white', fontSize: 15, fontWeight: 700, color: '#5f46ff' }}>Cancel</button>
            <button onClick={confirmWithdraw} style={{ flex: 1, padding: 14, border: 'none', borderRadius: 12, background: '#22c55e', color: 'white', fontSize: 15, fontWeight: 800 }}>{'✓ Confirm'}</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
