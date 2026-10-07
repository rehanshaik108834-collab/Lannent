import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import { useStaffData } from './api';
import type { Project, DirectoryUser } from '../../shared/types/domain';
import {
  Card,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
  StatusBadge,
} from '../../shared/ui/ui';
import { formatMoney } from '../../shared/format/format';
import styles from '../../shared/ui/page.module.css';

export function OperationsDashboard() {
  const projects = useStaffData<Project[]>('/tasks');
  const users = useStaffData<DirectoryUser[]>('/users');
  return (
    <>
      <PageHeader
        title="Operations dashboard"
        subtitle="Project and account oversight. Revenue and reviewer intake have separate desks."
        actions={
          <Link to="/superuser/create-task">Create a project for a client</Link>
        }
      />
      <QueryView query={projects}>
        {(rows) => (
          <StatGrid>
            <StatCard label="Projects" value={rows.length} />
            <StatCard
              label="Open"
              value={rows.filter((row) => row.status === 'open').length}
            />
            <StatCard
              label="In progress"
              value={rows.filter((row) => row.status === 'in-progress').length}
            />
            <StatCard
              label="Completed"
              value={rows.filter((row) => row.status === 'completed').length}
            />
          </StatGrid>
        )}
      </QueryView>
      <QueryView query={users}>
        {(rows) => (
          <StatGrid>
            <StatCard label="Accounts" value={rows.length} />
            <StatCard
              label="Suspended"
              value={rows.filter((row) => row.status === 'suspended').length}
            />
          </StatGrid>
        )}
      </QueryView>
      <Card>
        <h2>Operations tools</h2>
        <p>
          <Link to="/superuser/users">Manage users</Link> ·{' '}
          <Link to="/superuser/tasks">Manage projects</Link> ·{' '}
          <Link to="/superuser/disputes">Assign dispute reviewers</Link> ·{' '}
          <Link to="/superuser/escrow">Escrow overview</Link>
        </p>
      </Card>
    </>
  );
}
export function OperationsProjects() {
  const query = useStaffData<Project[]>('/tasks');
  return (
    <>
      <PageHeader
        title="Manage projects"
        subtitle="Inspect workrooms, edit project descriptions, or remove unfunded open projects."
        actions={
          <Link to="/superuser/create-task">Create project on behalf</Link>
        }
      />
      <QueryView query={query}>
        {(rows) =>
          !rows.length ? (
            <EmptyState title="No projects" />
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => (
                <OperationsProject key={row.id} project={row} />
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}
function OperationsProject({ project }: { project: Project }) {
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const update = useMutation({
    mutationFn: (body: object) =>
      api.request(`/operations/projects/${project.id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      setEditing(false);
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.request(`/tasks/${project.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      title: form.get('title'),
      description: form.get('description'),
    });
  }
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <h2>{project.title}</h2>
        <StatusBadge status={project.status} />
      </div>
      <p>
        Client {project.clientId} · Worker {project.workerId ?? 'unassigned'} ·{' '}
        {formatMoney(project.budget)}
      </p>
      <div className={styles.inline}>
        <Link to={`/project/${project.id}/workroom`}>Open workroom</Link>
        <button onClick={() => setEditing(!editing)}>
          Edit project details
        </button>
        {project.status === 'open' && !project.workerId && (
          <ConfirmAction
            label="Delete unfunded project"
            confirmLabel="Confirm deletion"
            explanation="The server permits deletion only if no funds or settlement history exist. No refund is created."
            open={confirm}
            onOpenChange={setConfirm}
            pending={remove.isPending}
            onConfirm={() => remove.mutate()}
            danger
          />
        )}
      </div>
      {editing && (
        <form onSubmit={submit}>
          <Field id={`title-${project.id}`} label="Project title">
            <input
              id={`title-${project.id}`}
              name="title"
              defaultValue={project.title}
              required
            />
          </Field>
          <Field id={`description-${project.id}`} label="Project description">
            <textarea
              id={`description-${project.id}`}
              className={styles.textarea}
              name="description"
              defaultValue={project.description}
              required
            />
          </Field>
          <button disabled={update.isPending}>Save project details</button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel editing
          </button>
        </form>
      )}
      <Notice error={update.error || remove.error} />
    </li>
  );
}
export function EscrowPage() {
  const query = useStaffData<{
    totalHeld: number;
    escrowByTask: Record<string, { projectHeld: number; auditHeld: number }>;
  }>('/ledger/summary');
  return (
    <>
      <PageHeader
        title="Escrow overview"
        subtitle="Held funds are read-only here. Settlement and refunds follow their authorized workflows."
      />
      <QueryView query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard
                label="Total held"
                value={formatMoney(data.totalHeld)}
              />
            </StatGrid>
            <Card>
              {Object.entries(data.escrowByTask).map(([id, held]) => (
                <p key={id}>
                  <Link to={`/project/${id}/workroom`}>{id}</Link> · Project{' '}
                  {formatMoney(held.projectHeld)} · Audit{' '}
                  {formatMoney(held.auditHeld)}
                </p>
              ))}
            </Card>
          </>
        )}
      </QueryView>
    </>
  );
}
type Dispute = {
  id: string;
  taskId: string;
  reason: string;
  status: string;
  expertId: string | null;
};
export function OperationsDisputes() {
  const cases = useStaffData<Dispute[]>('/disputes');
  const experts = useStaffData<DirectoryUser[]>('/users?role=expert');
  return (
    <>
      <PageHeader
        title="Dispute oversight"
        subtitle="Assign eligible reviewers to unresolved cases. Only the assigned expert can issue a verdict."
      />
      <QueryView query={experts}>
        {(reviewers) => (
          <QueryView query={cases}>
            {(rows) =>
              !rows.length ? (
                <EmptyState title="No disputes" />
              ) : (
                <ul className={styles.list}>
                  {rows.map((row) => (
                    <DisputeAssignment
                      key={row.id}
                      dispute={row}
                      reviewers={reviewers}
                    />
                  ))}
                </ul>
              )
            }
          </QueryView>
        )}
      </QueryView>
    </>
  );
}
function DisputeAssignment({
  dispute,
  reviewers,
}: {
  dispute: Dispute;
  reviewers: DirectoryUser[];
}) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: (expertId: string) =>
      api.request(`/operations/disputes/${dispute.id}/reviewer`, {
        method: 'PATCH',
        body: { expertId },
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(String(new FormData(event.currentTarget).get('expertId')));
  }
  return (
    <li className={styles.item}>
      <h2>Case {dispute.id}</h2>
      <p>{dispute.reason}</p>
      <StatusBadge status={dispute.status} />
      <Link to={`/dispute/${dispute.id}`}>View case</Link>
      {dispute.status !== 'resolved' && (
        <form onSubmit={submit}>
          <Field id={`reviewer-${dispute.id}`} label="Assign expert reviewer">
            <select
              id={`reviewer-${dispute.id}`}
              name="expertId"
              required
              defaultValue={dispute.expertId ?? ''}
            >
              <option value="">Choose an active expert</option>
              {reviewers
                .filter((row) => row.status === 'active')
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </Field>
          <button disabled={mutation.isPending}>Assign reviewer</button>
          <Notice
            error={mutation.error}
            success={mutation.isSuccess ? 'Reviewer assigned.' : undefined}
          />
        </form>
      )}
    </li>
  );
}
export function CreateOnBehalfPage() {
  const clients = useStaffData<DirectoryUser[]>('/users?role=client');
  const [milestones, setMilestones] = useState([{ title: '', budget: '' }]);
  const mutation = useMutation({
    mutationFn: (body: object) =>
      api.request<Project>('/operations/projects', { method: 'POST', body }),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      title: form.get('title'),
      description: form.get('description'),
      category: form.get('category'),
      clientId: form.get('clientId'),
      currency: 'INR',
      budget: Number(form.get('budget')),
      milestones: milestones.map((row) => ({
        title: row.title,
        budget: Number(row.budget),
      })),
    });
  }
  return (
    <>
      <PageHeader
        title="Create project on behalf"
        subtitle="Choose the actual client. Your operations identity is recorded in the audit trail."
      />
      <QueryView query={clients}>
        {(rows) => (
          <Card>
            <form onSubmit={submit} className={styles.form}>
              <Field id="clientId" label="Client">
                <select id="clientId" name="clientId" required>
                  <option value="">Select an active client</option>
                  {rows
                    .filter((row) => row.status === 'active')
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field id="title" label="Project title">
                <input id="title" name="title" required />
              </Field>
              <Field id="description" label="Project description">
                <textarea
                  id="description"
                  name="description"
                  className={styles.textarea}
                  required
                />
              </Field>
              <Field id="category" label="Category">
                <select id="category" name="category">
                  <option>Web Development</option>
                  <option>Mobile Development</option>
                  <option>Backend / API</option>
                  <option>UI/UX Design</option>
                  <option>AI / Machine Learning</option>
                  <option>DevOps / Cloud</option>
                </select>
              </Field>
              <Field id="budget" label="Project budget (INR)">
                <input
                  id="budget"
                  name="budget"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                />
              </Field>
              <h2>Initial milestones</h2>
              {milestones.map((row, index) => (
                <fieldset key={index}>
                  <legend>Milestone {index + 1}</legend>
                  <label>
                    Title
                    <input
                      aria-label={`Milestone ${index + 1} title`}
                      value={row.title}
                      required
                      minLength={2}
                      onChange={(event) =>
                        setMilestones(
                          milestones.map((item, i) =>
                            i === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Budget (INR)
                    <input
                      aria-label={`Milestone ${index + 1} budget`}
                      value={row.budget}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      onChange={(event) =>
                        setMilestones(
                          milestones.map((item, i) =>
                            i === index
                              ? { ...item, budget: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMilestones(milestones.filter((_, i) => i !== index))
                      }
                    >
                      Remove milestone {index + 1}
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                disabled={milestones.length >= 50}
                onClick={() =>
                  setMilestones([...milestones, { title: '', budget: '' }])
                }
              >
                Add milestone
              </button>
              <p>Milestone budgets must add up to the project budget.</p>
              <Notice
                error={mutation.error}
                success={
                  mutation.isSuccess
                    ? 'Project created for the selected client.'
                    : undefined
                }
              />
              {mutation.data && (
                <p>
                  <Link to={`/project/${mutation.data.id}/workroom`}>
                    Open created project
                  </Link>
                </p>
              )}
              <button disabled={mutation.isPending}>
                Create project for client
              </button>
            </form>
          </Card>
        )}
      </QueryView>
    </>
  );
}
