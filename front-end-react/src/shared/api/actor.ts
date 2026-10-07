import { useAuth } from '../../features/auth/auth-context';
import type { CurrentUser } from '../types/auth';

/**
 * The signed-in account for pages under ProtectedRoute. Private query keys
 * start with its id, so one account never sees another's cached data.
 */
export function useActor(): CurrentUser {
  const { user } = useAuth();
  if (!user) throw new Error('useActor is only available on signed-in pages.');
  return user;
}
