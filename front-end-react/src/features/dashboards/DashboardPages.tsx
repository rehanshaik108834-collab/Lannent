import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import type { Project } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { ProjectCard } from '../projects/ProjectCard';
import { useProjects } from '../projects/hooks';
import { useProposals } from '../proposals/hooks';
import { useAccount } from '../wallets/hooks';

/** A count that shows "…" while loading and "—" if its query failed, never a fake zero. */
function count<T>(
  query: { data?: T[]; isError: boolean },
  predicate: (item: T) => boolean = () => true,
) {
  if (query.isError) return '—';
  return query.data ? query.data.filter(predicate).length : '…';
}

function ActiveProjects({
  projects,
  empty,
}: {
  projects: Project[];
  empty: React.ReactNode;
}) {
  const active = projects.filter(
    (p) => p.status !== 'cancelled' && p.status !== 'completed',
  );
  if (active.length === 0)
    return <EmptyState title="No active projects">{empty}</EmptyState>;
  return (
    <ul className={page.list}>
      {active.slice(0, 5).map((p) => (
        <ProjectCard key={p.id} project={p}>
          {p.status === 'open' ? (
            <Link to={`/tasks/${p.id}`}>Details</Link>
          ) : (
            <Link to={`/project/${p.id}/workroom`}>Workroom</Link>
          )}
        </ProjectCard>
      ))}
    </ul>
  );
}

export function ClientDashboardPage() {
  const actor = useActor();
  const account = useAccount();
  const projects = useProjects({ clientId: actor.id });
  const proposals = useProposals({ type: 'proposal' });
  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name}`}
        actions={
          <Link className="button" to="/client/post-task">
            Post a task
          </Link>
        }
      />
      <StatGrid>
        <StatCard
          label="Wallet balance"
          value={
            account.data
              ? formatMoney(account.data.walletBalance)
              : account.isError
                ? '—'
                : '…'
          }
        />
        <StatCard
          label="Open for proposals"
          value={count(projects, (p) => p.status === 'open')}
        />
        <StatCard
          label="In progress"
          value={count(projects, (p) => p.status === 'in-progress')}
        />
        <StatCard
          label="Proposals to review"
          value={count(proposals, (p) => p.status === 'pending')}
        />
      </StatGrid>
      <Card>
        <h2>Your projects</h2>
        <QueryView query={projects}>
          {(list) => (
            <ActiveProjects
              projects={list}
              empty={<Link to="/client/post-task">Post your first task</Link>}
            />
          )}
        </QueryView>
      </Card>
    </>
  );
}

export function WorkerDashboardPage() {
  const actor = useActor();
  const account = useAccount();
  const projects = useProjects({ workerId: actor.id });
  const proposals = useProposals();
  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name}`}
        actions={
          <Link className="button" to="/worker/browse">
            Browse tasks
          </Link>
        }
      />
      <StatGrid>
        <StatCard
          label="Wallet balance"
          value={
            account.data
              ? formatMoney(account.data.walletBalance)
              : account.isError
                ? '—'
                : '…'
          }
        />
        <StatCard
          label="Active projects"
          value={count(projects, (p) => p.status === 'in-progress')}
        />
        <StatCard
          label="Pending proposals"
          value={count(
            proposals,
            (p) => p.type === 'proposal' && p.status === 'pending',
          )}
        />
        <StatCard
          label="Invitations"
          value={count(
            proposals,
            (p) => p.type === 'invitation' && p.status === 'pending',
          )}
        />
      </StatGrid>
      <Card>
        <h2>Your projects</h2>
        <QueryView query={projects}>
          {(list) => (
            <ActiveProjects
              projects={list}
              empty={<Link to="/worker/browse">Find a project</Link>}
            />
          )}
        </QueryView>
      </Card>
    </>
  );
}
