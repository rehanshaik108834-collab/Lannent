export const ROLES = [
  'client',
  'worker',
  'expert',
  'superuser',
  'revenue-admin',
  'intake-admin',
  'compliance-admin',
] as const;
export type Role = (typeof ROLES)[number];
export type SignupRole = 'client' | 'worker';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active';
  avatar?: string;
  avatarColor?: string;
}

/** Validate server identity at the boundary; cached session JSON never grants access. */
export function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    ROLES.includes(user.role as Role) &&
    user.status === 'active'
  );
}
