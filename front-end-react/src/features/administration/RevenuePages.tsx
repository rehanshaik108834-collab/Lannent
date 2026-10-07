import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { api } from '../../shared/api/client';
import { useStaffData, type FeeConfig, type Summary } from './api';
import {
  Card,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatCard,
  StatGrid,
  EmptyState,
} from '../../shared/ui/ui';
import { formatMoney } from '../../shared/format/format';
import styles from '../../shared/ui/page.module.css';
import { Link } from 'react-router-dom';
export function RevenuePage() {
  const actor = useActor();
  const config = useStaffData<FeeConfig>('/revenue/fee-config');
  const [selectedProject, setSelectedProject] = useState('');
  const people = useStaffData<
    {
      userId: string;
      name: string;
      grossEarned: number;
      feesPaid: number;
      netReceived: number;
    }[]
  >('/revenue/by-user');
  const distribution = useStaffData<{
    totalFunded: number;
    unaccounted: number;
    segments: { label: string; amount: number; share: number }[];
  }>('/revenue/distribution');
  const details = useStaffData<{
    project: { title: string };
    clientPaid: { total: number };
    worker: { netReceived: number };
    reviewerAudit: { netReceived: number };
    reviewerDispute: { netReceived: number };
    refundedToClient: number;
    stillHeld: { total: number };
    platformEarnings: { total: number };
  }>(`/revenue/project/${selectedProject}`, !!selectedProject);
  const summary = useStaffData<Summary>('/revenue/summary');
  const types = useStaffData<
    { feeType: string; total: number; count: number }[]
  >('/revenue/by-fee-type');
  const [period, setPeriod] = useState('month');
  const series = useStaffData<
    { period: string; revenue: number; events: number }[]
  >(`/revenue/timeseries?period=${period}`);
  const projects = useStaffData<
    {
      taskId: string;
      title: string;
      platformRevenue: number;
      escrowHeld: number;
    }[]
  >('/revenue/by-project');
  return (
    <>
      <PageHeader
        title="Revenue overview"
        subtitle="Recorded platform fees and funded projects, in INR."
        actions={
          actor.role === 'revenue-admin' ? (
            <Link to="/admin/fee-config">Fee configuration</Link>
          ) : undefined
        }
      />
      <QueryView query={summary}>
        {(value) => (
          <StatGrid>
            <StatCard
              label="Platform revenue"
              value={formatMoney(value.totalRevenue)}
            />
            <StatCard
              label="Gross payout volume"
              value={formatMoney(value.grossVolume)}
            />
            <StatCard label="Take rate" value={`${value.takeRate}%`} />
            <StatCard
              label="Escrow held"
              value={formatMoney(value.escrowHeld)}
            />
          </StatGrid>
        )}
      </QueryView>
      <QueryView query={config}>
        {(fees) => (
          <Card>
            <h2>Current fee rates</h2>
            <p>
              Client marketplace {fees.clientMarketplace.percent}% · Expert
              commission {fees.expertService.percent}% · Deposit{' '}
              {fees.deposit.percent}% + {formatMoney(fees.deposit.fixed)}
            </p>
          </Card>
        )}
      </QueryView>
      <Card>
        <h2>Revenue by fee type</h2>
        <QueryView query={types}>
          {(rows) =>
            !rows.length ? (
              <EmptyState title="No fee events yet" />
            ) : (
              rows.map((row) => (
                <p key={row.feeType}>
                  {row.feeType.replaceAll('-', ' ')} · {formatMoney(row.total)}{' '}
                  · {row.count} events
                </p>
              ))
            )
          }
        </QueryView>
      </Card>
      <Card>
        <h2>Revenue over time</h2>
        <Field id="period" label="Group by">
          <select
            id="period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </Field>
        <QueryView query={series}>
          {(rows) =>
            rows.map((row) => (
              <p key={row.period}>
                {row.period} · {formatMoney(row.revenue)} · {row.events} events
              </p>
            ))
          }
        </QueryView>
      </Card>
      <Card>
        <h2>Escrow distribution</h2>
        <QueryView query={distribution}>
          {(data) => (
            <>
              <p>
                Total funded {formatMoney(data.totalFunded)} · Unaccounted
                difference {formatMoney(data.unaccounted)}
              </p>
              {data.segments.map((row) => (
                <p key={row.label}>
                  {row.label}: {formatMoney(row.amount)} ({row.share}%)
                </p>
              ))}
            </>
          )}
        </QueryView>
      </Card>
      <Card>
        <h2>Per-account earnings and fees</h2>
        <QueryView query={people}>
          {(rows) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Gross earned</th>
                    <th>Fees paid</th>
                    <th>Net received</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.name}</td>
                      <td>{formatMoney(row.grossEarned)}</td>
                      <td>{formatMoney(row.feesPaid)}</td>
                      <td>{formatMoney(row.netReceived)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryView>
      </Card>
      {selectedProject && (
        <QueryView query={details}>
          {(data) => (
            <Card>
              <h2>{data.project.title}: cash flow</h2>
              <p>Client paid: {formatMoney(data.clientPaid.total)}</p>
              <p>Worker received: {formatMoney(data.worker.netReceived)}</p>
              <p>
                Reviewers received: technical audit{' '}
                {formatMoney(data.reviewerAudit.netReceived)} · dispute{' '}
                {formatMoney(data.reviewerDispute.netReceived)}
              </p>
              <p>
                Refunded: {formatMoney(data.refundedToClient)} · Held:{' '}
                {formatMoney(data.stillHeld.total)} · Platform earnings:{' '}
                {formatMoney(data.platformEarnings.total)}
              </p>
              <button onClick={() => setSelectedProject('')}>
                Close cash flow
              </button>
            </Card>
          )}
        </QueryView>
      )}
      <Card>
        <h2>Projects</h2>
        <QueryView query={projects}>
          {(rows) =>
            rows.map((row) => (
              <p key={row.taskId}>
                {row.title} · Revenue {formatMoney(row.platformRevenue)} · Held{' '}
                {formatMoney(row.escrowHeld)}{' '}
                <button onClick={() => setSelectedProject(row.taskId)}>
                  View cash flow
                </button>
              </p>
            ))
          }
        </QueryView>
      </Card>
    </>
  );
}
export function FeesPage() {
  const query = useStaffData<FeeConfig>('/revenue/fee-config');
  return (
    <>
      <PageHeader
        title="Fee configuration"
        subtitle="Changes apply to future charges. Historical fees remain unchanged."
      />
      <QueryView query={query}>
        {(config) => <FeeForm config={config} />}
      </QueryView>
    </>
  );
}
function FeeForm({ config }: { config: FeeConfig }) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: Record<string, number | number[]>) =>
      api.request<FeeConfig>('/revenue/fee-config', { method: 'PATCH', body }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  const fields = [
    ['depositPercent', 'Deposit processing (%)', config.deposit.percent],
    ['depositFixed', 'Deposit fixed fee (INR)', config.deposit.fixed],
    [
      'clientMarketplacePercent',
      'Client marketplace (%)',
      config.clientMarketplace.percent,
    ],
    [
      'expertServicePercent',
      'Expert commission (%)',
      config.expertService.percent,
    ],
    [
      'withdrawalPercent',
      'Withdrawal processing (%)',
      config.withdrawal.percent,
    ],
    ['withdrawalFixed', 'Withdrawal fixed fee (INR)', config.withdrawal.fixed],
  ] as const;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, number | number[]> = {};
    for (const [key] of fields) body[key] = Number(form.get(key));
    body.workerServicePercents = config.workerService.map((_, index) =>
      Number(form.get(`worker-${index}`)),
    );
    body.contractInitiationFees = config.contractInitiation.map((_, index) =>
      Number(form.get(`contract-${index}`)),
    );
    mutation.mutate(body);
  }
  return (
    <Card>
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.row}>
          {fields.map(([key, label, value]) => (
            <Field key={key} id={key} label={label}>
              <input
                id={key}
                name={key}
                type="number"
                min="0"
                max={key.endsWith('Percent') ? 100 : 1000}
                step="0.01"
                required
                defaultValue={value}
              />
            </Field>
          ))}
        </div>
        <h2>Worker service tiers</h2>
        {config.workerService.map((tier, index) => (
          <Field
            key={index}
            id={`worker-${index}`}
            label={`Tier ${index + 1}: ${tier.upTo ? `up to ${formatMoney(tier.upTo)}` : 'above the preceding tier'} (%)`}
          >
            <input
              id={`worker-${index}`}
              name={`worker-${index}`}
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={tier.percent}
            />
          </Field>
        ))}
        <h2>Contract initiation fees</h2>
        {config.contractInitiation.map((tier, index) => (
          <Field
            key={index}
            id={`contract-${index}`}
            label={`Band ${index + 1}: ${tier.upTo ? `up to ${formatMoney(tier.upTo)}` : 'above the preceding band'} (INR)`}
          >
            <input
              id={`contract-${index}`}
              name={`contract-${index}`}
              type="number"
              min="0"
              max="1000"
              step="0.01"
              required
              defaultValue={tier.fee}
            />
          </Field>
        ))}
        <Notice
          error={mutation.error}
          success={mutation.isSuccess ? 'Fee configuration saved.' : undefined}
        />
        <button disabled={mutation.isPending}>Save fee configuration</button>
      </form>
    </Card>
  );
}
