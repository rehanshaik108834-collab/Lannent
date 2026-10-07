import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { Dispute, DisputeVerdict } from '../../shared/types/domain';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useMilestone } from '../milestones/hooks';
import { useProject } from '../projects/hooks';
import { useDirectory } from '../wallets/hooks';
import {
  useDispute,
  useDisputes,
  useRaiseDispute,
  useResolveDispute,
} from './hooks';

const VERDICTS: { value: DisputeVerdict; label: string; effect: string }[] = [
  {
    value: 'client-favour',
    label: 'In the client’s favour',
    effect:
      'The money stays in escrow and the worker revises the work. Nothing is refunded now.',
  },
  {
    value: 'worker-favour',
    label: 'In the worker’s favour',
    effect:
      'The milestone is paid to the worker once, less their service fee. Remaining work continues.',
  },
  {
    value: 'split',
    label: 'Split',
    effect:
      'The worker is paid half the milestone (rounded down to the paisa, less fees); the client gets the rest back.',
  },
];

/** A project party disputes one exact milestone and picks an eligible reviewer. */
export function RaiseDisputePage() {
  const { projectId, milestoneId } = useParams();
  const project = useProject(projectId);
  const milestone = useMilestone(milestoneId);
  const experts = useDirectory('expert');
  const raise = useRaiseDispute();
  const disputes = useDisputes();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [expertId, setExpertId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (milestone.data && milestone.data.taskId !== projectId) {
    return (
      <ErrorState
        level={1}
        error={new Error('That milestone does not belong to this project.')}
      />
    );
  }

  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <QueryView query={milestone}>
          {(m) => {
            const open = (disputes.data ?? []).find(
              (d) => d.milestoneId === m.id && d.status !== 'resolved',
            );
            if (open) {
              return (
                <>
                  <PageHeader
                    title="Already under dispute"
                    subtitle={`${p.title} · ${m.title}`}
                  />
                  <Card>
                    <p>
                      This milestone already has an open dispute. Its payment
                      stays frozen until the reviewer gives a verdict.
                    </p>
                    <Link to={`/dispute/${open.id}`}>View the dispute</Link>
                  </Card>
                </>
              );
            }
            const eligible = (experts.data ?? []).filter(
              (e) =>
                e.status !== 'suspended' &&
                (!e.domains?.length || e.domains.includes(p.category)),
            );
            function submit(event: FormEvent) {
              event.preventDefault();
              if (reason.trim().length < 20)
                return setError(
                  'Explain the problem in at least 20 characters.',
                );
              if (!expertId) return setError('Choose a reviewer to arbitrate.');
              setError(null);
              raise.mutate(
                {
                  taskId: p.id,
                  milestoneId: m.id,
                  reason: reason.trim(),
                  expertId,
                },
                {
                  onSuccess: (d) =>
                    navigate(`/dispute/${d.id}`, { replace: true }),
                },
              );
            }
            return (
              <>
                <PageHeader
                  title="Open a dispute"
                  subtitle={`${p.title} · ${m.title} · ${formatMoney(m.budget)}`}
                />
                <form className={page.form} onSubmit={submit} noValidate>
                  <Card>
                    <p>
                      The milestone’s payment is frozen until the reviewer’s
                      verdict. The reviewer agrees a fee for arbitrating, which
                      you fund from Audit offers.
                    </p>
                    <Field id="reason" label="What went wrong">
                      <textarea
                        id="reason"
                        className={page.textarea}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <Field
                      id="expert"
                      label="Reviewer"
                      hint={`Reviewers who cover ${p.category}.`}
                    >
                      <select
                        id="expert"
                        value={expertId}
                        onChange={(e) => setExpertId(e.target.value)}
                      >
                        <option value="">Choose a reviewer</option>
                        {eligible.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                            {e.specialization ? ` — ${e.specialization}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </Card>
                  {error && <p role="alert">{error}</p>}
                  <Notice error={raise.error} />
                  <button
                    className={page.primary}
                    type="submit"
                    disabled={raise.isPending}
                  >
                    {raise.isPending ? 'Opening…' : 'Open dispute'}
                  </button>
                </form>
              </>
            );
          }}
        </QueryView>
      )}
    </QueryView>
  );
}

function settlementText(d: Dispute): string | null {
  const s = d.settlement;
  if (!s) return null;
  if (s.kind === 'funded-rework')
    return 'The milestone’s money stayed in escrow; the worker revises the work.';
  if (s.kind === 'paid' && s.release)
    return `${formatMoney(s.release.net)} was paid to the worker.`;
  if (s.kind === 'split') {
    return `${formatMoney(s.release?.net ?? 0)} was paid to the worker and ${formatMoney(s.refund?.amount ?? 0)} returned to the client.`;
  }
  return null;
}

/** The dispute as its parties and reviewer see it. */
export function DisputeDetailPage() {
  const { id } = useParams();
  const actor = useActor();
  const dispute = useDispute(id);
  return (
    <QueryView query={dispute} level={1}>
      {(d) => (
        <>
          <PageHeader
            title={`Dispute: ${d.milestone ?? 'milestone'}`}
            subtitle={`${d.project ?? 'Project'} · opened ${formatDate(d.createdAt)}`}
          />
          <Card>
            <div className={page.itemHead}>
              <h2>Claim</h2>
              <StatusBadge status={d.status} />
            </div>
            <p>{d.reason}</p>
            <div className={page.meta}>
              <span>Raised by {d.raisedByName}</span>
              <span>Against {d.againstName}</span>
              {d.amount && <span>{d.amount}</span>}
            </div>
          </Card>
          {d.status === 'resolved' ? (
            <Card>
              <h2>
                Verdict:{' '}
                {VERDICTS.find((v) => v.value === d.verdict)?.label ??
                  d.verdict}
              </h2>
              {d.resolution && <p>{d.resolution}</p>}
              {settlementText(d) && <p role="note">{settlementText(d)}</p>}
              <p className={page.muted}>Resolved {formatDate(d.resolvedAt)}</p>
            </Card>
          ) : (
            <Card>
              <p>
                {d.expertId
                  ? 'Waiting for the reviewer’s verdict. The milestone’s payment is frozen until then.'
                  : 'No reviewer is assigned yet; operations will assign one.'}
              </p>
              {d.expertId === actor.id && (
                <div className={page.inline}>
                  {d.auditRequestId && (
                    <Link to={`/expert/audit-preview/${d.auditRequestId}`}>
                      Engagement and fee
                    </Link>
                  )}
                  <Link className="button" to={`/dispute/${d.id}/resolve`}>
                    Give verdict
                  </Link>
                </div>
              )}
            </Card>
          )}
          <Link to={`/project/${d.taskId}/workroom`}>Project workroom</Link>
        </>
      )}
    </QueryView>
  );
}

/** Only the assigned reviewer gives the verdict; the server settles it atomically. */
export function ResolveDisputePage() {
  const { id } = useParams();
  const actor = useActor();
  const dispute = useDispute(id);
  const resolve = useResolveDispute();
  const [verdict, setVerdict] = useState<DisputeVerdict | ''>('');
  const [resolution, setResolution] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <QueryView query={dispute} level={1}>
      {(d) => {
        if (d.expertId !== actor.id) {
          return (
            <ErrorState
              level={1}
              error={
                new Error(
                  'Only the reviewer assigned to this dispute can give its verdict.',
                )
              }
            />
          );
        }
        if (resolve.data || d.status === 'resolved') {
          const done = resolve.data ?? d;
          return (
            <>
              <PageHeader title="Verdict recorded" />
              <Card>
                <p role="status">
                  {settlementText(done) ?? 'The dispute is resolved.'}
                </p>
                <Link to={`/dispute/${d.id}`}>View the dispute</Link>
              </Card>
            </>
          );
        }
        const chosen = VERDICTS.find((v) => v.value === verdict);
        function prepare() {
          if (!verdict) return setError('Choose a verdict.');
          if (resolution.trim().length < 20)
            return setError('Explain your verdict in at least 20 characters.');
          setError(null);
          setOpen(true);
        }
        return (
          <>
            <PageHeader
              title="Give your verdict"
              subtitle={`${d.project ?? 'Project'} · ${d.milestone ?? 'milestone'}`}
            />
            <div className={page.form}>
              <Card>
                <p>{d.reason}</p>
                <fieldset
                  className={page.list}
                  style={{ border: 0, padding: 0 }}
                >
                  <legend>Verdict</legend>
                  {VERDICTS.map((v) => (
                    <label key={v.value} className={page.item}>
                      <span className={page.inline}>
                        <input
                          type="radio"
                          name="verdict"
                          value={v.value}
                          checked={verdict === v.value}
                          onChange={() => {
                            setVerdict(v.value);
                            setOpen(false);
                          }}
                          style={{ width: 'auto' }}
                        />
                        <strong>{v.label}</strong>
                      </span>
                      <span className={page.muted}>{v.effect}</span>
                    </label>
                  ))}
                </fieldset>
                <Field id="resolution" label="Reasoning">
                  <textarea
                    id="resolution"
                    className={page.textarea}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </Field>
              </Card>
              {error && <p role="alert">{error}</p>}
              {open && chosen ? (
                <ConfirmAction
                  label="Record verdict"
                  confirmLabel="Confirm verdict"
                  explanation={`${chosen.effect} A verdict is final.`}
                  pending={resolve.isPending}
                  open
                  onOpenChange={setOpen}
                  onConfirm={() =>
                    resolve.mutate({
                      id: d.id,
                      verdict: chosen.value,
                      resolution: resolution.trim(),
                    })
                  }
                />
              ) : (
                <button className={page.primary} onClick={prepare}>
                  Record verdict
                </button>
              )}
              <Notice error={resolve.error} />
            </div>
          </>
        );
      }}
    </QueryView>
  );
}

/** Disputes assigned to the signed-in reviewer. */
export function ExpertDisputesPage() {
  const actor = useActor();
  const disputes = useDisputes();
  return (
    <>
      <PageHeader
        title="Dispute cases"
        subtitle="Disputes you have been asked to arbitrate."
      />
      <QueryView query={disputes}>
        {(list) => {
          const mine = list.filter((d) => d.expertId === actor.id);
          return mine.length === 0 ? (
            <EmptyState title="No dispute cases" />
          ) : (
            <ul className={page.list}>
              {mine.map((d) => (
                <li key={d.id} className={page.item}>
                  <div className={page.itemHead}>
                    <h2>{d.milestone ?? 'Milestone'}</h2>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className={page.meta}>
                    <span>{d.project}</span>
                    {d.amount && <span>{d.amount}</span>}
                    <span>Opened {formatDate(d.createdAt)}</span>
                  </div>
                  <div className={page.inline}>
                    <Link to={`/dispute/${d.id}`}>Open</Link>
                    {d.status !== 'resolved' && (
                      <Link to={`/dispute/${d.id}/resolve`}>Give verdict</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </>
  );
}
