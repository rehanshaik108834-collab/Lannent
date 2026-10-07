import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/providers/AppProviders';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import {
  clearSession,
  TOKEN_KEY,
  SESSION_KEY,
  reportExpiredSession,
} from '../../shared/api/session';

const user = {
  id: 'u1',
  name: 'Real user',
  email: 'user@example.test',
  role: 'client',
  status: 'active',
};
const response = () =>
  new Response(JSON.stringify({ success: true, data: { valid: true, user } }));
function Probe() {
  const auth = useAuth();
  const cache = useQueryClient();
  return (
    <>
      <span>{auth.status}</span>
      <span>Cached records: {cache.getQueryCache().getAll().length}</span>
      <button onClick={() => cache.setQueryData(['private'], 'sensitive')}>
        Cache data
      </button>
      <span>{auth.user?.name}</span>
      <button onClick={auth.logout}>Logout</button>
      <button onClick={() => void auth.retry()}>Retry</button>
    </>
  );
}
const mount = () =>
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  );
beforeEach(() => clearSession());
describe('server-validated identity', () => {
  it('ignores forged display-only local storage', async () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: 'superuser', name: 'Forged' }),
    );
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mount();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('restores current account details from the server', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    mount();
    expect(await screen.findByText('Real user')).toBeInTheDocument();
    expect(screen.getByText('authenticated')).toBeInTheDocument();
  });
  it('clears rejected tokens and cached identity', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );
    mount();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
  it('keeps network failures retryable without granting access', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid');
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    mount();
    expect(await screen.findByText('error')).toBeInTheDocument();
    expect(screen.queryByText('Real user')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
  });
  it('does not resurrect a session after logout during validation', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid');
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    mount();
    await userEvent.click(screen.getByText('Logout'));
    await act(async () => finish(response()));
    expect(screen.getByText('anonymous')).toBeInTheDocument();
    expect(screen.queryByText('Real user')).not.toBeInTheDocument();
  });
  it('ignores stale expiry events and clears the current session on expiry', async () => {
    localStorage.setItem(TOKEN_KEY, 'current');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => response()),
    );
    mount();
    await screen.findByText('authenticated');
    act(() => reportExpiredSession('old'));
    expect(screen.getByText('authenticated')).toBeInTheDocument();
    act(() => reportExpiredSession('current'));
    await waitFor(() =>
      expect(screen.getByText('anonymous')).toBeInTheDocument(),
    );
  });
  it('clears private cache on logout', async () => {
    localStorage.setItem(TOKEN_KEY, 'current');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => response()),
    );
    mount();
    await screen.findByText('authenticated');
    await userEvent.click(screen.getByText('Cache data'));
    await userEvent.click(screen.getByText('Logout'));
    expect(screen.getByText('Cached records: 0')).toBeInTheDocument();
  });
  it('validates account switches from another tab', async () => {
    localStorage.setItem(TOKEN_KEY, 'first');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              valid: true,
              user: { ...user, id: 'u2', role: 'worker', name: 'Second user' },
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    mount();
    await screen.findByText('Real user');
    act(() => {
      localStorage.setItem(TOKEN_KEY, 'second');
      window.dispatchEvent(
        new StorageEvent('storage', { key: TOKEN_KEY, newValue: 'second' }),
      );
    });
    expect(await screen.findByText('Second user')).toBeInTheDocument();
    expect(screen.queryByText('Real user')).not.toBeInTheDocument();
  });
});
