import page from './page.module.css';

/**
 * Two-step confirmation for actions with consequences. The first press shows
 * what will happen; nothing is sent until the second.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  explanation,
  pending,
  onConfirm,
  danger,
  open,
  onOpenChange,
}: {
  label: string;
  confirmLabel: string;
  explanation: string;
  pending: boolean;
  onConfirm: () => void;
  danger?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return <button onClick={() => onOpenChange(true)}>{label}</button>;
  return (
    <span className={page.inline} role="group" aria-label={label}>
      <span>{explanation}</span>
      <button
        className={danger ? page.danger : page.primary}
        disabled={pending}
        onClick={onConfirm}
      >
        {pending ? 'Working…' : confirmLabel}
      </button>
      <button disabled={pending} onClick={() => onOpenChange(false)}>
        Cancel
      </button>
    </span>
  );
}
