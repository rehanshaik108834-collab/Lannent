import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import App from '../../app/App';
import { AppProviders } from '../../app/providers/AppProviders';

const mount = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
describe('public authentication forms', () => {
  it('rejects mismatched passwords before creating an account', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mount('/signup');
    await userEvent.type(screen.getByLabelText('Full name'), 'Contributor');
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.test');
    await userEvent.type(
      screen.getByLabelText('Password', { exact: true }),
      'Password@123',
    );
    await userEvent.type(
      screen.getByLabelText('Confirm password'),
      'Different@123',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Passwords do not match',
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['client', 'worker']);
  });
  it('preserves entered credentials and reports login errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Incorrect password' }), {
          status: 400,
        }),
      ),
    );
    mount('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'client@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect password',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('client@example.test');
    expect(screen.getByRole('button', { name: /^Sign in$/ })).toBeEnabled();
  });
  it('recovery has no fake email form or recovery request', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mount('/forgot-password');
    expect(screen.getByText(/cannot send a reset link/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
