import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import type { AuditEngagement, Project } from '../../shared/types/domain';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import {
  Card,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useDirectory } from '../wallets/hooks';
import { Negotiation } from './Negotiation';
import { useEngagements, useFundEngagement, useRequestAudit } from './hooks';
import { useCancelDraft, useProjects } from '../projects/hooks';
import { toPaise } from '../projects/PostTaskPage';

const WHAT_NEXT: Record<string, string> = {
  'preview-sent': 'Waiting for the reviewer to respond to your opening offer.',
  negotiating: 'Agree a fee: accept the reviewer’s offer or counter it.',
  agreed: 'Fund the agreed fee into audit escrow so the reviewer can start.',
  'escrow-funded': 'Funded. Waiting for the reviewer to accept the engagement.',
  'in-progress':
    'The reviewer files a report for each milestone as it is submitted.',
  'report-submitted': 'Reports filed.',
  paid: 'Every milestone has a report; the reviewer has been paid.',
  declined:
    'The reviewer declined. Cancel the draft project to recover any audit escrow.',
  cancelled: 'Closed.',
};

/** The client's expert engagements: technical audits and dispute arbitrations. */
export function ClientAuditOffersPage() {
  const actor = useActor();
  const engagements = useEngagements();
  const experts = useDirectory('expert');
  const projects = useProjects({ clientId: actor.id });
  const names = new Map((experts.data ?? []).map((e) => [e.id, e.name]));
  return (
    <>
      <PageHeader
        title="Audit offers"
        subtitle="Agree and fund expert reviews of your projects and disputes."
      />
      <QueryView query={engagements}>
        {(list) => {
          const mine = list.filter((e) => e.clientId === actor.id);
          const drafts = new Map(
            (projects.data ?? [])
              .filter((p) => p.status === 'draft')
              .map((p) => [p.id, p]),
          );
          return mine.length === 0 ? (
            <EmptyState title="No expert engagements">
              <p>
                Enable a technical audit when you{' '}
                <Link to="/client/post-task">post a task</Link>.
              </p>
            </EmptyState>
          ) : (
            mine.map((e) => {
              const project = drafts.get(e.taskId);
              // Recovery is offered on the latest declined audit of a draft
              // that has no other audit under way.
              const recoverable =
                e.kind === 'project-audit' &&
                e.status === 'declined' &&
                !!project &&
                !mine.some(
                  (o) =>
                    o.taskId === e.taskId &&
                    o.kind === 'project-audit' &&
                    !['declined', 'cancelled', 'paid'].includes(o.status),
                );
              return (
                <EngagementCard
                  key={e.id}
                  engagement={e}
                  reviewer={e.expertId ? names.get(e.expertId) : undefined}
                  recovery={recoverable ? project : undefined}
                />
              );
            })
          );
        }}
      </QueryView>
    </>
  );
}

function EngagementCard({
  engagement,
  reviewer,
  recovery,
}: {
  engagement: AuditEngagement;
  reviewer?: string;
  /** The draft project to recover when this audit was declined. */
  recovery?: Project;
}) {
  const fund = useFundEngagement();
  const [open, setOpen] = useState(false);
  const progress = engagement.auditProgress;
  return (
    <Card>
      <div className={page.itemHead}>
        <h2>
          {engagement.kind === 'dispute-audit'
            ? 'Dispute review'
            : 'Technical audit'}
          : {engagement.project ?? 'Project'}
        </h2>
        <StatusBadge status={engagement.status} />
      </div>
      <div className={page.meta}>
        <span>
          Reviewer {reviewer ?? (engagement.expertId ? '…' : 'not assigned')}
        </span>
        {progress && (
          <span>
            Coverage {progress.audited} of {progress.total} milestones
          </span>
        )}
      </div>
      <p>
        {engagement.kind === 'dispute-audit' &&
        engagement.status === 'preview-sent'
          ? 'Waiting for the reviewer to propose a fee for arbitrating, or make an offer yourself.'
          : engagement.kind === 'dispute-audit' &&
              engagement.status === 'cancelled'
            ? 'Closed: the dispute was decided before an arbitration fee was funded.'
            : (WHAT_NEXT[engagement.status] ?? '')}
      </p>
      <Negotiation engagement={engagement} side="client" />
      {engagement.status === 'agreed' && engagement.agreedAmount !== null && (
        <div className={page.inline}>
          <ConfirmAction
            label="Fund audit escrow"
            confirmLabel="Confirm funding"
            explanation={`${formatMoney(engagement.agreedAmount)} moves from your wallet into audit escrow. The reviewer is paid when every milestone has a report.`}
            pending={fund.isPending}
            open={open}
            onOpenChange={setOpen}
            onConfirm={() =>
              fund.mutate(engagement.id, { onSuccess: () => setOpen(false) })
            }
          />
        </div>
      )}
      <Notice
        error={fund.error}
        success={fund.isSuccess ? 'Audit escrow funded.' : null}
      />
      {recovery && <DeclinedRecovery project={recovery} />}
      <Link to={`/project/${engagement.taskId}/milestone-reports`}>
        Reports for this project
      </Link>
    </Card>
  );
}

/**
 * After a reviewer declines, the draft project can go to another reviewer
 * (who covers its category) or be cancelled. Any fee already funded was
 * returned when the reviewer declined.
 */
function DeclinedRecovery({ project }: { project: Project }) {
  const experts = useDirectory('expert');
  const request = useRequestAudit();
  const cancel = useCancelDraft();
  const [expertId, setExpertId] = useState('');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const reviewers = (experts.data ?? []).filter(
    (e) =>
      e.status !== 'suspended' &&
      (!e.domains?.length || e.domains.includes(project.category)),
  );

  function choose() {
    if (!expertId) return setError('Choose a reviewer.');
    if (toPaise(fee) === null)
      return setError('Enter your opening offer in rupees.');
    setError(null);
    request.mutate({
      taskId: project.id,
      expertId,
      openingOffer: (toPaise(fee) ?? 0) / 100,
    });
  }

  if (request.isSuccess)
    return <Notice success="Request sent to the new reviewer." />;
  if (cancel.isSuccess) return <Notice success="Draft cancelled." />;
  return (
    <div>
      <h3>Choose another reviewer</h3>
      <p className={page.muted}>
        Any fee you funded was returned when the reviewer declined.
      </p>
      <div className={page.row}>
        <Field id={`reviewer-${project.id}`} label="Reviewer">
          <select
            id={`reviewer-${project.id}`}
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
          >
            <option value="">Choose a reviewer</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.specialization ? ` — ${r.specialization}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`fee-${project.id}`} label="Opening offer (₹)">
          <input
            id={`fee-${project.id}`}
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </Field>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={page.inline}>
        <button
          className={page.primary}
          disabled={request.isPending}
          onClick={choose}
        >
          Send request
        </button>
        <ConfirmAction
          label="Cancel draft"
          confirmLabel="Confirm cancel"
          explanation="The project is withdrawn; any audit escrow still held returns to your wallet."
          danger
          pending={cancel.isPending}
          open={open}
          onOpenChange={setOpen}
          onConfirm={() => cancel.mutate(project.id)}
        />
      </div>
      <Notice error={request.error ?? cancel.error} />
    </div>
  );
}
