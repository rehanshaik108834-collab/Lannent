import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, formatMoney } from '../../shared/format/format';
import type {
  AuditEngagement,
  AuditPreview,
  AuditReport,
} from '../../shared/types/domain';
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
import { Negotiation } from './Negotiation';
import {
  useAcceptEngagement,
  useDeclineEngagement,
  useEngagements,
  useFileReport,
  usePreview,
  useReports,
} from './hooks';

const NEXT: Record<string, string> = {
  'preview-sent': 'Review the work and respond to the client’s offer.',
  negotiating: 'Negotiating the fee.',
  agreed: 'Fee agreed; waiting for the client to fund it.',
  'escrow-funded': 'Funded — accept to start.',
  'in-progress': 'File a report for each submitted milestone.',
  paid: 'Paid.',
};

/** Engagements assigned to the signed-in reviewer. */
export function AuditRequestsPage() {
  const engagements = useEngagements();
  return (
    <>
      <PageHeader
        title="Audit requests"
        subtitle="Technical audits and dispute reviews assigned to you."
      />
      <QueryView query={engagements}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="Nothing assigned to you yet" />
          ) : (
            <ul className={page.list}>
              {list.map((e) => (
                <li key={e.id} className={page.item}>
                  <div className={page.itemHead}>
                    <h2>
                      {e.kind === 'dispute-audit'
                        ? 'Dispute review'
                        : 'Technical audit'}
                      : {e.project ?? 'Project'}
                    </h2>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className={page.meta}>
                    {e.agreedAmount !== null && (
                      <span>Fee {formatMoney(e.agreedAmount)}</span>
                    )}
                    {e.auditProgress && (
                      <span>
                        {e.auditProgress.audited} of {e.auditProgress.total}{' '}
                        milestones reported
                      </span>
                    )}
                  </div>
                  <p>{NEXT[e.status] ?? ''}</p>
                  <div className={page.inline}>
                    <Link to={`/expert/audit-preview/${e.id}`}>Open</Link>
                    {e.status === 'in-progress' && (
                      <Link to={`/expert/report-audit/${e.id}`}>
                        File a report
                      </Link>
                    )}
                    {e.disputeId && (
                      <Link to={`/dispute/${e.disputeId}`}>Dispute</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}

/** Everything the reviewer needs to judge the job, plus negotiation and accept/decline. */
export function AuditPreviewPage() {
  const { id } = useParams();
  const preview = usePreview(id);
  return (
    <QueryView query={preview} level={1}>
      {(p) => (
        <>
          <PageHeader
            title={p.project?.title ?? 'Engagement'}
            subtitle={`${p.kind === 'dispute-audit' ? 'Dispute review' : 'Technical audit'} · client ${p.client?.name ?? '—'}${p.worker ? ` · worker ${p.worker.name}` : ''}`}
          />
          <div className={page.split}>
            <div>
              {p.dispute && (
                <Card>
                  <h2>The dispute</h2>
                  <p>{p.dispute.reason}</p>
                  <div className={page.meta}>
                    <span>Raised by {p.dispute.raisedByName}</span>
                    <span>Against {p.dispute.againstName}</span>
                    {p.dispute.amount && <span>{p.dispute.amount}</span>}
                  </div>
                </Card>
              )}
              <Card>
                <h2>Project</h2>
                <p>{p.project?.description}</p>
                <div className={page.meta}>
                  {p.project && <span>{p.project.category}</span>}
                  {p.project && (
                    <span>Budget {formatMoney(p.project.budget)}</span>
                  )}
                </div>
              </Card>
              <Card>
                <h2>Milestones</h2>
                <ul className={page.list}>
                  {p.milestones.map((m) => (
                    <li key={m.id} className={page.itemHead}>
                      <span>
                        {m.title} · {formatMoney(m.budget)}
                      </span>
                      <StatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <aside>
              <Card>
                <div className={page.itemHead}>
                  <h2>Fee</h2>
                  <StatusBadge status={p.auditRequest.status} />
                </div>
                <Negotiation engagement={p.auditRequest} side="expert" />
              </Card>
              <EngagementDecision engagement={p.auditRequest} preview={p} />
            </aside>
          </div>
        </>
      )}
    </QueryView>
  );
}

function EngagementDecision({
  engagement,
  preview,
}: {
  engagement: AuditEngagement;
  preview: AuditPreview;
}) {
  const accept = useAcceptEngagement();
  const decline = useDeclineEngagement();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const terminal = ['paid', 'declined', 'cancelled'].includes(
    engagement.status,
  );
  if (terminal) return null;
  return (
    <Card>
      <h2>Your decision</h2>
      {engagement.status === 'escrow-funded' && (
        <ConfirmAction
          label="Accept engagement"
          confirmLabel="Confirm accept"
          explanation={`You commit to review ${preview.kind === 'dispute-audit' ? 'this dispute' : 'every milestone'} for ${formatMoney(engagement.agreedAmount)}.`}
          pending={accept.isPending}
          open={open === 'accept'}
          onOpenChange={(o) => setOpen(o ? 'accept' : null)}
          onConfirm={() =>
            accept.mutate(engagement.id, { onSuccess: () => setOpen(null) })
          }
        />
      )}
      {engagement.status === 'in-progress' && (
        <Link to={`/expert/report-audit/${engagement.id}`}>File a report</Link>
      )}
      <Field id="decline-reason" label="Decline with a reason">
        <input
          id="decline-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <ConfirmAction
        label="Decline"
        confirmLabel="Confirm decline"
        explanation="The client can choose another reviewer."
        danger
        pending={decline.isPending}
        open={open === 'decline'}
        onOpenChange={(o) => setOpen(o ? 'decline' : null)}
        onConfirm={() =>
          decline.mutate(
            { id: engagement.id, reason: reason.trim() },
            { onSuccess: () => setOpen(null) },
          )
        }
      />
      <Notice
        error={accept.error ?? decline.error}
        success={accept.isSuccess ? 'Engagement accepted.' : null}
      />
    </Card>
  );
}

const SCORES = [
  'codequality',
  'security',
  'performance',
  'documentation',
] as const;
const SCORE_LABELS: Record<(typeof SCORES)[number], string> = {
  codequality: 'Code quality',
  security: 'Security',
  performance: 'Performance',
  documentation: 'Documentation',
};

/**
 * The reviewer's report for one exact milestone. Project audits list the
 * submitted milestones not yet covered; dispute reviews cover the disputed one.
 */
export function ReportAuditPage() {
  const { id } = useParams();
  const preview = usePreview(id);
  return (
    <QueryView query={preview} level={1}>
      {(p) => <ReportForm preview={p} />}
    </QueryView>
  );
}

function ReportForm({ preview }: { preview: AuditPreview }) {
  const engagement = preview.auditRequest;
  const existingReports = useReports({ auditRequestId: engagement.id });
  const covered = new Set(engagement.auditedMilestoneIds ?? []);
  const options =
    preview.kind === 'dispute-audit'
      ? preview.milestones.filter((m) => m.id === engagement.milestoneId)
      : preview.milestones.filter(
          (m) =>
            ['submitted', 'review'].includes(m.status) || covered.has(m.id),
        );
  const [milestoneId, setMilestoneId] = useState(
    options.find((m) => !covered.has(m.id))?.id ?? options[0]?.id ?? '',
  );

  if (engagement.status !== 'in-progress' && engagement.status !== 'paid') {
    return (
      <>
        <PageHeader title="File a report" />
        <EmptyState title="Reports open once you accept a funded engagement">
          <Link to={`/expert/audit-preview/${engagement.id}`}>
            Back to the engagement
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="File a report" subtitle={preview.project?.title} />
      {options.length === 0 ? (
        <EmptyState title="No submitted milestone is waiting for a report" />
      ) : (
        <>
          <Field id="milestone" label="Milestone">
            <select
              id="milestone"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
            >
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {covered.has(m.id)
                    ? ' (report filed — re-file to update)'
                    : ''}
                </option>
              ))}
            </select>
          </Field>
          <QueryView query={existingReports}>
            {(reports) => (
              <ReportFields
                // A new milestone starts from its own report (if any).
                key={milestoneId}
                preview={preview}
                milestoneId={milestoneId}
                existing={reports.find((r) => r.milestoneId === milestoneId)}
              />
            )}
          </QueryView>
        </>
      )}
    </>
  );
}

/**
 * The editable report for one milestone. Re-filing starts from the report
 * already on file, so updating one field does not wipe the others.
 */
function ReportFields({
  preview,
  milestoneId,
  existing,
}: {
  preview: AuditPreview;
  milestoneId: string;
  existing?: AuditReport;
}) {
  const engagement = preview.auditRequest;
  const file = useFileReport();
  const [verdict, setVerdict] = useState<'pass' | 'conditional' | 'fail'>(
    existing?.verdict === 'conditional' || existing?.verdict === 'fail'
      ? existing.verdict
      : 'pass',
  );
  const [overall, setOverall] = useState(existing?.overall ?? '');
  const [findings, setFindings] = useState(existing?.findings ?? '');
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SCORES.filter((k) => typeof existing?.[k] === 'number').map((k) => [
        k,
        String(existing?.[k]),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (overall.trim().length < 20)
      return setError('Summarise your assessment in at least 20 characters.');
    const numbers: Record<string, number> = {};
    for (const key of SCORES) {
      if (scores[key] === undefined || scores[key] === '') continue;
      const n = Number(scores[key]);
      if (!Number.isInteger(n) || n < 0 || n > 5)
        return setError('Scores are whole numbers from 0 to 5.');
      numbers[key] = n;
    }
    setError(null);
    const milestone = preview.milestones.find((m) => m.id === milestoneId);
    file.mutate({
      auditRequestId: engagement.id,
      taskId: engagement.taskId,
      milestoneId,
      verdict,
      overall: overall.trim(),
      findings: findings.trim() || undefined,
      milestoneTitle: milestone?.title,
      projectTitle: preview.project?.title,
      ...numbers,
    });
  }

  if (file.data) {
    const payout = file.data.payout;
    return (
      <Card>
        <p role="status">
          {'pending' in payout && payout.pending
            ? `Saved. ${payout.audited} of ${payout.total} milestones now have a report; the fee is paid when all do.`
            : 'alreadyPaid' in payout && payout.alreadyPaid
              ? 'Report updated. The fee was already paid; nothing more was released.'
              : 'net' in payout
                ? `Every milestone is covered. ${formatMoney(payout.net)} paid to you (${formatMoney(payout.amount)} less ${formatMoney(payout.fee)} commission).`
                : 'Saved.'}
        </p>
        <div className={page.inline}>
          <Link to={`/reports/audits/${file.data.id}`}>View report</Link>
          <Link to="/expert/audit-requests">Audit requests</Link>
        </div>
      </Card>
    );
  }

  return (
    <form className={page.form} onSubmit={submit} noValidate>
      <Card>
        {existing && (
          <p className={page.muted}>
            Updating the report you filed on {formatDate(existing.createdAt)}.
          </p>
        )}
        <Field id="verdict" label="Verdict">
          <select
            id="verdict"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as typeof verdict)}
          >
            <option value="pass">Pass</option>
            <option value="conditional">Pass with conditions</option>
            <option value="fail">Fail</option>
          </select>
        </Field>
        <div className={page.row}>
          {SCORES.map((key) => (
            <Field key={key} id={key} label={`${SCORE_LABELS[key]} (0–5)`}>
              <input
                id={key}
                type="number"
                min={0}
                max={5}
                value={scores[key] ?? ''}
                onChange={(e) =>
                  setScores({ ...scores, [key]: e.target.value })
                }
              />
            </Field>
          ))}
        </div>
        <Field id="overall" label="Overall assessment">
          <textarea
            id="overall"
            className={page.textarea}
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
          />
        </Field>
        <Field id="findings" label="Findings (optional)">
          <textarea
            id="findings"
            className={page.textarea}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
          />
        </Field>
        <p className={page.muted}>
          Your report informs the client’s decision; it does not approve or
          reject the work by itself.
        </p>
      </Card>
      {error && <p role="alert">{error}</p>}
      <Notice error={file.error} />
      <button className={page.primary} type="submit" disabled={file.isPending}>
        {file.isPending
          ? 'Filing…'
          : existing
            ? 'Update report'
            : 'File report'}
      </button>
    </form>
  );
}
