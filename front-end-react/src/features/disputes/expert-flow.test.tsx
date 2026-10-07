import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { AppProviders } from '../../app/providers/AppProviders';

const accounts = {
  expert: {
    id: 'u3',
    name: 'Dr. Jane Smith',
    email: 'e@example.test',
    role: 'expert',
    status: 'active',
  },
  otherExpert: {
    id: 'u9',
    name: 'Priya Nair',
    email: 'p@example.test',
    role: 'expert',
    status: 'active',
  },
  client: {
    id: 'u1',
    name: 'James Client',
    email: 'c@example.test',
    role: 'client',
    status: 'active',
  },
  intake: {
    id: 'u12',
    name: 'Idris Bello',
    email: 'i@example.test',
    role: 'intake-admin',
    status: 'active',
  },
  compliance: {
    id: 'u13',
    name: 'Hana Vogel',
    email: 'h@example.test',
    role: 'compliance-admin',
    status: 'active',
  },
} as const;

const envelope = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status < 400
        ? { success: true, message: 'ok', data }
        : { success: false, message: data },
    ),
    { status, headers: { 'Content-Type': 'application/json' } },
  );

type Route = (url: string, init?: RequestInit) => Response | undefined;

function mount(as: keyof typeof accounts | null, path: string, route: Route) {
  if (as) localStorage.setItem('lannent_token', 'token');
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/auth/me'))
      return envelope({ valid: true, user: accounts[as ?? 'client'] });
    return route(url, init) ?? envelope([]);
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
  return fetcher;
}

const sent = (fetcher: ReturnType<typeof vi.fn>, suffix: string) =>
  fetcher.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith(suffix) && (init as RequestInit)?.method === 'POST',
  );

const dispute = {
  id: 'd9',
  taskId: 't1',
  milestoneId: 'm1',
  raisedBy: 'u1',
  againstId: 'u2',
  status: 'open',
  reason: 'The delivery is incomplete.',
  createdAt: '2026-10-01',
  expertId: 'u3',
  verdict: null,
  resolution: null,
  resolvedAt: null,
  project: 'Checkout',
  milestone: 'Design',
};

describe('dispute verdicts', () => {
  it('requires a verdict, reasoning and confirmation before anything is sent', async () => {
    const fetcher = mount('expert', '/dispute/d9/resolve', (url, init) => {
      if (url.endsWith('/disputes/d9/resolve') && init?.method === 'POST') {
        return envelope(
          {
            ...dispute,
            status: 'resolved',
            verdict: 'split',
            settlement: {
              kind: 'split',
              release: { net: 400, amount: 500, fee: 100 },
              refund: { amount: 500 },
            },
          },
          201,
        );
      }
      if (url.endsWith('/disputes/d9')) return envelope(dispute);
      return undefined;
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Record verdict' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a verdict');
    await userEvent.click(screen.getByRole('radio', { name: /Split/ }));
    await userEvent.type(
      screen.getByLabelText('Reasoning'),
      'Half of the milestone was delivered to standard.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Record verdict' }),
    );
    expect(screen.getByText(/A verdict is final/)).toBeInTheDocument();
    expect(sent(fetcher, '/resolve')).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm verdict' }),
    );
    expect(
      await screen.findByText(
        /₹400\.00 was paid to the worker and ₹500\.00 returned to the client/,
      ),
    ).toBeInTheDocument();
    expect(sent(fetcher, '/resolve')).toHaveLength(1);
  });

  it('refuses a reviewer who is not assigned to the dispute', async () => {
    mount('otherExpert', '/dispute/d9/resolve', (url) =>
      url.endsWith('/disputes/d9') ? envelope(dispute) : undefined,
    );
    expect(
      await screen.findByText(
        'Only the reviewer assigned to this dispute can give its verdict.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

describe('expert application', () => {
  it('rejects a weak password without sending the application', async () => {
    const fetcher = mount(null, '/expert-signup', () => undefined);
    await userEvent.type(await screen.findByLabelText('Full name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.test');
    await userEvent.type(
      screen.getByLabelText('Password', { exact: true }),
      'password',
    );
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password');
    await userEvent.type(
      screen.getByLabelText('Why do you want to review?'),
      'I have reviewed payment systems for ten years.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Submit application' }),
    );
    expect(screen.getByText(/Use 8\+ characters/)).toBeInTheDocument();
    expect(sent(fetcher, '/expert-applications')).toHaveLength(0);
  });

  it('submits a valid application with the chosen password', async () => {
    const fetcher = mount(null, '/expert-signup', (url, init) =>
      url.endsWith('/expert-applications') && init?.method === 'POST'
        ? envelope({ id: 'ea9', status: 'pending' }, 201)
        : undefined,
    );
    await userEvent.type(await screen.findByLabelText('Full name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.test');
    await userEvent.type(
      screen.getByLabelText('Password', { exact: true }),
      'Reviewer!2026',
    );
    await userEvent.type(
      screen.getByLabelText('Confirm password'),
      'Reviewer!2026',
    );
    await userEvent.type(
      screen.getByLabelText('Why do you want to review?'),
      'I have reviewed payment systems for ten years.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Submit application' }),
    );
    expect(await screen.findByText(/Application received/)).toBeInTheDocument();
    const body = JSON.parse(
      String((sent(fetcher, '/expert-applications')[0][1] as RequestInit).body),
    );
    expect(body).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.test',
      password: 'Reviewer!2026',
    });
    expect(body.confirm).toBeUndefined();
  });
});

describe('intake desk', () => {
  const pending = [
    {
      id: 'ea9',
      name: 'Asha Rao',
      email: 'asha@example.test',
      status: 'pending',
      appliedAt: '2026-10-01',
    },
  ];

  it('lets intake approve only after confirmation', async () => {
    const fetcher = mount(
      'intake',
      '/admin/expert-applications',
      (url, init) => {
        if (
          url.endsWith('/expert-applications/ea9/status') &&
          init?.method === 'PATCH'
        )
          return envelope({ ...pending[0], status: 'approved' });
        if (url.endsWith('/expert-applications')) return envelope(pending);
        return undefined;
      },
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Approve' }),
    );
    expect(
      fetcher.mock.calls.some(
        ([, init]) => (init as RequestInit)?.method === 'PATCH',
      ),
    ).toBe(false);
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm approval' }),
    );
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith('/status') &&
          (init as RequestInit)?.method === 'PATCH',
      ),
    ).toBe(true);
  });

  it('shows compliance a read-only view', async () => {
    mount('compliance', '/admin/expert-applications', (url) =>
      url.endsWith('/expert-applications') ? envelope(pending) : undefined,
    );
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Read-only oversight view.')).toBeInTheDocument();
  });
});

describe('ending a contract', () => {
  it('reports what the termination is waiting for', async () => {
    const project = {
      id: 't1',
      title: 'Checkout',
      description: 'x',
      category: 'Web Development',
      budget: 900,
      currency: 'INR',
      skills: [],
      clientId: 'u1',
      workerId: 'u2',
      status: 'in-progress',
      auditEnabled: false,
      progress: 33,
      createdAt: '2026-10-01',
    };
    const fetcher = mount('client', '/project/t1/workroom', (url, init) => {
      if (url.endsWith('/tasks/t1/termination') && init?.method === 'POST') {
        return envelope(
          {
            state: 'pending',
            blockingMilestoneIds: ['m2'],
            activeDisputeIds: [],
            task: project,
          },
          201,
        );
      }
      if (url.endsWith('/tasks/t1')) return envelope(project);
      if (url.includes('/ledger/escrow/t1'))
        return envelope({ projectHeld: 600, auditHeld: 0 });
      return undefined;
    });
    await userEvent.type(
      await screen.findByLabelText('Reason'),
      'The scope has changed completely.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'End contract' }));
    expect(sent(fetcher, '/termination')).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm ending the contract' }),
    );
    expect(
      await screen.findByText(
        /Waiting on 1 submitted milestone\(s\) and 0 open dispute\(s\)/,
      ),
    ).toBeInTheDocument();
  });
});
