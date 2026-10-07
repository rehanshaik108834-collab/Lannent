import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../../features/auth/auth-context';
import type { AuthState } from '../../features/auth/auth-context';
import { fetchCurrentUser, loginWithPassword } from '../../features/auth/api';
import {
  clearSession,
  getToken,
  saveSession,
  SESSION_EXPIRED,
  TOKEN_KEY,
} from '../../shared/api/session';
import { isCurrentUser } from '../../shared/types/auth';
import { ApiError } from '../../shared/api/client';

const anonymous: AuthState = { status: 'anonymous', user: null, error: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: 'loading', user: null, error: null } : anonymous,
  );
  const generation = useRef(0);

  const logout = useCallback(() => {
    generation.current++;
    clearSession();
    queryClient.clear();
    setState(anonymous);
  }, [queryClient]);

  const restore = useCallback(async () => {
    const attempt = ++generation.current;
    const token = getToken();
    if (!token) {
      clearSession();
      queryClient.clear();
      setState(anonymous);
      return;
    }
    queryClient.clear();
    setState({ status: 'loading', user: null, error: null });
    try {
      const user = await fetchCurrentUser();
      if (attempt !== generation.current || token !== getToken()) return;
      saveSession(user, token);
      setState({ status: 'authenticated', user, error: null });
    } catch (error) {
      if (attempt !== generation.current || token !== getToken()) return;
      if (error instanceof ApiError && error.status === 401) logout();
      else
        setState({
          status: 'error',
          user: null,
          error:
            error instanceof Error
              ? error.message
              : 'Could not verify your session.',
        });
    }
  }, [logout, queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const attempt = ++generation.current;
      const result = await loginWithPassword(email, password);
      if (attempt !== generation.current)
        throw new ApiError(
          'This sign-in attempt was cancelled. Please try again.',
        );
      queryClient.clear();
      saveSession(result.user, result.token);
      setState({ status: 'authenticated', user: result.user, error: null });
      return result.user;
    },
    [queryClient],
  );

  const updateIdentity = useCallback((user: unknown) => {
    if (!isCurrentUser(user))
      throw new ApiError('Profile returned an invalid account.');
    setState((current) => {
      if (
        current.status !== 'authenticated' ||
        current.user?.id !== user.id ||
        current.user.role !== user.role
      )
        return current;
      saveSession(user, getToken());
      return { status: 'authenticated', user, error: null };
    });
  }, []);

  const invalidatePending = useCallback(() => {
    generation.current++;
  }, []);

  useEffect(() => {
    // Synchronize with persisted credentials; the server is the source of identity.
    // oxlint-disable-next-line react/set-state-in-effect
    void restore();
    const expired = (event: Event) => {
      if ((event as CustomEvent<string>).detail === getToken()) logout();
    };
    const changed = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) void restore();
    };
    window.addEventListener(SESSION_EXPIRED, expired);
    window.addEventListener('storage', changed);
    return () => {
      invalidatePending();
      window.removeEventListener(SESSION_EXPIRED, expired);
      window.removeEventListener('storage', changed);
    };
  }, [logout, restore, invalidatePending]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, updateIdentity, retry: restore }}
    >
      {children}
    </AuthContext.Provider>
  );
}
