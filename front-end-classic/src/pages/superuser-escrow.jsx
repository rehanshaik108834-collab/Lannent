import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { usePageStyle } from '../lib/hooks';
import css from './superuser-escrow.css?inline';

const typeConfig = {
  'escrow-lock': { bg: '#eff6ff', color: '#3b82f6', icon: 'lock', label: 'Escrow Lock' },
  'milestone-release': { bg: '#ecfdf5', color: '#10b981', icon: 'check-circle', label: 'Released' },
  deposit: { bg: '#faf5ff', color: '#a855f7', icon: 'arrow-down-circle', label: 'Deposit' },
  refund: { bg: '#fff7ed', color: '#f97316', icon: 'rotate-ccw', label: 'Refund' },
  withdrawal: { bg: '#fef2f2', color: '#ef4444', icon: 'arrow-up-circle', label: 'Withdrawal' },
  'dispute-release': { bg: '#f5f3ff', color: '#8b5cf6', icon: 'scale', label: 'Dispute Release' },
  'audit-escrow-lock': { bg: '#eef2ff', color: '#6366f1', icon: 'lock', label: 'Audit Escrow' },
  'audit-release': { bg: '#ecfeff', color: '#0891b2', icon: 'clipboard-check', label: 'Audit Payout' },
  'platform-fee': { bg: '#f0fdfa', color: '#0d9488', icon: 'percent', label: 'Platform Fee' },
};

export default function SuperuserEscrow() {
  usePageStyle(css);

  const [allTx] = useState(() => Store.getTransactions());
  // The original filled the table 100ms after the layout rendered.
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Escrow and revenue come from the ledger, which is authoritative. Deriving
  // escrow from transaction rows under-counts: a milestone-release row records
  // the NET paid to the worker, while the full gross left escrow.
  const [ledger] = useState(() => Store.getLedgerSummary());
  const escrowBalance = ledger.totalHeld;
  const platformRevenue = ledger.totalRevenue;

  const gross = (t) => (t.grossAmount != null ? t.grossAmount : t.amount);
  const totalReleased = allTx.filter((t) => t.type === 'milestone-release')
    .reduce((s, t) => s + gross(t), 0);
  const totalDeposits = allTx.filter((t) => t.type === 'deposit').reduce((s, t) => s + gross(t), 0);
  const totalWithdrawn = allTx.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + gross(t), 0);
  // platform-fee rows restate fees already counted inside other rows.
  const totalVolume = allTx.filter((t) => t.type !== 'platform-fee').reduce((s, t) => s + gross(t), 0);

  const q = search.toLowerCase();
  const filtered = allTx.filter((tx) => {
    const from = Store.getUserById(tx.fromId);
    const to = Store.getUserById(tx.toId);
    const task = Store.getTaskById(tx.taskId);
    const matchSearch = !q ||
      (from?.name || tx.fromId).toLowerCase().includes(q) ||
      (to?.name || tx.toId).toLowerCase().includes(q) ||
      (task?.title || '').toLowerCase().includes(q) ||
      tx.description.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || tx.type === typeFilter;
    return matchSearch && matchType;
  });

  let rows = null;
  if (ready) {
    rows = !filtered.length ? (
      <tr>
        <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Icon name="wallet" style={{ width: 36, height: 36, opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>No transactions found</div>
            <div style={{ fontSize: 13 }}>Adjust filters or check back later.</div>
          </div>
        </td>
      </tr>
    ) : filtered.map((tx) => {
      const from = Store.getUserById(tx.fromId);
      const to = Store.getUserById(tx.toId);
      const task = Store.getTaskById(tx.taskId);
      const tc = typeConfig[tx.type] || { bg: '#f1f5f9', color: '#64748b', icon: 'circle', label: tx.type };
      const isCredit = tx.type === 'deposit' || tx.type === 'milestone-release';
      return (
        <tr key={tx.id}>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="tx-type-icon" style={{ background: tc.bg }}>
                <Icon name={tc.icon} style={{ width: 16, height: 16, color: tc.color }} />
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{tx.description}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{tx.createdAt}</div>
              </div>
            </div>
          </td>
          <td style={{ fontSize: 13 }}>{from?.name || tx.fromId}</td>
          <td style={{ fontSize: 13 }}>{to?.name || tx.toId}</td>
          <td style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{task?.title || '—'}</td>
          <td className={isCredit ? 'amount-credit' : 'amount-debit'}>
            {`${isCredit ? '+' : '-'}$${tx.amount.toLocaleString()}`}
          </td>
          <td><span className="badge badge-green">{tx.status}</span></td>
        </tr>
      );
    });
  }

  return (
    <DashboardLayout role="superuser" activePath="superuser-escrow.html" pageTitle="Escrow & Finance" pageSubtitle="Monitor all platform transactions and escrow activity">
      <div className="finance-grid">
        <div className="finance-card">
          <div className="finance-card-label">Escrow Balance</div>
          <div className="finance-card-val" style={{ color: '#6366f1' }}>{`$${escrowBalance.toLocaleString()}`}</div>
          <div className="finance-card-sub">Currently locked in escrow</div>
        </div>
        <div className="finance-card">
          <div className="finance-card-label">Total Released</div>
          <div className="finance-card-val" style={{ color: '#10b981' }}>{`$${totalReleased.toLocaleString()}`}</div>
          <div className="finance-card-sub">Paid to workers</div>
        </div>
        <div className="finance-card">
          <div className="finance-card-label">Total Deposits</div>
          <div className="finance-card-val" style={{ color: '#a855f7' }}>{`$${totalDeposits.toLocaleString()}`}</div>
          <div className="finance-card-sub">Client top-ups</div>
        </div>
        <div className="finance-card">
          <div className="finance-card-label">Total Withdrawn</div>
          <div className="finance-card-val" style={{ color: '#ef4444' }}>{`$${totalWithdrawn.toLocaleString()}`}</div>
          <div className="finance-card-sub">Paid out to users</div>
        </div>
        <div className="finance-card">
          <div className="finance-card-label">Platform Revenue</div>
          <div className="finance-card-val" style={{ color: '#0d9488' }}>{`$${platformRevenue.toLocaleString()}`}</div>
          <div className="finance-card-sub">Fees earned all-time</div>
        </div>
        <div className="finance-card">
          <div className="finance-card-label">Total Volume</div>
          <div className="finance-card-val">{`$${totalVolume.toLocaleString()}`}</div>
          <div className="finance-card-sub">All-time transaction value</div>
        </div>
      </div>

      <div className="su-toolbar">
        <input className="su-search" id="txSearch" placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="su-filter" id="txTypeFilter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="escrow-lock">Escrow Lock</option>
          <option value="milestone-release">Milestone Release</option>
          <option value="deposit">Deposit</option>
        </select>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>Showing <strong id="txCount">{ready ? filtered.length + ' transaction' + (filtered.length !== 1 ? 's' : '') : ''}</strong></div>

      <div className="tx-table-wrap">
        <table>
          <thead>
            <tr><th>Transaction</th><th>From</th><th>To</th><th>Task</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody id="txTableBody">{rows}</tbody>
        </table>
      </div>

      {/* The original's second <style> block (.btn-add) is in superuser-escrow.css. */}
    </DashboardLayout>
  );
}
