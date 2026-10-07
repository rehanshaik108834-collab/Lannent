/**
 * Query keys. Every private key starts with the actor's id so that switching
 * accounts can never show another account's cached data (logout also clears
 * the cache). Mutations invalidate by these prefixes.
 */
export const keys = {
  projects: (actor: string, filters: object = {}) =>
    ['projects', actor, filters] as const,
  project: (actor: string, id: string) => ['project', actor, id] as const,
  escrow: (actor: string, id: string) => ['escrow', actor, id] as const,
  milestones: (actor: string, projectId: string) =>
    ['milestones', actor, projectId] as const,
  milestone: (actor: string, id: string) => ['milestone', actor, id] as const,
  proposals: (actor: string, filters: object = {}) =>
    ['proposals', actor, filters] as const,
  account: (actor: string) => ['account', actor] as const,
  directory: (actor: string, role: string) =>
    ['directory', actor, role] as const,
  transactions: (actor: string) => ['transactions', actor] as const,
  messages: (actor: string, filters: object = {}) =>
    ['messages', actor, filters] as const,
  audits: (actor: string, filters: object = {}) =>
    ['audits', actor, filters] as const,
  audit: (actor: string, id: string) => ['audit', actor, id] as const,
  auditPreview: (actor: string, id: string) =>
    ['auditPreview', actor, id] as const,
  reports: (actor: string, filters: object = {}) =>
    ['reports', actor, filters] as const,
  report: (actor: string, id: string) => ['report', actor, id] as const,
  disputes: (actor: string) => ['disputes', actor] as const,
  dispute: (actor: string, id: string) => ['dispute', actor, id] as const,
  applications: (actor: string) => ['applications', actor] as const,
};

/** Prefixes to refresh after a money-moving or workflow action commits. */
export const afterSettlement = [
  'projects',
  'project',
  'escrow',
  'milestones',
  'milestone',
  'proposals',
  'account',
  'transactions',
  'audits',
  'audit',
  'auditPreview',
  'reports',
  'disputes',
  'dispute',
];
