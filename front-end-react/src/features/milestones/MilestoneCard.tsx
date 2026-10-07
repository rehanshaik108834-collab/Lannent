import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { Dispute, Milestone, Project } from '../../shared/types/domain';
import { Notice, StatusBadge } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useStartOrProgress } from './hooks';

const REVIEWABLE = ['submitted', 'review'];
const STARTABLE = ['pending', 'revision-needed'];

/**
 * A milestone with the actions the signed-in account may take on it. The
 * server enforces every rule; these controls only avoid offering actions that
 * would be refused.
 */
export function MilestoneCard({
  milestone,
  project,
  dispute,
}: {
  milestone: Milestone;
  project: Project;
  /**
   * An open dispute about this milestone. Its payment is frozen and no work or
   * decision can happen until the reviewer's verdict, whatever the
   * milestone's own status field says.
   */
  dispute?: Dispute;
}) {
  const actor = useActor();
  const isWorker = !!milestone.workerId && milestone.workerId === actor.id;
  const isClient = project.clientId === actor.id;
  const base = `/project/${project.id}/milestones/${milestone.id}`;

  return (
    <li className={page.item}>
      <div className={page.itemHead}>
        <h3>{milestone.title}</h3>
        <StatusBadge status={milestone.status} />
      </div>
      <div className={page.meta}>
        <span>{formatMoney(milestone.budget)}</span>
        <span>Due {formatDate(milestone.dueDate)}</span>
        {milestone.submittedAt && (
          <span>Submitted {formatDate(milestone.submittedAt)}</span>
        )}
        {milestone.approvedAt && (
          <span>Approved {formatDate(milestone.approvedAt)}</span>
        )}
      </div>
      {milestone.description && <p>{milestone.description}</p>}
      {milestone.status === 'in-progress' && (
        <div
          className={page.progress}
          aria-label={`${milestone.progress}% complete`}
        >
          <span style={{ width: `${milestone.progress}%` }} />
        </div>
      )}
      {milestone.status === 'revision-needed' && milestone.revisionRequest && (
        <p role="note">
          <strong>Changes requested:</strong> {milestone.revisionRequest.reason}
        </p>
      )}
      {(dispute || milestone.status === 'disputed') && (
        <p role="note">
          <strong>Under dispute.</strong> Payment and further work wait for the
          reviewer’s verdict.{' '}
          {dispute && (
            <Link to={`/dispute/${dispute.id}`}>View the dispute</Link>
          )}
        </p>
      )}
      {!dispute && milestone.status !== 'disputed' && (
        <div className={page.inline}>
          {isWorker && STARTABLE.includes(milestone.status) && (
            <StartWork milestone={milestone} />
          )}
          {isWorker && milestone.status === 'in-progress' && (
            <>
              <ProgressReport milestone={milestone} />
              <Link className="button" to={`${base}/submit`}>
                Submit deliverable
              </Link>
            </>
          )}
          {isWorker && milestone.status === 'revision-needed' && (
            <Link to={`${base}/submit`}>Resubmit</Link>
          )}
          {isClient && REVIEWABLE.includes(milestone.status) && (
            <Link className="button" to={`${base}/review`}>
              Review deliverable
            </Link>
          )}
          {!isClient && !isWorker && REVIEWABLE.includes(milestone.status) && (
            <Link to={`${base}/review`}>View deliverable</Link>
          )}
          {(isClient || isWorker) &&
            REVIEWABLE.includes(milestone.status) &&
            !project.termination && (
              <Link to={`${base}/disputes/new`}>Open dispute</Link>
            )}
        </div>
      )}
    </li>
  );
}

function StartWork({ milestone }: { milestone: Milestone }) {
  const start = useStartOrProgress();
  return (
    <>
      <button
        disabled={start.isPending}
        onClick={() =>
          start.mutate({ id: milestone.id, status: 'in-progress' })
        }
      >
        {milestone.status === 'revision-needed'
          ? 'Start revisions'
          : 'Start work'}
      </button>
      <Notice error={start.error} />
    </>
  );
}

function ProgressReport({ milestone }: { milestone: Milestone }) {
  const update = useStartOrProgress();
  const [value, setValue] = useState(String(milestone.progress));
  const id = `progress-${milestone.id}`;
  const number = Number(value);
  const valid = Number.isInteger(number) && number >= 0 && number < 100;
  return (
    <>
      <label htmlFor={id} className={page.muted}>
        Progress %
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={99}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 90 }}
      />
      <button
        disabled={!valid || update.isPending}
        onClick={() => update.mutate({ id: milestone.id, progress: number })}
      >
        Save progress
      </button>
      <Notice error={update.error} />
    </>
  );
}
