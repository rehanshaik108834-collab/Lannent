import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { AppProviders } from '../../app/providers/AppProviders';
import { toPaise } from './PostTaskPage';

const client = {
  id: 'u1',
  name: 'James Client',
  email: 'client@example.test',
  role: 'client',
  status: 'active',
};

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, message: 'ok', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Signs in as a client and routes `/tasks` POSTs to `onCreate`. */
function mount(route: string, onCreate: (body: any) => Response = vi.fn()) {
  localStorage.setItem('lannent_token', 'token');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/me')) return ok({ valid: true, user: client });
      if (url.endsWith('/tasks') && init?.method === 'POST')
        return onCreate(JSON.parse(String(init.body)));
      return ok([]);
    }),
  );
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe('toPaise', () => {
  it('accepts rupees with up to two decimals and rejects the rest', () => {
    expect(toPaise('1000')).toBe(100000);
    expect(toPaise('0.1')).toBe(10);
    expect(toPaise('10.005')).toBeNull();
    expect(toPaise('-5')).toBeNull();
    expect(toPaise('0')).toBeNull();
    expect(toPaise('abc')).toBeNull();
  });
});

describe('post a task', () => {
  async function fill(budget: string, milestoneBudget: string) {
    await userEvent.type(
      await screen.findByLabelText('Title'),
      'Checkout redesign',
    );
    await userEvent.type(
      screen.getByLabelText('Description'),
      'Redesign the checkout end to end.',
    );
    await userEvent.type(screen.getByLabelText('Budget (₹)'), budget);
    await userEvent.type(screen.getByLabelText('Milestone 1 title'), 'Design');
    await userEvent.type(
      screen.getByLabelText('Milestone 1 budget (₹)'),
      milestoneBudget,
    );
  }

  it('refuses milestones that do not add up to the budget, without calling the server', async () => {
    const create = vi.fn();
    mount('/client/post-task', create);
    await fill('1000', '600');
    await userEvent.click(
      screen.getByRole('button', { name: 'Publish project' }),
    );
    expect(await screen.findByText(/less than the budget/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('sends the project with its milestones in one request, in INR', async () => {
    const create = vi.fn(
      (body: { title: string; milestones: unknown[] }): Response =>
        ok({ id: 't9', title: body.title, milestones: body.milestones }, 201),
    );
    mount('/client/post-task', create);
    await fill('1000', '1000');
    await userEvent.click(
      screen.getByRole('button', { name: 'Publish project' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Published with 1 milestone',
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      title: 'Checkout redesign',
      budget: 1000,
      currency: 'INR',
      milestones: [{ title: 'Design', budget: 1000 }],
    });
  });

  it('keeps the form and shows the server’s reason when publishing fails', async () => {
    mount(
      '/client/post-task',
      () =>
        new Response(
          JSON.stringify({
            success: false,
            message: 'Milestone budgets add up to ₹600.00',
          }),
          { status: 400 },
        ),
    );
    await fill('600', '600');
    await userEvent.click(
      screen.getByRole('button', { name: 'Publish project' }),
    );
    expect(
      await screen.findByText('Milestone budgets add up to ₹600.00'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Checkout redesign');
  });
});
