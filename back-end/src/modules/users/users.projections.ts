import { canViewAnyRecord } from '../../common/guards/viewer.util';
import type { Actor } from '../../common/decorators/current-actor.decorator';

/**
 * What one account may see of another.
 *
 * Other people see a directory entry: enough to find, hire or pick a reviewer.
 * Email, phone, wallet balance and other private fields are visible only to the
 * account holder and to oversight roles. Password hashes are never returned.
 */
const DIRECTORY_FIELDS = [
  'id',
  'name',
  'role',
  'avatar',
  'avatarColor',
  'status',
  'joinDate',
  'company',
  'location',
  'skills',
  'rating',
  'completedProjects',
  'specialization',
  'reviewsDone',
  'domains',
  'hourlyRate',
  'bio',
  'companyDetails',
  'jobTitle',
  'experienceLevel',
  'availability',
  'languages',
  'portfolioProjects',
  'auditDomains',
] as const;

export function toDirectoryEntry(user: Record<string, unknown>) {
  const entry: Record<string, unknown> = {};
  for (const field of DIRECTORY_FIELDS) {
    if (field in user) entry[field] = user[field];
  }
  return entry;
}

/** The full account, minus credentials. */
export function toPrivateAccount(user: Record<string, unknown>) {
  const { password: _password, ...account } = user;
  return account;
}

/** Chooses the projection for this viewer. */
export function projectUserFor(user: Record<string, unknown>, viewer: Actor) {
  if (user.id === viewer.id || canViewAnyRecord(viewer.role))
    return toPrivateAccount(user);
  return toDirectoryEntry(user);
}
