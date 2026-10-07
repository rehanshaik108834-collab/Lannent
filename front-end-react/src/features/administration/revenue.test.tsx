import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { useAuth } from '../auth/auth-context';
import { FeesPage } from './RevenuePages';
import { clearSession, TOKEN_KEY } from '../../shared/api/session';
const fees = {
  deposit: { percent: 2.9, fixed: 0.3 },
  clientMarketplace: { percent: 5 },
  expertService: { percent: 10 },
  withdrawal: { percent: 0.25, fixed: 0.25, min: 0.25 },
  workerService: [
    { upTo: 500, percent: 20 },
    { upTo: 10000, percent: 10 },
    { upTo: null, percent: 5 },
  ],
  contractInitiation: [
    { upTo: 500, fee: 0.99 },
    { upTo: 2000, fee: 4.99 },
    { upTo: 10000, fee: 9.99 },
    { upTo: null, fee: 14.99 },
  ],
};
const response = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }));
function AuthorizedFees() {
  const auth = useAuth();
  return auth.user ? <FeesPage /> : null;
}
describe('Fee form behavior', () => {
  it('retains entered rates and shows no success after refusal', async () => {
    clearSession();
    localStorage.setItem(TOKEN_KEY, 'admin-token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async (_url: unknown, options?: RequestInit) =>
          options?.method === 'PATCH'
            ? new Response(JSON.stringify({ message: 'Rate change refused' }), {
                status: 400,
              })
            : String(_url).endsWith('/auth/me')
              ? response({
                  valid: true,
                  user: {
                    id: 'u11',
                    name: 'Revenue',
                    email: 'admin@example.test',
                    role: 'revenue-admin',
                    status: 'active',
                  },
                })
              : response(fees),
        ),
    );
    render(
      <MemoryRouter>
        <AppProviders>
          <AuthorizedFees />
        </AppProviders>
      </MemoryRouter>,
    );
    const input = await screen.findByLabelText('Deposit processing (%)');
    await userEvent.clear(input);
    await userEvent.type(input, '8');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save fee configuration' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Rate change refused',
    );
    expect(input).toHaveValue(8);
    expect(
      screen.queryByText('Fee configuration saved.'),
    ).not.toBeInTheDocument();
  });
});
