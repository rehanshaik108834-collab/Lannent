import { Link } from 'react-router-dom';
import { useActor } from '../../shared/api/actor';
import { formatMoney } from '../../shared/format/format';
import {
  Card,
  EmptyState,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
  StatusBadge,
} from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { useEngagements } from '../audits/hooks';
import { useDisputes } from '../disputes/hooks';
import { useAccount } from '../wallets/hooks';

function count<T>(
  query: { data?: T[]; isError: boolean },
  predicate: (item: T) => boolean,
) {
  if (query.isError) return '—';
  return query.data ? query.data.filter(predicate).length : '…';
}

/** What needs the reviewer's attention: negotiations, funded work to accept, reports and verdicts. */
export function ExpertDashboardPage() {
  const actor = useActor();
  const account = useAccount();
  const engagements = useEngagements();
  const disputes = useDisputes();
  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name}`}
        actions={
          <Link className="button" to="/expert/audit-requests">
            Audit requests
          </Link>
        }
      />
      <StatGrid>
        <StatCard
          label="Earnings balance"
          value={
            account.data
              ? formatMoney(account.data.walletBalance)
              : account.isError
                ? '—'
                : '…'
          }
        />
        <StatCard
          label="Negotiating"
          value={count(engagements, (e) =>
            ['preview-sent', 'negotiating', 'agreed'].includes(e.status),
          )}
        />
        <StatCard
          label="Funded — ready to accept"
          value={count(engagements, (e) => e.status === 'escrow-funded')}
        />
        <StatCard
          label="Open dispute cases"
          value={count(
            disputes,
            (d) => d.expertId === actor.id && d.status !== 'resolved',
          )}
        />
      </StatGrid>
      <Card>
        <h2>Needs your attention</h2>
        <QueryView query={engagements}>
          {(list) => {
            const active = list.filter(
              (e) => !['paid', 'declined', 'cancelled'].includes(e.status),
            );
            return active.length === 0 ? (
              <EmptyState title="Nothing waiting on you" />
            ) : (
              <ul className={page.list}>
                {active.map((e) => (
                  <li key={e.id} className={page.itemHead}>
                    <Link to={`/expert/audit-preview/${e.id}`}>
                      {e.kind === 'dispute-audit'
                        ? 'Dispute review'
                        : 'Technical audit'}
                      : {e.project ?? 'Project'}
                    </Link>
                    <StatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            );
          }}
        </QueryView>
      </Card>
    </>
  );
}
