import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatDate, formatMoney } from '../../shared/format/format';
import type { Project, Proposal } from '../../shared/types/domain';
import {
  Card,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useMilestones } from '../milestones/hooks';
import {
  useCloseProposal,
  useProposals,
  useSubmitProposal,
} from '../proposals/hooks';
import { useProject } from './hooks';

/** Project details; workers propose here, the owning client follows up from here. */
export function TaskDetailsPage() {
  const { id } = useParams();
  const project = useProject(id);
  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <>
          <PageHeader
            title={p.title}
            subtitle={`${p.category} · posted ${formatDate(p.createdAt)}`}
          />
          <div className={page.split}>
            <div>
              <Card>
                <div className={page.itemHead}>
                  <h2>About this project</h2>
                  <StatusBadge status={p.status} />
                </div>
                <p>{p.description}</p>
                <div className={page.meta}>
                  <span>Budget {formatMoney(p.budget)}</span>
                  <span>Deadline {formatDate(p.deadline)}</span>
                  {p.skills.length > 0 && (
                    <span>Skills: {p.skills.join(', ')}</span>
                  )}
                </div>
              </Card>
              <MilestoneSummary projectId={p.id} />
            </div>
            <aside>
              <ProjectActions project={p} />
            </aside>
          </div>
        </>
      )}
    </QueryView>
  );
}

function MilestoneSummary({ projectId }: { projectId: string }) {
  const milestones = useMilestones(projectId);
  return (
    <Card>
      <h2>Milestones</h2>
      <QueryView query={milestones}>
        {(list) =>
          list.length === 0 ? (
            <p>No milestones yet.</p>
          ) : (
            <ol className={page.list}>
              {list.map((m) => (
                <li key={m.id} className={page.itemHead}>
                  <span>{m.title}</span>
                  <span className={page.muted}>{formatMoney(m.budget)}</span>
                </li>
              ))}
            </ol>
          )
        }
      </QueryView>
    </Card>
  );
}

function ProjectActions({ project }: { project: Project }) {
  const actor = useActor();
  if (actor.id === project.clientId) {
    return (
      <Card>
        <h2>Your project</h2>
        {project.status === 'open' ? (
          <p>
            <Link to={`/client/applications?taskId=${project.id}`}>
              Review proposals
            </Link>{' '}
            or <Link to="/client/hire">invite a worker</Link>.
          </p>
        ) : (
          <p>
            <Link to={`/project/${project.id}/workroom`}>
              Open the workroom
            </Link>
          </p>
        )}
      </Card>
    );
  }
  if (actor.role === 'worker') return <WorkerProposal project={project} />;
  return null;
}

function WorkerProposal({ project }: { project: Project }) {
  const proposals = useProposals({ taskId: project.id });
  return (
    <QueryView query={proposals}>
      {(list) => {
        const mine = list.find(
          (p) => p.status === 'pending' || p.status === 'hired',
        );
        if (mine) return <OwnProposal proposal={mine} projectId={project.id} />;
        if (project.status !== 'open') {
          return (
            <Card>
              <p>This project is no longer accepting proposals.</p>
            </Card>
          );
        }
        return <ProposalForm projectId={project.id} />;
      }}
    </QueryView>
  );
}

function OwnProposal({
  proposal,
  projectId,
}: {
  proposal: Proposal;
  projectId: string;
}) {
  const close = useCloseProposal();
  return (
    <Card>
      <div className={page.itemHead}>
        <h2>
          Your {proposal.type === 'invitation' ? 'invitation' : 'proposal'}
        </h2>
        <StatusBadge status={proposal.status} />
      </div>
      <div className={page.meta}>
        {proposal.bidPrice && <span>Bid {proposal.bidPrice}</span>}
        {proposal.timeline && <span>{proposal.timeline}</span>}
      </div>
      {proposal.status === 'hired' && (
        <Link to={`/project/${projectId}/workroom`}>Go to the workroom</Link>
      )}
      {proposal.status === 'pending' && proposal.type === 'proposal' && (
        <button
          disabled={close.isPending}
          onClick={() => close.mutate({ id: proposal.id, status: 'withdrawn' })}
        >
          Withdraw proposal
        </button>
      )}
      {proposal.status === 'pending' && proposal.type === 'invitation' && (
        <Link to="/worker/invitations">Respond to the invitation</Link>
      )}
      <Notice error={close.error} />
    </Card>
  );
}

function ProposalForm({ projectId }: { projectId: string }) {
  const submit = useSubmitProposal();
  const [bid, setBid] = useState('');
  const [timeline, setTimeline] = useState('');
  const [letter, setLetter] = useState('');
  const [error, setError] = useState<string | null>(null);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(bid.trim()))
      return setError('Enter your bid in rupees.');
    if (letter.trim().length < 20)
      return setError(
        'Tell the client about your approach in at least 20 characters.',
      );
    setError(null);
    submit.mutate({
      taskId: projectId,
      bidPrice: `₹${bid.trim()}`,
      timeline: timeline.trim(),
      coverLetter: letter.trim(),
    });
  }

  return (
    <Card>
      <h2>Send a proposal</h2>
      <form onSubmit={send} noValidate>
        <Field id="bid" label="Your bid (₹)">
          <input
            id="bid"
            inputMode="decimal"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
          />
        </Field>
        <Field id="timeline" label="Timeline" hint="e.g. 3 weeks">
          <input
            id="timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
          />
        </Field>
        <Field id="letter" label="Cover letter">
          <textarea
            id="letter"
            className={page.textarea}
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
          />
        </Field>
        {error && <p role="alert">{error}</p>}
        <Notice error={submit.error} />
        <button
          className={page.primary}
          type="submit"
          disabled={submit.isPending}
        >
          {submit.isPending ? 'Sending…' : 'Send proposal'}
        </button>
      </form>
    </Card>
  );
}
