/**
 * Display formatting. INR is the only currency; amounts arrive from the server
 * already calculated, so this never does arithmetic on money.
 */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});

export function formatMoney(rupees: number | null | undefined): string {
  return typeof rupees === 'number' && Number.isFinite(rupees)
    ? inr.format(rupees)
    : '—';
}

const day = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Formats an ISO date (`2026-10-06` or a full timestamp); unknown values show a dash. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : day.format(date);
}

/** Human labels for status values the API returns in kebab-case. */
export function statusLabel(status: string): string {
  const special: Record<string, string> = {
    'in-progress': 'In progress',
    'revision-needed': 'Changes requested',
    'audit-passed': 'Audit passed',
  };
  return (
    special[status] ??
    status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')
  );
}
