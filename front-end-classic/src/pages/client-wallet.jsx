import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import { Validate } from '../lib/validation';
// All three of the page's <style> blocks, in document order (two sat inside the modals).
import css from './client-wallet.css?inline';

const TX_TYPE_MAP = {
  deposit: { label: 'Wallet Top-up', icon: 'arrow-down-circle', color: '#10b981', bg: '#ecfdf5', positive: true },
  'escrow-lock': { label: 'Escrow Funded', icon: 'lock', color: '#6366f1', bg: '#eef2ff', positive: false },
  'milestone-release': { label: 'Milestone Released', icon: 'unlock', color: '#f59e0b', bg: '#fffbeb', positive: false },
  withdrawal: { label: 'Withdrawal', icon: 'arrow-up-circle', color: '#ef4444', bg: '#fef2f2', positive: false },
  refund: { label: 'Partial Refund', icon: 'rotate-ccw', color: '#a855f7', bg: '#faf5ff', positive: true },
};

const LOCKED_STATUSES = ['pending', 'submitted', 'todo', 'not-started', 'in-progress', 'review', 'audit-requested', 'audit-passed', 'disputed'];
const RELEASED_STATUSES = ['completed', 'approved', 'done', 'paid'];

function computeWalletData(userId) {
  const user = Store.getUserById(userId);
  const userTxs = Store.getTransactionsByUser(userId);
  const allTxs = Store.getTransactions();
  const clientTasks = Store.getTasksByClient(userId);
  const clientTaskIds = new Set(clientTasks.map((t) => t.id));

  const walletBalance = user?.walletBalance || 0;
  const deposits = userTxs.filter((t) => t.type === 'deposit' && t.toId === userId).reduce((s, t) => s + t.amount, 0);
  const spent = userTxs.filter((t) => t.type === 'escrow-lock' && t.fromId === userId).reduce((s, t) => s + t.amount, 0);

  // Total released = milestone-release transactions for this client's tasks (from ALL transactions, not just user's)
  const releaseTxs = allTxs.filter((t) => t.type === 'milestone-release' && clientTaskIds.has(t.taskId));
  const released = releaseTxs.reduce((s, t) => s + t.amount, 0);

  // Active escrow = sum of milestone budgets that are NOT yet released
  let activeEscrowAmount = 0;
  let activeEscrowCount = 0;
  const escrowProjects = [];

  clientTasks.filter((t) => t.status === 'in-progress' || t.status === 'open').forEach((t) => {
    const msList = Store.getMilestonesByTask(t.id);
    const releasedVal = msList.filter((m) => RELEASED_STATUSES.includes(m.status)).reduce((s, m) => s + (m.budget || 0), 0);
    const lockedVal = msList.filter((m) => LOCKED_STATUSES.includes(m.status)).reduce((s, m) => s + (m.budget || 0), 0);
    const total = msList.reduce((s, m) => s + (m.budget || 0), 0) || t.budget;
    const pct = total ? Math.round((releasedVal / total) * 100) : 0;

    if (lockedVal > 0) activeEscrowCount++;
    activeEscrowAmount += lockedVal;

    escrowProjects.push({
      name: t.title,
      worker: Store.getUserById(t.workerId)?.name || 'TBD',
      locked: '$' + lockedVal.toLocaleString(),
      released: '$' + releasedVal.toLocaleString(),
      total: '$' + total.toLocaleString(),
      progress: pct,
    });
  });

  // Build combined transaction list: user's own txs + milestone-releases for their tasks
  const userTxIds = new Set(userTxs.map((t) => t.id));
  const combinedTxs = [...userTxs, ...releaseTxs.filter((t) => !userTxIds.has(t.id))];
  const transactions = combinedTxs.map((tx) => {
    const cfg = TX_TYPE_MAP[tx.type] || { label: tx.type, icon: 'circle', color: '#64748b', bg: '#f1f5f9', positive: false };
    const task = Store.getTaskById(tx.taskId);
    return { type: tx.type, label: cfg.label, sub: (task?.title || 'Platform') + ' • ' + (tx.createdAt || new Date().toISOString().slice(0, 10)), amount: (cfg.positive ? '+' : '-') + '$' + tx.amount.toLocaleString(), positive: cfg.positive, icon: cfg.icon, color: cfg.color, bg: cfg.bg };
  });

  return { walletBalance, deposits, spent, released, activeEscrowAmount, activeEscrowCount, escrowProjects, transactions };
}

const money2 = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AMOUNTS = ['$500', '$1,000', '$2,000', '$5,000', '$10,000', 'Custom'];
const METHODS = [
  { id: 'bank', name: 'Bank Transfer (ACH)', desc: 'Free • 1-2 business days', icon: 'building-2', color: '#10b981', bg: '#ecfdf5' },
  { id: 'card', name: 'Credit/Debit Card', desc: 'Instant • 2.9% fee', icon: 'credit-card', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'wire', name: 'Wire Transfer', desc: 'Instant • $25 fee', icon: 'zap', color: '#a855f7', bg: '#faf5ff' },
];
const QUICK_WITHDRAW = ['$100', '$500', '$1000', '$2500'];

// Inline hover handlers, as the original wrote them.
const setStyles = (el, styles) => { Object.assign(el.style, styles); };
const closeBtnOver = (e) => { e.currentTarget.style.transform = 'scale(1.1)'; };
const closeBtnOut = (e) => { e.currentTarget.style.transform = 'scale(1)'; };
const closeBtnStyle = { background: 'linear-gradient(135deg,#f3e8ff,#ede9fe)', border: 'none', cursor: 'pointer', color: '#7c3aed', width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' };
const gradientHeading = { fontSize: 24, fontWeight: 700, marginBottom: 4, background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' };
const sysFont = 'system-ui,-apple-system,sans-serif';

function WalletContent({ d, onAddFunds, onWithdraw, onAllTransactions }) {
  const stats = [
    { label: 'Total Deposited', val: '$' + d.deposits.toLocaleString(), color: '#6366f1', icon: 'arrow-down-circle' },
    { label: 'Total Spent', val: '$' + d.spent.toLocaleString(), color: '#f97316', icon: 'trending-up' },
    { label: 'Total Released', val: '$' + d.released.toLocaleString(), color: '#10b981', icon: 'unlock' },
    { label: 'Active Escrows', val: d.activeEscrowCount.toString(), color: '#a855f7', icon: 'lock' },
  ];

  return (
    <>
      <div className="wallet-grid">
        <div className="wallet-card" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 8 }}>Available Balance</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20 }} id="availableBalanceDisplay">{`$${d.walletBalance.toLocaleString()}`}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onAddFunds}
                style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              >+ Add Funds</button>
              <button
                onClick={onWithdraw}
                style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              >Withdraw</button>
            </div>
          </div>
        </div>
        <div className="wallet-card" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, marginBottom: 8 }}>Total in Escrow</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>{`$${d.activeEscrowAmount.toLocaleString()}`}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>{`Across ${d.activeEscrowCount} active project${d.activeEscrowCount !== 1 ? 's' : ''}`}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.9 }}>
              <Icon name="shield-check" style={{ width: 14, height: 14 }} /> Secured &amp; Protected
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div><div className="stat-val" style={{ color: s.color }}>{s.val}</div><div className="stat-label">{s.label}</div></div>
            <div className="stat-icon-wrap" style={{ background: `${s.color}20` }}>
              <Icon name={s.icon} style={{ width: 20, height: 20, color: s.color }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Escrow by Project</h3>
          {d.escrowProjects.length ? d.escrowProjects.map((p, i) => (
            <div key={i} className="escrow-project">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{p.total}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>{`Worker: ${p.worker}`}</div>
              <div style={{ height: 6, borderRadius: 9999, background: 'var(--muted)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg,#10b981,#34d399)', width: `${p.progress}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#10b981', fontWeight: 500 }}>{`Released: ${p.released}`}</span>
                <span style={{ color: '#6366f1', fontWeight: 500 }}>{`Locked: ${p.locked}`}</span>
              </div>
            </div>
          )) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No active projects with escrow funded.</div>}
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Transactions</h3>
            <button className="btn-outline" style={{ fontSize: 13, padding: '5px 12px' }} onClick={onAllTransactions}>View All</button>
          </div>
          {d.transactions.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <Icon name="wallet" style={{ width: 40, height: 40, opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No transactions yet</div>
              <div style={{ fontSize: 13 }}>Transactions will appear here once you fund a project.</div>
            </div>
          ) : d.transactions.slice(-10).reverse().map((t, i) => (
            <div key={i} className="tx-row">
              <div className="tx-icon" style={{ background: t.bg }}>
                <Icon name={t.icon} style={{ width: 18, height: 18, color: t.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.sub}</div>
              </div>
              <span className={t.positive ? 'tx-amount-pos' : 'tx-amount-neg'}>{t.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** showNotification(): the withdraw flow's own toast, appended to the page. */
function Notification({ n, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    let removeTimer;
    const t = setTimeout(() => {
      setLeaving(true);
      removeTimer = setTimeout(() => doneRef.current(), 300);
    }, 3500);
    return () => { clearTimeout(t); clearTimeout(removeTimer); };
  }, []);
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: n.bg, color: 'white', padding: '16px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: leaving ? 'slideInLeft 0.3s ease reverse' : 'slideInRight 0.3s ease' }}>{n.message}</div>
  );
}

export default function ClientWallet() {
  usePageStyle(css);
  const [walletUserId] = useState(() => Auth.getCurrentUser()?.userId || 'u1');
  const [d, setD] = useState(() => computeWalletData(walletUserId));
  const availableBalance = d.walletBalance;

  // Add Funds modal
  const [addFundsDisplay, setAddFundsDisplay] = useState('none');
  const [currentBalanceText, setCurrentBalanceText] = useState('$4,875');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [customDisplay, setCustomDisplay] = useState('none');
  const [customValue, setCustomValue] = useState('');
  const [processingTime, setProcessingTime] = useState('Select a payment method to see processing time');
  const [focusCustom, setFocusCustom] = useState(0);
  const amountBtnRefs = useRef({});
  const customInputRef = useRef(null);

  // Withdraw modal
  const [withdrawDisplay, setWithdrawDisplay] = useState('none');
  const [withdrawAmount, setWithdrawAmountValue] = useState('');
  const [withdrawBalanceText, setWithdrawBalanceText] = useState('$4,875');

  // All transactions modal
  const [allTxDisplay, setAllTxDisplay] = useState('none');
  const [allTx, setAllTx] = useState(null);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (focusCustom) customInputRef.current?.focus();
  }, [focusCustom]);

  const refreshWallet = () => setD(computeWalletData(walletUserId));

  const showNotification = (message, type) => {
    const bg = type === 'success' ? '#10b981' : '#ef4444';
    setNotifications((list) => [...list, { id: Date.now() + Math.random(), message, bg }]);
  };
  const removeNotification = (id) => setNotifications((list) => list.filter((n) => n.id !== id));

  // The selected amount button's styling was set inline by its handlers
  // (and its hover handlers reset it), so it stays imperative here.
  const clearAmountSelection = () => {
    if (!selectedAmount) return;
    const b = amountBtnRefs.current[selectedAmount];
    if (!b) return;
    b.style.borderColor = '#e5e7eb';
    b.style.background = 'white';
    const bg = b.querySelector('.amount-bg');
    if (bg) bg.style.opacity = '0';
  };

  const showAddFunds = () => {
    setAddFundsDisplay('flex');
    setCurrentBalanceText(money2(availableBalance));

    // Reset previous modal state
    clearAmountSelection();
    setSelectedAmount(null);
    setSelectedMethod(null);
    setCustomDisplay('none');
    setCustomValue('');
    setProcessingTime('Select payment method for time/fee');
  };

  const selectAmount = (amt, el) => {
    // Clear existing amount selections
    clearAmountSelection();

    // Select current amount button
    el.style.borderColor = '#6366f1';
    el.style.background = '#eef2ff';
    el.querySelector('.amount-bg').style.opacity = '0.1';
    setSelectedAmount(amt);

    // Handle custom amount
    if (amt === 'Custom') {
      setCustomDisplay('block');
      setFocusCustom((n) => n + 1);
    } else {
      setCustomDisplay('none');
      setCustomValue('');
    }
  };

  const selectPaymentMethod = (methodId) => {
    setSelectedMethod(methodId);

    // Update processing time
    switch (methodId) {
      case 'bank':
        setProcessingTime('1-2 business days • Free');
        break;
      case 'card':
        setProcessingTime('Instant • 2.9% processing fee');
        break;
      case 'wire':
        setProcessingTime('Instant • $25 flat fee');
        break;
      default:
    }
  };

  const currentAddAmount = () => {
    let amount = 0;
    if (selectedAmount) {
      if (selectedAmount === 'Custom') {
        amount = parseFloat(customValue) || 0;
      } else {
        amount = parseFloat(selectedAmount.replace(/[$,]/g, '')) || 0;
      }
    }
    return amount;
  };

  // Matches the server: one processing fee, and the wallet is credited the net.
  const addAmount = currentAddAmount();
  const addQuote = Store.Fees.deposit(addAmount);

  const processAddFunds = () => {
    const amount = currentAddAmount();

    if (amount <= 0) {
      Validate.toast('Please select or enter a valid amount greater than 0.', 'error');
      return;
    }

    if (!selectedMethod) {
      Validate.toast('Please select a payment method.', 'error');
      return;
    }

    // One call: the server charges card processing, credits the net and writes
    // the ledger row together.
    const deposit = Store.addToWallet(walletUserId, amount);
    if (!deposit) {
      Validate.toast('Deposit failed. Please check your connection and try again.', 'error');
      return;
    }

    // Close modal and refresh all wallet data
    setAddFundsDisplay('none');
    refreshWallet();

    Validate.toast('✓ $' + deposit.net.toFixed(2) + ' credited to your wallet ($'
      + deposit.fee.toFixed(2) + ' processing fee).', 'success');
  };

  const showAllTransactions = () => {
    const fresh = computeWalletData(walletUserId);
    setAllTx(fresh.transactions.slice().reverse());
    setAllTxDisplay('flex');
  };

  const showWithdraw = () => {
    setWithdrawDisplay('flex');
    setWithdrawAmountValue('');
    setWithdrawBalanceText(money2(availableBalance));
  };

  const setWithdrawAmount = (amt) => {
    const amount = parseFloat(amt.replace('$', ''));
    if (amount <= availableBalance) {
      setWithdrawAmountValue(String(amount));
    }
  };

  const wAmount = parseFloat(withdrawAmount) || 0;
  const wQuote = Store.Fees.withdrawal(wAmount);

  const processWithdraw = () => {
    const amount = parseFloat(withdrawAmount) || 0;

    if (amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    if (amount < 50) {
      showNotification('Minimum withdrawal amount is $50', 'error');
      return;
    }

    if (amount > availableBalance) {
      showNotification('Insufficient balance for this withdrawal', 'error');
      return;
    }

    // One call: the server debits the gross, keeps the payout fee and writes
    // the ledger row together.
    const result = Store.withdrawFromWallet(walletUserId, amount);
    if (!result) {
      showNotification('Withdrawal failed. Your balance may have changed — reopen and try again.', 'error');
      return;
    }

    // Close modal and refresh all wallet data
    setWithdrawDisplay('none');
    refreshWallet();

    showNotification('✓ Withdrawal of $' + amount.toFixed(2) + ' processed successfully! Funds will arrive in 1-2 business days.', 'success');
  };

  return (
    <DashboardLayout role="client" activePath="client-wallet.html" pageTitle="Wallet & Escrow" pageSubtitle="Manage your balance and track escrow payments">
      <div id="walletDynamicContent">
        <WalletContent d={d} onAddFunds={showAddFunds} onWithdraw={showWithdraw} onAllTransactions={showAllTransactions} />
      </div>

      {/* Add Funds Modal */}
      <div id="addFundsModal" style={{ display: addFundsDisplay, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'flex-start', justifyContent: 'center', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ background: 'white', borderRadius: 28, width: '100%', maxWidth: 520, margin: '0 auto', boxShadow: '0 40px 100px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, padding: '32px 32px 0' }}>
            <div>
              <h2 style={gradientHeading}>Add Funds</h2>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Securely add money to your Lannent wallet</p>
            </div>
            <button onClick={() => setAddFundsDisplay('none')} style={closeBtnStyle} onMouseOver={closeBtnOver} onMouseOut={closeBtnOut}>
              <Icon name="x" style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Current Balance Info */}
          <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', border: '1px solid #a7f3d0', borderRadius: 16, padding: 20, margin: '0 32px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600, marginBottom: 6 }}>💰 Current Balance</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#059669', letterSpacing: '-0.02em' }} id="currentBalanceDisplay">{currentBalanceText}</div>
          </div>

          {/* Amount Selection */}
          <div style={{ padding: '0 32px', marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Choose Amount</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  ref={(el) => { amountBtnRefs.current[amt] = el; }}
                  className={selectedAmount === amt ? 'amount-selected' : undefined}
                  onClick={(e) => selectAmount(amt, e.currentTarget)}
                  style={{ padding: 14, borderRadius: 14, border: '2px solid #e5e7eb', background: 'white', fontSize: 15, fontWeight: 600, color: '#111827', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={(e) => setStyles(e.currentTarget, { borderColor: '#6366f1', background: '#f8fafc', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(99,102,241,0.15)' })}
                  // The original tested classList.contains('selected'), a class nothing
                  // ever set, so leaving a button always restores the unselected look.
                  onMouseLeave={(e) => setStyles(e.currentTarget, { borderColor: '#e5e7eb', background: 'white', transform: 'translateY(0)', boxShadow: 'none' })}
                >
                  <span style={{ position: 'relative', zIndex: 1 }}>{amt}</span>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#6366f1,#a855f7)', opacity: 0, transition: 'opacity 0.2s' }} className="amount-bg" />
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div id="customAmountSection" style={{ display: customDisplay, marginTop: 16 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 600, color: '#6366f1' }}>$</span>
                <input
                  type="number"
                  id="customAmountInput"
                  ref={customInputRef}
                  placeholder="Enter custom amount"
                  style={{ width: '100%', padding: '14px 14px 14px 38px', border: '2px solid #ddd6fe', borderRadius: 12, fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: sysFont, background: 'white', outline: 'none', transition: 'all 0.2s' }}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#a855f7'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#ddd6fe'; }}
                />
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div style={{ padding: '0 32px', marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Payment Method</label>
            <div style={{ display: 'grid', gap: 10 }}>
              {METHODS.map((method) => (
                <div
                  key={method.id}
                  className={selectedMethod === method.id ? 'method-selected' : undefined}
                  onClick={() => selectPaymentMethod(method.id)}
                  style={{ padding: 16, border: '2px solid #e5e7eb', borderRadius: 14, background: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => setStyles(e.currentTarget, { borderColor: '#6366f1', background: '#f8fafc' })}
                  // Same never-set 'selected' class as the amount buttons.
                  onMouseLeave={(e) => setStyles(e.currentTarget, { borderColor: '#e5e7eb', background: 'white' })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: method.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={method.icon} style={{ width: 22, height: 22, color: method.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{method.name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{method.desc}</div>
                    </div>
                    <div style={{ width: 20, height: 20, border: '2px solid #d1d5db', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className="method-radio">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', opacity: selectedMethod === method.id ? '1' : '0', transition: 'opacity 0.2s' }} className="method-radio-dot" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Amount Preview */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, margin: '0 32px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>You pay</span>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: 15 }} id="previewAddAmount">{money2(addQuote.gross)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>Processing fee (2.9% + $0.30)</span>
              <span style={{ fontWeight: 600, color: '#ef4444', fontSize: 14 }} id="previewFee">{addAmount > 0 ? money2(addQuote.fee) : '$0.00'}</span>
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Total You&apos;ll Pay</span>
              <span style={{ fontSize: 20, fontWeight: 900, background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} id="previewTotal">{addAmount > 0 ? money2(addQuote.net) : '$0.00'}</span>
            </div>
          </div>

          {/* Security & Info */}
          <div style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, margin: '0 32px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shield-check" style={{ width: 16, height: 16, color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Secure &amp; Protected</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>256-bit SSL encryption • PCI DSS compliant</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clock" style={{ width: 16, height: 16, color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Processing Time</div>
                <div style={{ fontSize: 12, color: '#6b7280' }} id="processingTime">{processingTime}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 14, padding: '0 32px 32px' }}>
            <button
              onClick={() => setAddFundsDisplay('none')}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', fontSize: 14, fontWeight: 600, color: '#111827', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              Cancel
            </button>
            <button
              onClick={processAddFunds}
              style={{ flex: 2, padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)'; }}
            >
              💳 Add Funds Securely
            </button>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <div id="withdrawModal" style={{ display: withdrawDisplay, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'flex-start', justifyContent: 'center', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ background: 'white', borderRadius: 28, padding: 40, width: '100%', maxWidth: 500, margin: '0 auto', boxShadow: '0 40px 100px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <h2 style={gradientHeading}>Withdraw Funds</h2>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Securely transfer funds to your bank account</p>
            </div>
            <button onClick={() => setWithdrawDisplay('none')} style={closeBtnStyle} onMouseOver={closeBtnOver} onMouseOut={closeBtnOut}>
              <Icon name="x" style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Available Balance Info */}
          <div style={{ background: 'linear-gradient(135deg,#f3e8ff,#ede9fe)', border: '1px solid #ddd6fe', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#6b21a8', fontWeight: 600, marginBottom: 6 }}>💰 Available for Withdrawal</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed', letterSpacing: '-0.02em' }} id="withdrawAvailableDisplay">{withdrawBalanceText}</div>
          </div>

          {/* Withdrawal Amount Input */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 12 }}>How much would you like to withdraw?</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 16, fontSize: 18, fontWeight: 600, color: '#7c3aed' }}>$</span>
              <input
                type="number"
                id="withdrawAmount"
                placeholder="0.00"
                style={{ width: '100%', padding: '14px 14px 14px 38px', border: '2px solid #ddd6fe', borderRadius: 12, fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: sysFont, background: 'white', outline: 'none', transition: 'all 0.2s' }}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmountValue(e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#a855f7'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#ddd6fe'; }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Minimum: <strong>$50</strong> | Maximum: <strong id="maxWithdrawAmt">{withdrawBalanceText}</strong></div>
          </div>

          {/* Quick Amount Selection */}
          <div style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 10, fontSize: 12 }}>Quick Amounts</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {QUICK_WITHDRAW.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setWithdrawAmount(amt)}
                  style={{ padding: 10, borderRadius: 10, border: '1px solid #ddd6fe', background: 'white', fontSize: 13, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => setStyles(e.currentTarget, { background: '#f3e8ff', borderColor: '#a855f7' })}
                  onMouseLeave={(e) => setStyles(e.currentTarget, { background: 'white', borderColor: '#ddd6fe' })}
                >{amt}</button>
              ))}
            </div>
          </div>

          {/* Withdrawal Preview */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Amount to Withdraw</span>
              <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }} id="previewAmount">{money2(wAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Payout fee (0.25% + $0.25)</span>
              <span style={{ fontWeight: 600, color: '#ef4444', fontSize: 13 }} id="withdrawPreviewFee">{wAmount > 0 ? money2(wQuote.fee) : '$0.00'}</span>
            </div>
            <div style={{ height: 1, background: '#e5e7eb', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>You&apos;ll Receive</span>
              <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#10b981,#059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} id="previewReceive">{wAmount > 0 ? money2(wQuote.net) : '$0.00'}</span>
            </div>
          </div>

          {/* Bank Account Selection */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 10 }}>Withdraw to</label>
            <select
              id="withdrawAccount"
              style={{ width: '100%', padding: '12px 14px', border: '2px solid #ddd6fe', borderRadius: 12, fontSize: 14, fontFamily: sysFont, color: '#111827', background: 'white', cursor: 'pointer', outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#a855f7'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#ddd6fe'; }}
            >
              <option>💳 Chase Bank ••••5241</option>
              <option>🏦 Bank of America ••••3892</option>
              <option>+ Add New Bank Account</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setWithdrawDisplay('none')}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', fontSize: 14, fontWeight: 600, color: '#111827', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              Cancel
            </button>
            <button
              onClick={processWithdraw}
              style={{ flex: 1.5, padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)'; }}
            >
              ✓ Confirm Withdrawal
            </button>
          </div>
        </div>
      </div>

      {/* All Transactions Modal */}
      <div id="allTransactionsModal" style={{ display: allTxDisplay, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, alignItems: 'flex-start', justifyContent: 'center', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '20px 0' }}>
        <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 600, boxShadow: '0 40px 100px rgba(0,0,0,0.2)', margin: '0 auto', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 32px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#f3e8ff,#ede9fe)' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>All Transactions</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0 0' }}>Complete transaction history</p>
            </div>
            <button onClick={() => setAllTxDisplay('none')} style={{ ...closeBtnStyle, width: 36, height: 36 }} onMouseOver={closeBtnOver} onMouseOut={closeBtnOut}>
              <Icon name="x" style={{ width: 20, height: 20 }} />
            </button>
          </div>

          {/* Transactions List */}
          <div style={{ padding: '24px 32px', maxHeight: 600, overflowY: 'auto' }} id="allTransactionsListContainer">
            {allTx === null ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading transactions...</div>
            ) : allTx.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No transactions found.</div>
            ) : allTx.map((t, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12, transition: 'all 0.2s' }}
                onMouseOver={(e) => setStyles(e.currentTarget, { background: '#f9fafb', borderColor: '#d1d5db' })}
                onMouseOut={(e) => setStyles(e.currentTarget, { background: 'white', borderColor: '#e5e7eb' })}
              >
                <div className="tx-icon" style={{ background: t.bg, flexShrink: 0 }}>
                  <Icon name={t.icon} style={{ width: 18, height: 18, color: t.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{t.sub}</div>
                </div>
                <span className={t.positive ? 'tx-amount-pos' : 'tx-amount-neg'} style={{ fontSize: 16, fontWeight: 700 }}>{t.amount}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: '20px 32px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setAllTxDisplay('none')}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'white', border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111827', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => setStyles(e.currentTarget, { background: '#f3e8ff', borderColor: '#a855f7', color: '#7c3aed' })}
              onMouseLeave={(e) => setStyles(e.currentTarget, { background: 'white', borderColor: '#e5e7eb', color: '#111827' })}
            >
              Close
            </button>
          </div>
        </div>
      </div>
      {notifications.map((n) => <Notification key={n.id} n={n} onDone={() => removeNotification(n.id)} />)}
    </DashboardLayout>
  );
}
