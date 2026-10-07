import { useProjects } from '../projects/hooks';
import { useActor } from '../../shared/api/actor';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { Transaction } from '../../shared/types/domain';
import {
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
  Card,
  EmptyState,
} from '../../shared/ui/ui';
import { formatMoney } from '../../shared/format/format';

export function AnalyticsPage() {
  const actor = useActor();
  const projects = useProjects(
    actor.role === 'client' ? { clientId: actor.id } : { workerId: actor.id },
  );
  const transactions = useQuery({
    queryKey: ['analytics-transactions', actor.id],
    queryFn: () => api.request<Transaction[]>('/transactions'),
  });
  return (
    <>
      <PageHeader
        title="Your analytics"
        subtitle="Figures from projects and transaction history visible to your account."
      />
      <QueryView query={projects}>
        {(rows) => (
          <>
            <StatGrid>
              <StatCard label="Projects" value={rows.length} />
              <StatCard
                label="In progress"
                value={
                  rows.filter((row) => row.status === 'in-progress').length
                }
              />
              <StatCard
                label="Completed"
                value={rows.filter((row) => row.status === 'completed').length}
              />
              <StatCard
                label="Average progress"
                value={`${rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0}%`}
              />
            </StatGrid>
            <Card>
              <h2>Project progress</h2>
              {!rows.length ? (
                <EmptyState title="No projects yet" />
              ) : (
                rows.map((row) => (
                  <p key={row.id}>
                    {row.title} · {row.progress}% · {formatMoney(row.budget)}
                  </p>
                ))
              )}
            </Card>
          </>
        )}
      </QueryView>
      <QueryView query={transactions}>
        {(rows) => (
          <StatGrid>
            <StatCard
              label="Net payouts received"
              value={formatMoney(
                rows
                  .filter(
                    (row) =>
                      row.toId === actor.id &&
                      ['milestone-release', 'audit-release'].includes(row.type),
                  )
                  .reduce((sum, row) => sum + row.amount, 0),
              )}
            />
            <StatCard
              label="Refunds received"
              value={formatMoney(
                rows
                  .filter(
                    (row) => row.toId === actor.id && row.type === 'refund',
                  )
                  .reduce((sum, row) => sum + row.amount, 0),
              )}
            />
          </StatGrid>
        )}
      </QueryView>
    </>
  );
}
