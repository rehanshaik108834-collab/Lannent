import { api, ApiError } from '../../shared/api/client';
import { isCurrentUser } from '../../shared/types/auth';
import type { CurrentUser, SignupRole } from '../../shared/types/auth';

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const result = await api.request<{ valid: boolean; user: unknown }>(
    '/auth/me',
  );
  if (!result || !result.valid || !isCurrentUser(result.user))
    throw new ApiError(
      'Your session is no longer valid. Please sign in again.',
      401,
    );
  return result.user;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ token: string; user: CurrentUser }> {
  const result = await api.request<{ token: unknown; user: unknown }>(
    '/auth/login',
    { method: 'POST', body: { email, password }, auth: false },
  );
  if (
    !result ||
    typeof result.token !== 'string' ||
    !result.token ||
    !isCurrentUser(result.user)
  ) {
    throw new ApiError('Login returned an invalid account. Please try again.');
  }
  return { token: result.token, user: result.user };
}

export function signup(input: {
  name: string;
  email: string;
  password: string;
  role: SignupRole;
}): Promise<CurrentUser> {
  return api.request('/users', { method: 'POST', body: input, auth: false });
}
