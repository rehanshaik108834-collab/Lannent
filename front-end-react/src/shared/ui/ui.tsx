import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { statusLabel } from '../format/format';
import styles from './ui.module.css';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

/** Explains why a read failed, so a 403 or an outage never looks like "no data". */
/**
 * `level={1}` when the error replaces a whole page, so the page still has a
 * main heading for screen readers; level 2 inside cards.
 */
export function ErrorState({
  error,
  onRetry,
  level = 2,
}: {
  error: unknown;
  onRetry?: () => void;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const status = error instanceof ApiError ? error.status : 0;
  const title =
    status === 403
      ? 'You do not have access to this'
      : status === 404
        ? 'Not found'
        : status === 0
          ? 'The server could not be reached'
          : 'Something went wrong';
  return (
    <section className={styles.state} role="alert">
      <Heading>{title}</Heading>
      <p>{error instanceof Error ? error.message : 'Please try again.'}</p>
      {onRetry && status !== 403 && status !== 404 && (
        <button onClick={onRetry}>Try again</button>
      )}
    </section>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.state}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className={styles.loading} role="status">
      {label}
    </p>
  );
}

/** Renders a query's loading and error states, and its data once present. */
export function QueryView<T>({
  query,
  children,
  level,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  /** 1 when this query's data is the whole page (its error then carries the h1). */
  level?: 1 | 2;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        level={level}
        onRetry={() => void query.refetch()}
      />
    );
  return <>{children(query.data)}</>;
}

/** Inline result of an action: an error (role=alert) or a confirmation (role=status). */
export function Notice({
  error,
  success,
}: {
  error?: unknown;
  success?: string | null;
}) {
  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error instanceof Error ? error.message : 'The request failed.'}
      </p>
    );
  }
  return success ? (
    <p className={styles.success} role="status">
      {success}
    </p>
  ) : null;
}

const tone: Record<string, string> = {
  open: styles.info,
  pending: styles.neutral,
  'in-progress': styles.info,
  submitted: styles.warn,
  review: styles.warn,
  'revision-needed': styles.warn,
  disputed: styles.danger,
  completed: styles.ok,
  approved: styles.ok,
  hired: styles.ok,
  rejected: styles.neutral,
  withdrawn: styles.neutral,
  cancelled: styles.neutral,
  draft: styles.neutral,
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${tone[status] ?? styles.neutral}`}>
      {statusLabel(status)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

/** A labelled form control with an associated error message. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {children}
    </section>
  );
}
