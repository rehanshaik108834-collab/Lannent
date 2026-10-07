import { useState } from 'react';
import { useActor } from '../../shared/api/actor';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { Project, TerminationResult } from '../../shared/types/domain';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import { Card, Field, Notice } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useRequestTermination } from './hooks';

/**
 * Ending a contract early. Either party asks; new work stops at once. The
 * server waits for submitted work and open disputes, then cancels unfinished
 * milestones and returns unused escrow to the client. Paid work stays paid.
 */
export function TerminationPanel({ project }: { project: Project }) {
  const actor = useActor();
  const terminate = useRequestTermination();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const isParty =
    actor.id === project.clientId || actor.id === project.workerId;
  const result: TerminationResult | undefined = terminate.data;

  if (project.termination) {
    const t = project.termination;
    return (
      <Card>
        <h2>Contract ended</h2>
        <p>
          Ended {formatDate(t.finalizedAt)}. {formatMoney(t.projectRefunded)} of
          project escrow
          {t.auditRefunded > 0
            ? ` and ${formatMoney(t.auditRefunded)} of unpaid audit fees`
            : ''}{' '}
          returned to the client.
          {t.cancelledMilestoneIds.length > 0 &&
            ` ${t.cancelledMilestoneIds.length} unfinished milestone(s) cancelled.`}
        </p>
      </Card>
    );
  }
  if (
    !isParty ||
    !project.workerId ||
    ['completed', 'cancelled'].includes(project.status)
  )
    return null;

  if (project.terminationRequest || result?.state === 'pending') {
    const blockers = result?.state === 'pending' ? result : null;
    return (
      <Card>
        <h2>Ending the contract</h2>
        <p role="status">
          {project.terminationRequest
            ? `Requested ${formatDate(project.terminationRequest.requestedAt)}: “${project.terminationRequest.reason}”. `
            : ''}
          No new work can start. The contract ends once submitted work is
          approved or disputed and any open dispute has a verdict; unused escrow
          then returns to the client.
        </p>
        {blockers && (
          <p>
            Waiting on {blockers.blockingMilestoneIds.length} submitted
            milestone(s) and {blockers.activeDisputeIds.length} open dispute(s).
          </p>
        )}
      </Card>
    );
  }

  function prepare() {
    if (reason.trim().length < 10)
      return setError('Give a reason of at least 10 characters.');
    setError(null);
    setOpen(true);
  }

  return (
    <Card>
      <h2>End contract</h2>
      <Field id="termination-reason" label="Reason" error={error ?? undefined}>
        <input
          id="termination-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {open ? (
        <ConfirmAction
          label="End contract"
          confirmLabel="Confirm ending the contract"
          explanation="New work stops now. Paid work stays paid; unused escrow returns to the client once pending work is settled."
          danger
          pending={terminate.isPending}
          open
          onOpenChange={setOpen}
          onConfirm={() =>
            terminate.mutate(
              { id: project.id, reason: reason.trim() },
              { onSuccess: () => setOpen(false) },
            )
          }
        />
      ) : (
        <button className={page.danger} onClick={prepare}>
          End contract
        </button>
      )}
      <Notice
        error={terminate.error}
        success={
          result?.state === 'finalized'
            ? `Contract ended. ${formatMoney(result.termination.projectRefunded)} returned to the client.`
            : null
        }
      />
    </Card>
  );
}
