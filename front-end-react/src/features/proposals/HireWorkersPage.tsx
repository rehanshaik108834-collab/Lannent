import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import type { DirectoryUser, Project } from '../../shared/types/domain';
import {
  EmptyState,
  Field,
  Notice,
  PageHeader,
  QueryView,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useProjects } from '../projects/hooks';
import { useDirectory } from '../wallets/hooks';
import { useInviteWorker } from './hooks';

/** Worker directory. A client invites a worker to one of their open projects. */
export function HireWorkersPage() {
  const actor = useActor();
  const workers = useDirectory('worker');
  const projects = useProjects({ clientId: actor.id, status: 'open' });
  const [search, setSearch] = useState('');

  return (
    <>
      <PageHeader
        title="Hire gig workers"
        subtitle="Invite a worker to one of your open projects."
      />
      <Field id="search" label="Search by name or skill">
        <input
          id="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <QueryView query={projects}>
        {(open) =>
          open.length === 0 ? (
            <EmptyState title="You have no open projects">
              <p>
                <Link to="/client/post-task">Post a task</Link> before inviting
                workers.
              </p>
            </EmptyState>
          ) : (
            <QueryView query={workers}>
              {(list) => {
                const needle = search.trim().toLowerCase();
                const shown = list.filter(
                  (w) =>
                    w.status !== 'suspended' &&
                    (!needle ||
                      [w.name, w.jobTitle ?? '', ...(w.skills ?? [])].some(
                        (t) => t.toLowerCase().includes(needle),
                      )),
                );
                return shown.length === 0 ? (
                  <EmptyState title="No workers match" />
                ) : (
                  <ul className={page.list}>
                    {shown.map((worker) => (
                      <WorkerCard
                        key={worker.id}
                        worker={worker}
                        projects={open}
                      />
                    ))}
                  </ul>
                );
              }}
            </QueryView>
          )
        }
      </QueryView>
    </>
  );
}

function WorkerCard({
  worker,
  projects,
}: {
  worker: DirectoryUser;
  projects: Project[];
}) {
  const invite = useInviteWorker();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const selectId = `project-${worker.id}`;
  return (
    <li className={page.item}>
      <div className={page.itemHead}>
        <h3>{worker.name}</h3>
        {worker.jobTitle && (
          <span className={page.muted}>{worker.jobTitle}</span>
        )}
      </div>
      <div className={page.meta}>
        {worker.location && <span>{worker.location}</span>}
        {!!worker.rating && <span>Rating {worker.rating}</span>}
        {typeof worker.completedProjects === 'number' && (
          <span>{worker.completedProjects} projects done</span>
        )}
        {!!worker.hourlyRate && (
          <span>{formatMoney(worker.hourlyRate)}/hr</span>
        )}
      </div>
      {worker.skills && worker.skills.length > 0 && (
        <p>{worker.skills.join(' · ')}</p>
      )}
      <div className={page.inline}>
        <label htmlFor={selectId} className={page.muted}>
          Project
        </label>
        <select
          id={selectId}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={{ width: 'auto' }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button
          disabled={invite.isPending || invite.isSuccess || !projectId}
          onClick={() =>
            invite.mutate({ taskId: projectId, workerId: worker.id })
          }
        >
          {invite.isSuccess
            ? 'Invited'
            : invite.isPending
              ? 'Inviting…'
              : 'Invite'}
        </button>
      </div>
      <Notice
        error={invite.error}
        success={invite.isSuccess ? `Invitation sent to ${worker.name}.` : null}
      />
    </li>
  );
}
