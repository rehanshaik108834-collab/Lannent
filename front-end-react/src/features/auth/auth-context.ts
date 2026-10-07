import { createContext, useContext } from 'react';
import type { CurrentUser } from '../../shared/types/auth';

export type AuthState = {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  user: CurrentUser | null;
  error: string | null;
};

export const AuthContext = createContext<
  | (AuthState & {
      login: (email: string, password: string) => Promise<CurrentUser>;
      logout: () => void;
      updateIdentity: (user: unknown) => void;
      retry: () => Promise<void>;
    })
  | null
>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
