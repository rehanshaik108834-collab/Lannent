import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useStaffData, exportAudit, type AuditEvent } from './api';
import {
  Card,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  QueryView,
} from '../../shared/ui/ui';
import styles from '../../shared/ui/page.module.css';
export function CompliancePage() {
  const [actorId, setActorId] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = new URLSearchParams();
  if (actorId) params.set('actorId', actorId);
  if (kind) params.set('kind', kind);
  if (from) params.set('from', from);
  if (to) params.set('to', `${to}T23:59:59.999Z`);
  const queryString = `?${params}`;
  const query = useStaffData<{
    events: AuditEvent[];
    total: number;
    stored: number;
    droppedFromCapacity: number;
  }>(`/audit-log${queryString}`);
  const download = useMutation({ mutationFn: () => exportAudit(queryString) });
  return (
    <>
      <PageHeader
        title="Compliance audit trail"
        subtitle="Read-only history. No event can be edited or deleted here."
      />
      <Card>
        <div className={styles.row}>
          <Field id="actor-filter" label="Actor ID">
            <input
              id="actor-filter"
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
            />
          </Field>
          <Field id="kind" label="Event kind">
            <input
              id="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              placeholder="fee.change"
            />
          </Field>
          <Field id="from" label="From date">
            <input
              id="from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field id="to" label="Through date">
            <input
              id="to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
        <button disabled={download.isPending} onClick={() => download.mutate()}>
          Export filtered CSV
        </button>
        <Notice error={download.error} />
      </Card>
      <QueryView query={query}>
        {(data) => (
          <Card>
            <p>
              {data.total} matching events · showing {data.events.length}.{' '}
              {data.droppedFromCapacity > 0 &&
                `${data.droppedFromCapacity} older events rolled off the in-memory capacity.`}
            </p>
            {!data.events.length ? (
              <EmptyState title="No matching events" />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Event</th>
                      <th>Outcome</th>
                      <th>Request</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((row) => (
                      <tr key={row.id}>
                        <td>{new Date(row.at).toLocaleString()}</td>
                        <td>
                          {row.actorId} · {row.actorRole}
                        </td>
                        <td>{row.kind}</td>
                        <td>{row.outcome}</td>
                        <td>{row.requestId}</td>
                        <td>
                          <details>
                            <summary>View details</summary>
                            <pre style={{ whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(row.detail, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </QueryView>
    </>
  );
}
