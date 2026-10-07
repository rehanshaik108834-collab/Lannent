import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
import { formatDate, formatMoney } from '../../shared/format/format';
import type {
  FileReference,
  Milestone,
  Project,
} from '../../shared/types/domain';
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
import { useProject } from '../projects/hooks';
import {
  useApproveMilestone,
  useMilestone,
  useMilestones,
  useRequestRevision,
  useSubmitDeliverable,
} from './hooks';
import styles from './milestones.module.css';

const SUBMITTABLE = ['pending', 'in-progress', 'revision-needed', 'submitted'];
const REVIEWABLE = ['submitted', 'review'];

/**
 * Loads the project and milestone named in the URL and checks they belong
 * together. A mismatched pair is an error, never a fallback to another record.
 */
function useExactMilestone() {
  const { projectId, milestoneId } = useParams();
  const project = useProject(projectId);
  const milestone = useMilestone(milestoneId);
  return {
    project,
    milestone,
    mismatch: !!milestone.data && milestone.data.taskId !== projectId,
  };
}

function MilestoneHeading({
  project,
  milestone,
}: {
  project: Project;
  milestone: Milestone;
}) {
  return (
    <PageHeader
      title={milestone.title}
      subtitle={`${project.title} · ${formatMoney(milestone.budget)} · due ${formatDate(milestone.dueDate)}`}
      actions={
        <Link to={`/project/${project.id}/milestone-board`}>
          Milestone board
        </Link>
      }
    />
  );
}

// ── Submit ──────────────────────────────────────────────────────────────────

export function SubmitDeliverablePage() {
  const { project, milestone, mismatch } = useExactMilestone();
  if (mismatch)
    return (
      <ErrorState
        level={1}
        error={new Error('That milestone does not belong to this project.')}
      />
    );
  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <QueryView query={milestone}>
          {(m) => <SubmitForm project={p} milestone={m} />}
        </QueryView>
      )}
    </QueryView>
  );
}

function SubmitForm({
  project,
  milestone,
}: {
  project: Project;
  milestone: Milestone;
}) {
  const actor = useActor();
  const navigate = useNavigate();
  const submit = useSubmitDeliverable();
  const previous = milestone.deliverable;
  const [title, setTitle] = useState(previous?.title ?? '');
  const [description, setDescription] = useState(previous?.description ?? '');
  const [link, setLink] = useState(previous?.link ?? '');
  const [branch, setBranch] = useState(previous?.branch ?? '');
  const [files, setFiles] = useState<FileReference[]>(previous?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (milestone.workerId !== actor.id) {
    return (
      <ErrorState
        level={1}
        error={
          new Error(
            'Only the worker assigned to this milestone can submit work for it.',
          )
        }
      />
    );
  }
  if (!SUBMITTABLE.includes(milestone.status)) {
    return (
      <>
        <MilestoneHeading project={project} milestone={milestone} />
        <EmptyState title={`This milestone is ${milestone.status}`}>
          <p>Work can be submitted only while a milestone is open.</p>
        </EmptyState>
      </>
    );
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!chosen.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of chosen) {
        const ref = await api.uploadFile(file, {
          taskId: project.id,
          milestoneId: milestone.id,
          purpose: 'deliverable',
        });
        setFiles((current) => [...current, ref]);
      }
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (description.trim().length < 20)
      found.description =
        'Describe what you delivered in at least 20 characters.';
    if (link.trim() && !/^https?:\/\/\S+$/i.test(link.trim()))
      found.link = 'Enter a full http(s) link.';
    setErrors(found);
    if (Object.keys(found).length) return;
    submit.mutate(
      {
        id: milestone.id,
        deliverable: {
          title: title.trim() || undefined,
          description: description.trim(),
          link: link.trim() || undefined,
          branch: branch.trim() || undefined,
          files: files.map(({ id, name, size, mime, url }) => ({
            id,
            name,
            size,
            mime,
            url,
          })),
        },
      },
      {
        onSuccess: () =>
          navigate(`/project/${project.id}/milestone-board`, { replace: true }),
      },
    );
  }

  return (
    <>
      <MilestoneHeading project={project} milestone={milestone} />
      {milestone.revisionRequest && milestone.status === 'revision-needed' && (
        <Card>
          <h2>Requested changes</h2>
          <p>{milestone.revisionRequest.reason}</p>
        </Card>
      )}
      <form className={page.form} onSubmit={send} noValidate>
        <Card>
          <Field id="title" label="Title (optional)">
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field
            id="description"
            label="What you delivered"
            error={errors.description}
          >
            <textarea
              id="description"
              className={page.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={!!errors.description}
            />
          </Field>
          <div className={page.row}>
            <Field
              id="link"
              label="Link (optional)"
              error={errors.link}
              hint="Repository, preview or document"
            >
              <input
                id="link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </Field>
            <Field id="branch" label="Branch (optional)">
              <input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </Field>
          </div>
          <Field
            id="files"
            label="Files"
            hint="PDF, images, archives and documents; uploaded as you choose them."
          >
            <input
              id="files"
              type="file"
              multiple
              onChange={(e) => void attach(e)}
              disabled={uploading}
            />
          </Field>
          {uploading && <p role="status">Uploading…</p>}
          <Notice error={uploadError} />
          {files.length > 0 && (
            <ul className={page.list}>
              {files.map((f, index) => (
                <li key={f.id ?? f.name} className={page.itemHead}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Notice error={submit.error} />
        <button
          className={page.primary}
          type="submit"
          disabled={submit.isPending || uploading}
        >
          {submit.isPending ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
    </>
  );
}

// ── Review ──────────────────────────────────────────────────────────────────

export function ReviewDeliverablePage() {
  const { project, milestone, mismatch } = useExactMilestone();
  if (mismatch)
    return (
      <ErrorState
        level={1}
        error={new Error('That milestone does not belong to this project.')}
      />
    );
  return (
    <QueryView query={project} level={1}>
      {(p) => (
        <QueryView query={milestone}>
          {(m) => <Review project={p} milestone={m} />}
        </QueryView>
      )}
    </QueryView>
  );
}

function Review({
  project,
  milestone,
}: {
  project: Project;
  milestone: Milestone;
}) {
  const actor = useActor();
  const isClient = project.clientId === actor.id;
  const deliverable = milestone.deliverable;
  return (
    <>
      <MilestoneHeading project={project} milestone={milestone} />
      <div className={page.split}>
        <Card>
          <div className={page.itemHead}>
            <h2>Deliverable</h2>
            <StatusBadge status={milestone.status} />
          </div>
          {deliverable ? (
            <dl className={styles.deliverable}>
              {deliverable.title && (
                <>
                  <dt>Title</dt>
                  <dd>{deliverable.title}</dd>
                </>
              )}
              <dt>Description</dt>
              <dd>{deliverable.description || '—'}</dd>
              {deliverable.link && (
                <>
                  <dt>Link</dt>
                  <dd>
                    <a
                      href={deliverable.link}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {deliverable.link}
                    </a>
                  </dd>
                </>
              )}
              {deliverable.branch && (
                <>
                  <dt>Branch</dt>
                  <dd>{deliverable.branch}</dd>
                </>
              )}
              <dt>Submitted</dt>
              <dd>{formatDate(milestone.submittedAt)}</dd>
              {deliverable.files && deliverable.files.length > 0 && (
                <>
                  <dt>Files</dt>
                  <dd>
                    <Downloads files={deliverable.files} />
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p>No deliverable has been submitted yet.</p>
          )}
        </Card>
        <aside>
          {isClient ? (
            <ClientDecision project={project} milestone={milestone} />
          ) : (
            <Card>
              <p>Only the project’s client approves or requests changes.</p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function Downloads({ files }: { files: FileReference[] }) {
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <ul className={page.list}>
        {files.map((file) => (
          <li key={file.id ?? file.name}>
            {file.url ? (
              <button
                type="button"
                onClick={() => api.downloadFile(file).catch(setError)}
              >
                Download {file.name}
              </button>
            ) : (
              <span className={page.muted}>{file.name} (not stored)</span>
            )}
          </li>
        ))}
      </ul>
      <Notice error={error} />
    </>
  );
}

function ClientDecision({
  project,
  milestone,
}: {
  project: Project;
  milestone: Milestone;
}) {
  const approve = useApproveMilestone();
  const revise = useRequestRevision();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (approve.data) {
    const release = approve.data.release;
    return (
      <Card>
        <h2>Approved</h2>
        <p role="status">
          {release.alreadyReleased
            ? 'This milestone was already paid; nothing more was charged.'
            : `${formatMoney(release.net)} paid to the worker (${formatMoney(release.amount)} less ${formatMoney(release.fee)} service fee).`}
        </p>
        <Link to={`/project/${project.id}/workroom`}>Back to the workroom</Link>
      </Card>
    );
  }
  if (revise.isSuccess) {
    return (
      <Card>
        <h2>Changes requested</h2>
        <p role="status">
          The worker has been asked to revise. The milestone’s money stays in
          escrow.
        </p>
        <Link to={`/project/${project.id}/workroom`}>Back to the workroom</Link>
      </Card>
    );
  }
  if (!REVIEWABLE.includes(milestone.status)) {
    return (
      <Card>
        <p>There is nothing to decide: this milestone is {milestone.status}.</p>
      </Card>
    );
  }

  function requestChanges(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 10)
      return setReasonError(
        'Explain what needs to change in at least 10 characters.',
      );
    setReasonError(null);
    revise.mutate({ id: milestone.id, reason: reason.trim() });
  }

  return (
    <Card>
      <h2>Your decision</h2>
      {project.auditEnabled && (
        <p>
          This project has a technical audit: approval waits for the reviewer’s
          report on this milestone.
        </p>
      )}
      <ConfirmAction
        label="Approve and pay"
        confirmLabel="Confirm approval"
        explanation={`${formatMoney(milestone.budget)} is released from escrow to the worker, less their service fee.`}
        pending={approve.isPending}
        open={open === 'approve'}
        onOpenChange={(o) => setOpen(o ? 'approve' : null)}
        onConfirm={() => approve.mutate(milestone.id)}
      />
      <Notice error={approve.error} />
      <form onSubmit={requestChanges} noValidate>
        <Field
          id="reason"
          label="Request changes"
          error={reasonError ?? undefined}
        >
          <textarea
            id="reason"
            className={page.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Notice error={revise.error} />
        <button type="submit" disabled={revise.isPending}>
          {revise.isPending ? 'Sending…' : 'Request changes'}
        </button>
      </form>
    </Card>
  );
}

// ── Legacy aliases ─────────────────────────────────────────────────────────

/**
 * `/project/:id/submit-deliverable` and `/review-deliverable` predate exact
 * milestone routes. A supplied `milestoneId` is honoured; otherwise the viewer
 * chooses from eligible milestones. The first record is never auto-selected.
 */
export function DeliverableAliasPage({ mode }: { mode: 'submit' | 'review' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const actor = useActor();
  const milestones = useMilestones(id);
  const chosen = params.get('milestoneId');
  if (chosen)
    return (
      <Navigate
        to={`/project/${id}/milestones/${encodeURIComponent(chosen)}/${mode}`}
        replace
      />
    );
  const eligible = (m: Milestone) =>
    mode === 'submit'
      ? m.workerId === actor.id &&
        SUBMITTABLE.includes(m.status) &&
        m.status !== 'submitted'
      : REVIEWABLE.includes(m.status);
  return (
    <>
      <PageHeader
        title={
          mode === 'submit'
            ? 'Choose a milestone to submit'
            : 'Choose a milestone to review'
        }
      />
      <QueryView query={milestones}>
        {(list) => {
          const options = list.filter(eligible);
          return options.length === 0 ? (
            <EmptyState
              title={
                mode === 'submit'
                  ? 'Nothing to submit'
                  : 'Nothing awaiting review'
              }
            />
          ) : (
            <ul className={page.list}>
              {options.map((m) => (
                <li key={m.id} className={page.itemHead}>
                  <Link to={`/project/${id}/milestones/${m.id}/${mode}`}>
                    {m.title}
                  </Link>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </>
  );
}
