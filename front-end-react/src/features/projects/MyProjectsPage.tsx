import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import type { Project } from '../../shared/types/domain';
import { EmptyState, Notice, PageHeader, QueryView } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { ProjectCard } from './ProjectCard';
import { useDeleteProject, useProjects } from './hooks';

/**
 * The signed-in party's projects. Clients own them; workers are hired on them.
 * A client may delete a project only while it is open and nobody is hired —
 * the server refuses anything else and never refunds a budget.
 */
export function MyProjectsPage() {
  const actor = useActor();
  const isClient = actor.role === 'client';
  const projects = useProjects(
    isClient ? { clientId: actor.id } : { workerId: actor.id },
  );
  const remove = useDeleteProject();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="My projects"
        subtitle={
          isClient
            ? 'Projects you have posted.'
            : 'Projects you have been hired on.'
        }
        actions={
          isClient ? (
            <Link className="button" to="/client/post-task">
              Post a task
            </Link>
          ) : undefined
        }
      />
      <Notice error={remove.error} success={deleted} />
      <QueryView query={projects}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No projects yet">
              <p>
                {isClient ? (
                  <Link to="/client/post-task">Post your first task</Link>
                ) : (
                  <Link to="/worker/browse">Browse open tasks</Link>
                )}
              </p>
            </EmptyState>
          ) : (
            <ul className={page.list}>
              {list.map((project: Project) => (
                <ProjectCard key={project.id} project={project}>
                  {project.status === 'open' ? (
                    <Link to={`/tasks/${project.id}`}>View details</Link>
                  ) : (
                    <>
                      <Link to={`/project/${project.id}/workroom`}>
                        Workroom
                      </Link>
                      <Link to={`/project/${project.id}/milestone-board`}>
                        Milestone board
                      </Link>
                    </>
                  )}
                  {isClient &&
                    project.status === 'open' &&
                    !project.workerId &&
                    (confirming === project.id ? (
                      <>
                        <span>
                          Delete? Nobody is hired, so nothing is refunded.
                        </span>
                        <button
                          className={page.danger}
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(project.id, {
                              onSuccess: () => {
                                setConfirming(null);
                                setDeleted(`Deleted “${project.title}”.`);
                              },
                            })
                          }
                        >
                          Confirm delete
                        </button>
                        <button onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setDeleted(null);
                          setConfirming(project.id);
                        }}
                      >
                        Delete
                      </button>
                    ))}
                </ProjectCard>
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}
