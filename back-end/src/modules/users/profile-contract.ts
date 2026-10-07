import { BadRequestException } from '@nestjs/common';

/**
 * Which profile fields each role may save, and where they are stored.
 *
 * Every field a settings screen offers is either persisted here and returned
 * on the next read, or rejected with an error naming it — never accepted and
 * silently dropped. Identity (email, role, password), status, balances and
 * reputation counters are not profile fields; see PROTECTED_PROFILE_FIELDS.
 */

/** Stored on the base account record for every role. */
export const BASE_PROFILE_FIELDS = [
  'name',
  'avatar',
  'avatarColor',
  'phone',
  'phoneCountryCode',
  'bio',
] as const;

/** Stored on the role's own profile record. */
export const ROLE_PROFILE_FIELDS: Record<string, readonly string[]> = {
  client: ['company', 'location', 'companyDetails'],
  worker: [
    'location',
    'skills',
    'jobTitle',
    'experienceLevel',
    'hourlyRate',
    'availability',
    'languages',
    'portfolioProjects',
  ],
  expert: [
    'location',
    'specialization',
    'hourlyRate',
    'availability',
    'auditDomains',
  ],
};

/** Audit-domain preference ids offered by the expert settings screen. */
export const AUDIT_DOMAIN_IDS = [
  'frontend',
  'backend',
  'mobile',
  'devops',
  'database',
  'security',
  'ai',
  'sysdesign',
] as const;

/** Counters the platform maintains; only internal services write them. */
export const INTERNAL_SUB_FIELDS = [
  'rating',
  'completedProjects',
  'reviewsDone',
  'domains',
] as const;

export function profileFieldsFor(role: string): string[] {
  return [...BASE_PROFILE_FIELDS, ...(ROLE_PROFILE_FIELDS[role] ?? [])];
}

/**
 * Rejects fields the role's profile does not have, and checks the one field
 * whose shape depends on the role (`availability`).
 */
export function assertProfileFieldsFor(
  role: string,
  changes: Record<string, unknown>,
): void {
  const allowed = profileFieldsFor(role);
  const unknown = Object.keys(changes).filter(
    (f) => changes[f] !== undefined && !allowed.includes(f),
  );
  if (unknown.length) {
    throw new BadRequestException(
      `Not part of a ${role} profile: ${unknown.join(', ')}. Nothing was saved.`,
    );
  }

  const availability = changes.availability;
  if (availability === undefined) return;
  if (
    role === 'worker' &&
    (typeof availability !== 'string' || availability.length > 40)
  ) {
    throw new BadRequestException(
      'Worker availability is a short text such as "Full-time".',
    );
  }
  if (role === 'expert') {
    const value = availability as Record<string, unknown> | null;
    const valid =
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ['status', 'maxCases', 'type'].every(
        (k) =>
          value[k] === undefined ||
          (typeof value[k] === 'string' && (value[k] as string).length <= 80),
      ) &&
      Object.keys(value).every((k) =>
        ['status', 'maxCases', 'type'].includes(k),
      );
    if (!valid) {
      throw new BadRequestException(
        'Expert availability is { status, maxCases, type } with short text values.',
      );
    }
  }
}
