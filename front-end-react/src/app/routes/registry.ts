import { legacyFile, legacyRoutes } from './legacy-map';
import { matchPath } from 'react-router-dom';
import type { Role } from '../../shared/types/auth';
export interface PortalRoute {
  path: string;
  label: string;
  roles: readonly Role[];
  nav: boolean;
}
export const portalRoutes: PortalRoute[] = [
  {
    path: '/client/dashboard',
    label: 'Dashboard',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/projects',
    label: 'My Projects',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/post-task',
    label: 'Post Task',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/hire',
    label: 'Hire Gig Workers',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/applications',
    label: 'Applications',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/audit-offers',
    label: 'Audit Offers',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/client/wallet',
    label: 'Wallet',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/worker/dashboard',
    label: 'Dashboard',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/worker/browse',
    label: 'Browse Tasks',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/worker/projects',
    label: 'My Projects',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/worker/invitations',
    label: 'Invitations',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/worker/proposals',
    label: 'My Proposals',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/worker/wallet',
    label: 'Wallet',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/expert/dashboard',
    label: 'Dashboard',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/expert/audit-requests',
    label: 'Audit Requests',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/expert/audit-preview/:id',
    label: 'Audit Preview',
    roles: ['expert'],
    nav: false,
  },
  {
    path: '/expert/disputes',
    label: 'Dispute Cases',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/expert/reports',
    label: 'Reports',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/expert/report-audit/:id',
    label: 'Report Audit',
    roles: ['expert'],
    nav: false,
  },
  {
    path: '/expert/report-dispute/:id',
    label: 'Report Dispute',
    roles: ['expert'],
    nav: false,
  },
  {
    path: '/expert/messages',
    label: 'Messages',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/superuser/dashboard',
    label: 'Dashboard',
    roles: ['superuser'],
    nav: true,
  },
  {
    path: '/superuser/users',
    label: 'Users',
    roles: ['superuser'],
    nav: true,
  },
  {
    path: '/superuser/tasks',
    label: 'Tasks',
    roles: ['superuser'],
    nav: true,
  },
  {
    path: '/superuser/escrow',
    label: 'Escrow',
    roles: ['superuser'],
    nav: true,
  },
  {
    path: '/superuser/disputes',
    label: 'Disputes',
    roles: ['superuser'],
    nav: true,
  },
  {
    path: '/superuser/create-task',
    label: 'Create Task',
    roles: ['superuser'],
    nav: false,
  },
  {
    path: '/superuser/expert-applications',
    label: 'Expert Applications',
    roles: ['intake-admin', 'compliance-admin'],
    nav: false,
  },
  {
    path: '/admin/expert-applications',
    label: 'Expert Applications',
    roles: ['intake-admin', 'compliance-admin'],
    nav: true,
  },
  {
    path: '/admin/revenue',
    label: 'Revenue',
    roles: ['revenue-admin', 'compliance-admin'],
    nav: true,
  },
  {
    path: '/admin/fee-config',
    label: 'Fee Config',
    roles: ['revenue-admin'],
    nav: true,
  },
  {
    path: '/admin/compliance',
    label: 'Compliance Dashboard',
    roles: ['compliance-admin'],
    nav: true,
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    roles: ['revenue-admin', 'compliance-admin'],
    nav: true,
  },
  {
    path: '/shared/messages',
    label: 'Messages',
    // Experts use /expert/messages (same page); listing both duplicated the nav item.
    roles: [
      'client',
      'worker',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: true,
  },
  {
    path: '/shared/reports',
    label: 'Milestone Reports',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: true,
  },
  {
    path: '/project/:id/workroom',
    label: 'Project Workroom',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/project/:id/milestone-board',
    label: 'Milestone Board',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/project/:id/submit-deliverable',
    label: 'Submit Deliverable',
    roles: ['worker'],
    nav: false,
  },
  {
    path: '/project/:id/review-deliverable',
    label: 'Review Deliverable',
    roles: ['client'],
    nav: false,
  },
  {
    path: '/project/:id/milestone-reports',
    label: 'Milestone Reports',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/dispute/:id',
    label: 'Dispute Detail',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/dispute/:id/resolve',
    label: 'Resolve Dispute',
    // Only the assigned reviewer gives a verdict; operations has no verdict controls.
    roles: ['expert'],
    nav: false,
  },
  {
    path: '/tasks/:id',
    label: 'Task Details',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/analytics',
    label: 'Performance Analytics',
    roles: [
      'client',
      'worker',
      'expert',
      'superuser',
      'revenue-admin',
      'intake-admin',
      'compliance-admin',
    ],
    nav: false,
  },
  {
    path: '/settings/profile',
    label: 'Profile Settings',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/settings/worker',
    label: 'Settings',
    roles: ['worker'],
    nav: true,
  },
  {
    path: '/settings/expert',
    label: 'Settings',
    roles: ['expert'],
    nav: true,
  },
  {
    path: '/settings/staff',
    label: 'Staff Settings',
    roles: ['superuser', 'revenue-admin', 'intake-admin', 'compliance-admin'],
    nav: true,
  },
  {
    path: '/client/analytics',
    label: 'Analytics',
    roles: ['client'],
    nav: true,
  },
  {
    path: '/worker/analytics',
    label: 'Analytics',
    roles: ['worker'],
    nav: true,
  },
];
// These explicit resource paths are reserved for the later milestone/report pages.
portalRoutes.push(
  {
    path: '/project/:projectId/milestones/:milestoneId/submit',
    label: 'Submit deliverable',
    roles: ['worker'],
    nav: false,
  },
  {
    path: '/project/:projectId/milestones/:milestoneId/review',
    label: 'Review deliverable',
    roles: ['client', 'expert'],
    nav: false,
  },
  {
    path: '/project/:projectId/milestones/:milestoneId/disputes/new',
    label: 'Open dispute',
    roles: ['client', 'worker'],
    nav: false,
  },
  {
    path: '/reports/:reportId',
    label: 'View report',
    roles: ['client', 'worker', 'expert', 'superuser', 'compliance-admin'],
    nav: false,
  },
  {
    path: '/reports/audits/:reportId',
    label: 'View report',
    roles: ['client', 'worker', 'expert', 'superuser', 'compliance-admin'],
    nav: false,
  },
);

export const dashboards: Record<Role, string> = {
  client: '/client/dashboard',
  worker: '/worker/dashboard',
  expert: '/expert/dashboard',
  superuser: '/superuser/dashboard',
  'revenue-admin': '/admin/revenue',
  'intake-admin': '/admin/expert-applications',
  'compliance-admin': '/admin/compliance',
};
export function destination(role: Role, from?: string): string {
  if (from?.startsWith('/') && !from.startsWith('//') && !from.includes('\\')) {
    const pathname = from.split(/[?#]/)[0];
    const oldTemplate = legacyRoutes[legacyFile(pathname) ?? ''];
    if (
      oldTemplate &&
      portalRoutes.some(
        (route) => route.path === oldTemplate && route.roles.includes(role),
      )
    )
      return from;
    if (
      portalRoutes.some(
        (route) =>
          route.roles.includes(role) && matchPath(route.path, pathname),
      )
    )
      return from;
  }
  return dashboards[role];
}
