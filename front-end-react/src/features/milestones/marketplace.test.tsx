import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { AppProviders } from '../../app/providers/AppProviders';

const users = {
  client: {
    id: 'u1',
    name: 'James Client',
    email: 'c@example.test',
    role: 'client',
    status: 'active',
  },
  worker: {
    id: 'u2',
    name: 'Alex Worker',
    email: 'w@example.test',
    role: 'worker',
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
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const project = {
  id: 't1',
  title: 'Checkout redesign',
  description: 'x',
  category: 'Web Development',
  budget: 1000,
  currency: 'INR',
  skills: [],
  clientId: 'u1',
  workerId: 'u2',
  status: 'in-progress',
  auditEnabled: false,
  progress: 0,
  createdAt: '2026-10-01',
};
const milestone = {
  id: 'm1',
  taskId: 't1',
  title: 'Design',
  description: '',
  budget: 600,
  status: 'submitted',
  submittedAt: '2026-10-05',
  approvedAt: null,
  workerId: 'u2',
  dueDate: null,
  priority: 'Medium',
  progress: 90,
  deliverable: {
    description: 'Figma file and notes.',
    link: 'https://example.com/design',
  },
};

type Route = (url: string, init?: RequestInit) => Response | undefined;

function mount(as: keyof typeof users, path: string, route: Route) {
  localStorage.setItem('lannent_token', 'token');
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/auth/me'))
      return envelope({ valid: true, user: users[as] });
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

describe('reviewing a deliverable', () => {
  it('approves only after confirmation and reports the server’s payout breakdown', async () => {
    const fetcher = mount(
      'client',
      '/project/t1/milestones/m1/review',
      (url, init) => {
        if (url.endsWith('/milestones/m1/approve') && init?.method === 'POST') {
          return envelope(
            {
              ...milestone,
              status: 'completed',
              release: {
                alreadyReleased: false,
                amount: 600,
                fee: 120,
                net: 480,
              },
            },
            201,
          );
        }
        if (url.endsWith('/tasks/t1')) return envelope(project);
        if (url.endsWith('/milestones/m1')) return envelope(milestone);
        return undefined;
      },
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Approve and pay' }),
    );
    const approveCalls = () =>
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/approve'));
    expect(approveCalls()).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm approval' }),
    );
    expect(
      await screen.findByText(/₹480\.00 paid to the worker/),
    ).toBeInTheDocument();
    expect(approveCalls()).toHaveLength(1);
  });

  it('refuses a milestone that belongs to a different project instead of showing it', async () => {
    mount('client', '/project/t2/milestones/m1/review', (url) => {
      if (url.endsWith('/tasks/t2')) return envelope({ ...project, id: 't2' });
      if (url.endsWith('/milestones/m1')) return envelope(milestone);
      return undefined;
    });
    expect(
      await screen.findByText(
        'That milestone does not belong to this project.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve and pay' }),
    ).not.toBeInTheDocument();
  });
});

describe('read failures', () => {
  it('shows a forbidden project as forbidden, not as empty', async () => {
    mount('worker', '/project/t1/workroom', (url) =>
      url.endsWith('/tasks/t1')
        ? envelope('You do not have access to this project.', 403)
        : undefined,
    );
    expect(
      await screen.findByRole('heading', {
        name: 'You do not have access to this',
      }),
    ).toBeInTheDocument();
  });

  it('shows an outage on a list instead of an empty state', async () => {
    mount('worker', '/worker/browse', (url) =>
      url.includes('/tasks') ? envelope('Server error', 500) : undefined,
    );
    // Server errors are retried once (AppProviders) before the error state shows.
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Something went wrong' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No open projects right now'),
    ).not.toBeInTheDocument();
  });
});

describe('wallet', () => {
  it('shows the fee the server charged and the new balance', async () => {
    mount('client', '/client/wallet', (url, init) => {
      if (url.endsWith('/users/u1/wallet/add') && init?.method === 'POST') {
        return envelope(
          { gross: 1000, fee: 29.3, net: 970.7, balance: 970.7 },
          201,
        );
      }
      if (url.endsWith('/users/u1'))
        return envelope({ ...users.client, walletBalance: 0 });
      return undefined;
    });
    await userEvent.type(
      await screen.findByLabelText('Amount (₹)', {
        selector: '#deposit-amount',
      }),
      '1000',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add funds' }));
    expect(
      await screen.findByText(/Added ₹970\.70 \(₹1,000\.00 less ₹29\.30 fee\)/),
    ).toBeInTheDocument();
  });

  it('validates the amount before sending anything', async () => {
    const fetcher = mount('client', '/client/wallet', (url) =>
      url.endsWith('/users/u1')
        ? envelope({ ...users.client, walletBalance: 0 })
        : undefined,
    );
    await userEvent.type(
      await screen.findByLabelText('Amount (₹)', {
        selector: '#withdraw-amount',
      }),
      '10.555',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      'Enter an amount in rupees',
    );
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes('/wallet/withdraw'),
      ),
    ).toBe(false);
  });
});

describe('legacy deliverable links', () => {
  it('lists eligible milestones instead of picking the first one', async () => {
    mount('client', '/project/t1/review-deliverable', (url) =>
      url.includes('/milestones?taskId=t1')
        ? envelope([
            milestone,
            { ...milestone, id: 'm2', title: 'Build', status: 'pending' },
          ])
        : undefined,
    );
    expect(await screen.findByRole('link', { name: 'Design' })).toHaveAttribute(
      'href',
      '/project/t1/milestones/m1/review',
    );
    expect(
      screen.queryByRole('link', { name: 'Build' }),
    ).not.toBeInTheDocument();
  });
});
