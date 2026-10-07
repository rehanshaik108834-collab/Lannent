import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { AuditEngagement } from '../../shared/types/domain';
import { Field, Notice, StatusBadge } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useAcceptOffer, useMakeOffer } from './hooks';

const NEGOTIABLE = ['preview-sent', 'negotiating'];

/**
 * Fee negotiation for an engagement, shared by client and reviewer. Either
 * side offers or counters; only the other side can accept an offer. The
 * server derives which side the signed-in account is on.
 */
export function Negotiation({
  engagement,
  side,
}: {
  engagement: AuditEngagement;
  side: 'client' | 'expert';
}) {
  const offer = useMakeOffer();
  const accept = useAcceptOffer();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const open = NEGOTIABLE.includes(engagement.status);
  const pending = engagement.offers.find((o) => o.status === 'pending');
  const fromOtherSide = pending && pending.offeredBy !== side;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) < 1) {
      return setError('Enter a fee in rupees of at least ₹1.');
    }
    setError(null);
    offer.mutate(
      { id: engagement.id, amount: Number(amount), note: note.trim() },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
        },
      },
    );
  }

  return (
    <div>
      {engagement.offers.length === 0 ? (
        <p>No offers yet.</p>
      ) : (
        <ol className={page.list} aria-label="Offers">
          {engagement.offers.map((o) => (
            <li key={o.id} className={page.itemHead}>
              <span>
                {o.offeredBy === side
                  ? 'You'
                  : o.offeredBy === 'client'
                    ? 'Client'
                    : 'Reviewer'}{' '}
                offered <strong>{formatMoney(o.amount)}</strong>
                {o.note && <span className={page.muted}> — {o.note}</span>}
              </span>
              <span className={page.inline}>
                <span className={page.muted}>{formatDate(o.createdAt)}</span>
                <StatusBadge status={o.status} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {engagement.agreedAmount !== null && (
        <p>
          Agreed fee: <strong>{formatMoney(engagement.agreedAmount)}</strong>
        </p>
      )}
      {open && fromOtherSide && pending && (
        <div className={page.inline}>
          <button
            className={page.primary}
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate({ id: engagement.id, offerId: pending.id })
            }
          >
            Accept {formatMoney(pending.amount)}
          </button>
        </div>
      )}
      <Notice error={accept.error} />
      {open && (
        <form onSubmit={submit} noValidate>
          <div className={page.row}>
            <Field
              id={`offer-${engagement.id}`}
              label={pending ? 'Counter-offer (₹)' : 'Offer (₹)'}
              error={error ?? undefined}
            >
              <input
                id={`offer-${engagement.id}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field id={`note-${engagement.id}`} label="Note (optional)">
              <input
                id={`note-${engagement.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
          <Notice error={offer.error} />
          <button type="submit" disabled={offer.isPending}>
            {pending ? 'Send counter-offer' : 'Send offer'}
          </button>
        </form>
      )}
    </div>
  );
}
