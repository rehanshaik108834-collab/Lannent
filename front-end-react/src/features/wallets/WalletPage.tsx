import { useState } from 'react';
import type { FormEvent } from 'react';
import { useActor } from '../../shared/api/actor';
import {
  formatDate,
  formatMoney,
  statusLabel,
} from '../../shared/format/format';
import type { Transaction, WalletMovement } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useAccount, useTransactions, useWalletMovement } from './hooks';

/**
 * The signed-in account's wallet. Deposits and withdrawals are demonstration
 * ledger operations (no real payment provider); the server applies the fees
 * and returns the breakdown shown here.
 */
export function WalletPage() {
  const account = useAccount();
  const transactions = useTransactions();
  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="Balances are in INR. Deposits and withdrawals are demo operations."
      />
      <QueryView query={account}>
        {(a) => (
          <StatGrid>
            <StatCard
              label="Available balance"
              value={formatMoney(a.walletBalance)}
            />
          </StatGrid>
        )}
      </QueryView>
      <div className={page.row}>
        <MovementForm kind="deposit" />
        <MovementForm kind="withdraw" />
      </div>
      <Card>
        <h2>History</h2>
        <QueryView query={transactions}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState title="No transactions yet" />
            ) : (
              <History list={list} />
            )
          }
        </QueryView>
      </Card>
    </>
  );
}

function MovementForm({ kind }: { kind: 'deposit' | 'withdraw' }) {
  const move = useWalletMovement(kind);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalletMovement | null>(null);
  const id = `${kind}-amount`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) {
      return setError('Enter an amount in rupees, e.g. 5000 or 5000.50.');
    }
    setError(null);
    setResult(null);
    move.mutate(Number(amount), {
      onSuccess: (r) => {
        setResult(r);
        setAmount('');
      },
    });
  }

  return (
    <Card>
      <h2>{kind === 'deposit' ? 'Add funds' : 'Withdraw'}</h2>
      <form onSubmit={submit} noValidate>
        <Field
          id={id}
          label="Amount (₹)"
          error={error ?? undefined}
          hint={
            kind === 'deposit'
              ? 'A card processing fee is deducted.'
              : 'A payout fee is deducted.'
          }
        >
          <input
            id={id}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <button type="submit" disabled={move.isPending}>
          {move.isPending
            ? 'Processing…'
            : kind === 'deposit'
              ? 'Add funds'
              : 'Withdraw'}
        </button>
      </form>
      <Notice
        error={move.error}
        success={
          result &&
          `${kind === 'deposit' ? 'Added' : 'Paid out'} ${formatMoney(result.net)} (${formatMoney(result.gross)} less ${formatMoney(result.fee)} fee). Balance ${formatMoney(result.balance)}.`
        }
      />
    </Card>
  );
}

function History({ list }: { list: Transaction[] }) {
  const actor = useActor();
  const rows = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className={page.tableWrap}>
      <table className={page.table}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Type</th>
            <th scope="col" className={page.amount}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const incoming = t.toId === actor.id;
            return (
              <tr key={t.id}>
                <td>{formatDate(t.createdAt)}</td>
                <td>{t.description}</td>
                <td>{statusLabel(t.type)}</td>
                <td className={page.amount}>
                  {incoming ? '+' : '−'}
                  {formatMoney(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
