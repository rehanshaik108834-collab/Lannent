import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { AppProviders } from '../../app/providers/AppProviders';

/** Regressions for issues found in the page-verification pass. */

const accounts = {
  client: {
    id: 'u1',
    name: 'James Client',
    email: 'c@example.test',
    role: 'client',
    status: 'active',
  },
  worker: {
    id: 'u5',
    name: 'Sarah Johnson',
    email: 'w@example.test',
    role: 'worker',
    status: 'active',
  },
  expert: {
    id: 'u3',
    name: 'Dr. Jane Smith',
    email: 'e@example.test',
    role: 'expert',
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

function mount(
  as: keyof typeof accounts,
  path: string,
  route: (url: string) => Response | undefined,
) {
  localStorage.setItem('lannent_token', 'token');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/auth/me'))
        return envelope({ valid: true, user: accounts[as] });
      return route(url) ?? envelope([]);
    }),
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}

const project = {
  id: 't1',
  title: 'E-commerce',
  description: 'x',
  category: 'Web Development',
  budget: 2500,
  currency: 'INR',
  skills: [],
  clientId: 'u1',
  workerId: 'u5',
  status: 'in-progress',
  auditEnabled: false,
  progress: 50,
  createdAt: '2026-03-01',
};
// The milestone's own status was never flagged; only the dispute record knows.
const milestone = {
  id: 'm3',
  taskId: 't1',
  title: 'Backend Integration',
  description: '',
  budget: 500,
  status: 'in-progress',
  submittedAt: null,
  approvedAt: null,
  deliverable: null,
  workerId: 'u5',
  dueDate: null,
  priority: 'Medium',
  progress: 60,
};
const openDispute = {
  id: 'd1',
  taskId: 't1',
  milestoneId: 'm3',
  status: 'open',
  reason: 'Incomplete',
  createdAt: '2026-03-29',
  raisedBy: 'u1',
  againstId: 'u5',
  expertId: null,
  verdict: null,
  resolution: null,
  resolvedAt: null,
};

const projectApi = (url: string) => {
  if (url.endsWith('/tasks/t1')) return envelope(project);
  if (url.includes('/milestones?taskId=t1')) return envelope([milestone]);
  if (url.endsWith('/milestones/m3')) return envelope(milestone);
  if (url.endsWith('/disputes')) return envelope([openDispute]);
  if (url.includes('/ledger/escrow/t1'))
    return envelope({ projectHeld: 700, auditHeld: 0 });
  return undefined;
};

describe('verification fixes', () => {
  it('shows an open dispute on its milestone and offers no work on it', async () => {
    mount('worker', '/project/t1/workroom', projectApi);
    expect(await screen.findByText('Under dispute.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View the dispute' }),
    ).toHaveAttribute('href', '/dispute/d1');
    expect(
      screen.queryByRole('link', { name: 'Submit deliverable' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save progress' }),
    ).not.toBeInTheDocument();
  });

  it('does not offer a second dispute on a milestone already under dispute', async () => {
    mount('client', '/project/t1/milestones/m3/disputes/new', projectApi);
    expect(
      await screen.findByRole('heading', {
        name: 'Already under dispute',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('What went wrong')).not.toBeInTheDocument();
  });

  it('starts a re-filed report from the report already on file', async () => {
    const engagement = {
      id: 'ar1',
      kind: 'project-audit',
      taskId: 't1',
      clientId: 'u1',
      expertId: 'u3',
      status: 'in-progress',
      agreedAmount: 350,
      offers: [],
      auditedMilestoneIds: ['m3'],
      createdAt: '2026-03-25',
    };
    mount('expert', '/expert/report-audit/ar1', (url) => {
      if (url.endsWith('/audit-requests/ar1/preview')) {
        return envelope({
          auditRequest: engagement,
          kind: 'project-audit',
          project,
          client: null,
          worker: null,
          milestones: [milestone],
          focusMilestone: null,
          dispute: null,
          offers: [],
          agreedAmount: 350,
        });
      }
      if (url.includes('/audit-reports?auditRequestId=ar1')) {
        return envelope([
          {
            id: 'rep1',
            auditRequestId: 'ar1',
            taskId: 't1',
            expertId: 'u3',
            milestoneId: 'm3',
            createdAt: '2026-03-28',
            verdict: 'conditional',
            overall: 'Solid, two issues to fix.',
            security: 3,
          },
        ]);
      }
      return undefined;
    });
    expect(await screen.findByLabelText('Overall assessment')).toHaveValue(
      'Solid, two issues to fix.',
    );
    expect(screen.getByLabelText('Verdict')).toHaveValue('conditional');
    expect(screen.getByLabelText('Security (0–5)')).toHaveValue(3);
    expect(
      screen.getByRole('button', { name: 'Update report' }),
    ).toBeInTheDocument();
  });

  it('gives a page that failed to load a main heading', async () => {
    mount('worker', '/project/t9/workroom', (url) =>
      url.endsWith('/tasks/t9')
        ? envelope('You do not have access to this project.', 403)
        : undefined,
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You do not have access to this',
      }),
    ).toBeInTheDocument();
  });

  describe('declined audit recovery', () => {
    const draft = {
      ...project,
      id: 't7',
      title: 'Draft audit',
      status: 'draft',
      workerId: null,
      auditEnabled: true,
    };
    const declined = {
      id: 'ar7',
      kind: 'project-audit',
      taskId: 't7',
      clientId: 'u1',
      expertId: null,
      status: 'declined',
      agreedAmount: 200,
      offers: [],
      auditedMilestoneIds: [],
      createdAt: '2026-10-01',
      project: 'Draft audit',
    };
    const experts = [
      {
        id: 'u9',
        name: 'Priya Nair',
        role: 'expert',
        status: 'active',
        domains: ['Web Development'],
      },
    ];

    it('offers another reviewer or cancelling the draft', async () => {
      const calls: string[] = [];
      localStorage.setItem('lannent_token', 'token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url.endsWith('/auth/me'))
            return envelope({ valid: true, user: accounts.client });
          if (init?.method === 'POST') {
            calls.push(`${url} ${String(init.body)}`);
            return envelope(
              {
                ...declined,
                id: 'ar8',
                status: 'preview-sent',
                expertId: 'u9',
              },
              201,
            );
          }
          if (url.includes('/audit-requests')) return envelope([declined]);
          if (url.includes('/users?role=expert')) return envelope(experts);
          if (url.includes('/tasks')) return envelope([draft]);
          return envelope([]);
        }),
      );
      render(
        <MemoryRouter initialEntries={['/client/audit-offers']}>
          <AppProviders>
            <App />
          </AppProviders>
        </MemoryRouter>,
      );
      expect(
        await screen.findByRole('heading', { name: 'Choose another reviewer' }),
      ).toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText('Reviewer'), 'u9');
      await userEvent.type(screen.getByLabelText('Opening offer (₹)'), '150');
      await userEvent.click(
        screen.getByRole('button', { name: 'Send request' }),
      );
      expect(
        await screen.findByText('Request sent to the new reviewer.'),
      ).toBeInTheDocument();
      expect(calls[0]).toContain('/audit-requests');
      expect(JSON.parse(calls[0].slice(calls[0].indexOf(' ') + 1))).toEqual({
        taskId: 't7',
        expertId: 'u9',
        openingOffer: 150,
      });
    });

    it('does not offer recovery while another audit is under way', async () => {
      mount('client', '/client/audit-offers', (url) => {
        if (url.includes('/audit-requests')) {
          return envelope([
            declined,
            { ...declined, id: 'ar8', status: 'negotiating', expertId: 'u9' },
          ]);
        }
        if (url.includes('/users?role=expert')) return envelope(experts);
        if (url.includes('/tasks')) return envelope([draft]);
        return undefined;
      });
      expect(await screen.findAllByText(/Draft audit/)).not.toHaveLength(0);
      expect(
        screen.queryByRole('heading', { name: 'Choose another reviewer' }),
      ).not.toBeInTheDocument();
    });
  });
});
