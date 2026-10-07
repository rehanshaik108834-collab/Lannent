import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { keys } from '../../shared/api/keys';
import { formatDate } from '../../shared/format/format';
import type {
  ExpertApplication,
  FileReference,
} from '../../shared/types/domain';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import {
  EmptyState,
  Notice,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { decideApplication, listApplications } from './api';

const FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

/**
 * Expert applications. The intake desk approves or rejects; approval creates
 * the reviewer's account with their own password. Compliance reads only.
 */
export function IntakePage() {
  const actor = useActor();
  const canDecide = actor.role === 'intake-admin';
  const applications = useQuery({
    queryKey: keys.applications(actor.id),
    queryFn: listApplications,
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  return (
    <>
      <PageHeader
        title="Expert applications"
        subtitle={
          canDecide
            ? 'Review applicants and their documents.'
            : 'Read-only oversight view.'
        }
      />
      <div
        className={page.inline}
        role="group"
        aria-label="Filter applications"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={filter === f ? page.primary : undefined}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <QueryView query={applications}>
        {(list) => {
          const shown = list.filter(
            (a) => filter === 'all' || a.status === filter,
          );
          return shown.length === 0 ? (
            <EmptyState
              title={`No ${filter === 'all' ? '' : `${filter} `}applications`}
            />
          ) : (
            <ul className={page.list} style={{ marginTop: 20 }}>
              {shown.map((a) => (
                <Application key={a.id} application={a} canDecide={canDecide} />
              ))}
            </ul>
          );
        }}
      </QueryView>
    </>
  );
}

function Application({
  application: a,
  canDecide,
}: {
  application: ExpertApplication;
  canDecide: boolean;
}) {
  const invalidate = useInvalidate();
  const decide = useMutation({
    mutationFn: (status: 'approved' | 'rejected') =>
      decideApplication(a.id, status),
    onSuccess: () => invalidate(['applications', 'directory']),
  });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <li className={page.item}>
      <div className={page.itemHead}>
        <h2>{a.name}</h2>
        <StatusBadge status={a.status} />
      </div>
      <div className={page.meta}>
        <span>{a.email}</span>
        {a.expertise && <span>{a.expertise}</span>}
        {a.experience && <span>{a.experience} years</span>}
        {a.country && <span>{a.country}</span>}
        <span>Applied {formatDate(a.appliedAt)}</span>
        {a.reviewedAt && <span>Decided {formatDate(a.reviewedAt)}</span>}
      </div>
      {a.motivation && <p>{a.motivation}</p>}
      <div className={page.inline}>
        {a.linkedin && /^https?:\/\//i.test(a.linkedin) && (
          <a href={a.linkedin} target="_blank" rel="noreferrer noopener">
            LinkedIn
          </a>
        )}
        {a.github && /^https?:\/\//i.test(a.github) && (
          <a href={a.github} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
        )}
        <Document file={a.resumeFile} label="Résumé" />
        <Document file={a.certificateFile} label="Certificate" />
      </div>
      {canDecide && a.status === 'pending' && (
        <div className={page.inline}>
          <ConfirmAction
            label="Approve"
            confirmLabel="Confirm approval"
            explanation="Creates their Expert Reviewer account with the password they chose."
            pending={decide.isPending}
            open={open === 'approve'}
            onOpenChange={(o) => setOpen(o ? 'approve' : null)}
            onConfirm={() =>
              decide.mutate('approved', { onSuccess: () => setOpen(null) })
            }
          />
          <ConfirmAction
            label="Reject"
            confirmLabel="Confirm rejection"
            explanation="The decision is final."
            danger
            pending={decide.isPending}
            open={open === 'reject'}
            onOpenChange={(o) => setOpen(o ? 'reject' : null)}
            onConfirm={() =>
              decide.mutate('rejected', { onSuccess: () => setOpen(null) })
            }
          />
        </div>
      )}
      <Notice error={decide.error} />
    </li>
  );
}

function Document({
  file,
  label,
}: {
  file?: FileReference | null;
  label: string;
}) {
  const [error, setError] = useState<unknown>(null);
  if (!file?.url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => api.downloadFile(file).catch(setError)}
      >
        Download {label.toLowerCase()}
      </button>
      <Notice error={error} />
    </>
  );
}
