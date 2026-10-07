import { Link, useParams } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import type { Milestone, Project } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { MessageThread } from '../messages/MessageThread';
import { useEscrow, useProject } from '../projects/hooks';
import { useUser } from '../wallets/hooks';
import { MilestoneCard } from './MilestoneCard';
import { TerminationPanel } from '../projects/TerminationPanel';
import { useMilestones } from './hooks';
import { useDisputes } from '../disputes/hooks';
import type { Dispute } from '../../shared/types/domain';

/** Open disputes on this project, by milestone. Reads failing quietly leave the cards as they are. */
function useOpenDisputes(projectId: string | undefined): Map<string, Dispute> {
  const disputes = useDisputes();
  return new Map(
    (disputes.data ?? [])
      .filter(
        (d) =>
          d.taskId === projectId && d.status !== 'resolved' && d.milestoneId,
      )
      .map((d) => [d.milestoneId as string, d]),
  );
}
import styles from './milestones.module.css';

function ProjectSummary({ project }: { project: Project }) {
  const escrow = useEscrow(project.id);
  return (
    <StatGrid>
      <StatCard
        label="Status"
        value={<StatusBadge status={project.status} />}
      />
      <StatCard label="Budget" value={formatMoney(project.budget)} />
      <StatCard
        label="Held in escrow"
        value={
          escrow.isSuccess
            ? formatMoney(escrow.data.projectHeld)
            : escrow.isError
              ? 'Unavailable'
              : '…'
        }
        hint="Released milestone by milestone on approval"
      />
      <StatCard label="Progress" value={`${project.progress}%`} />
    </StatGrid>
  );
}

/** Shared by client, hired worker and engaged reviewers. Capabilities follow the viewer. */
export function WorkroomPage() {
  const { id } = useParams();
  const project = useProject(id);
  const milestones = useMilestones(id);
  const openDisputes = useOpenDisputes(id);
  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <>
          <PageHeader
            title={p.title}
            subtitle={`Workroom · ${p.category}`}
            actions={
              <>
                <Link to={`/project/${p.id}/milestone-board`}>
                  Milestone board
                </Link>
                <Link to={`/project/${p.id}/milestone-reports`}>Reports</Link>
              </>
            }
          />
          <ProjectSummary project={p} />
          <div className={page.split}>
            <Card>
              <h2>Milestones</h2>
              <QueryView query={milestones}>
                {(list) =>
                  list.length === 0 ? (
                    <p>No milestones yet.</p>
                  ) : (
                    <ul className={page.list}>
                      {list.map((m) => (
                        <MilestoneCard
                          key={m.id}
                          milestone={m}
                          project={p}
                          dispute={openDisputes.get(m.id)}
                        />
                      ))}
                    </ul>
                  )
                }
              </QueryView>
            </Card>
            <div>
              <Conversation project={p} />
              <TerminationPanel project={p} />
            </div>
          </div>
        </>
      )}
    </QueryView>
  );
}

function Conversation({ project }: { project: Project }) {
  const actor = useActor();
  const counterpartId =
    actor.id === project.clientId
      ? project.workerId
      : actor.id === project.workerId
        ? project.clientId
        : null;
  const counterpart = useUser(counterpartId);
  if (!counterpartId) {
    return (
      <Card>
        <h2>Conversation</h2>
        <p>
          {project.workerId
            ? 'Messages are between the client and the hired worker.'
            : 'Nobody has been hired yet.'}
        </p>
      </Card>
    );
  }
  const name =
    counterpart.data?.name ??
    (actor.id === project.clientId ? 'the worker' : 'the client');
  return (
    <Card>
      <h2>Conversation with {name}</h2>
      <MessageThread
        taskId={project.id}
        counterpartId={counterpartId}
        counterpartName={name}
      />
    </Card>
  );
}

const COLUMNS: { title: string; statuses: Milestone['status'][] }[] = [
  { title: 'To do', statuses: ['pending', 'revision-needed'] },
  { title: 'In progress', statuses: ['in-progress'] },
  { title: 'In review', statuses: ['submitted', 'review', 'disputed'] },
  { title: 'Done', statuses: ['completed', 'approved', 'audit-passed'] },
];

/** One board for every role; the cards carry the viewer's actions. */
export function MilestoneBoardPage() {
  const { id } = useParams();
  const project = useProject(id);
  const milestones = useMilestones(id);
  const openDisputes = useOpenDisputes(id);
  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <>
          <PageHeader
            title={`${p.title}: milestones`}
            actions={<Link to={`/project/${p.id}/workroom`}>Workroom</Link>}
          />
          <QueryView query={milestones}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState title="No milestones yet" />
              ) : (
                <div className={styles.board}>
                  {COLUMNS.map((column) => {
                    const items = list.filter((m) =>
                      column.statuses.includes(m.status),
                    );
                    return (
                      <section
                        key={column.title}
                        className={styles.column}
                        aria-label={column.title}
                      >
                        <h2>
                          {column.title}{' '}
                          <span className={page.muted}>{items.length}</span>
                        </h2>
                        <ul className={page.list}>
                          {items.map((m) => (
                            <MilestoneCard
                              key={m.id}
                              milestone={m}
                              project={p}
                              dispute={openDisputes.get(m.id)}
                            />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )
            }
          </QueryView>
        </>
      )}
    </QueryView>
  );
}
