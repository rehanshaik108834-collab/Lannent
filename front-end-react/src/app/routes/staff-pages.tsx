import { lazy } from 'react';
import type { ComponentType } from 'react';
const Profiles = lazy(() =>
  import('../../features/profiles/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);
const Analytics = lazy(() =>
  import('../../features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const Users = lazy(() =>
  import('../../features/administration/UsersPage').then((module) => ({
    default: module.UsersPage,
  })),
);
const Revenue = lazy(() =>
  import('../../features/administration/RevenuePages').then((module) => ({
    default: module.RevenuePage,
  })),
);
const Fees = lazy(() =>
  import('../../features/administration/RevenuePages').then((module) => ({
    default: module.FeesPage,
  })),
);
const Compliance = lazy(() =>
  import('../../features/administration/CompliancePage').then((module) => ({
    default: module.CompliancePage,
  })),
);
const operations = () =>
  import('../../features/administration/OperationsPages');
const Dashboard = lazy(() =>
  operations().then((module) => ({ default: module.OperationsDashboard })),
);
const Projects = lazy(() =>
  operations().then((module) => ({ default: module.OperationsProjects })),
);
const Escrow = lazy(() =>
  operations().then((module) => ({ default: module.EscrowPage })),
);
const Disputes = lazy(() =>
  operations().then((module) => ({ default: module.OperationsDisputes })),
);
const Create = lazy(() =>
  operations().then((module) => ({ default: module.CreateOnBehalfPage })),
);
const pages: Record<string, ComponentType> = {
  '/settings/profile': Profiles,
  '/settings/worker': Profiles,
  '/settings/expert': Profiles,
  '/settings/staff': Profiles,
  '/client/analytics': Analytics,
  '/worker/analytics': Analytics,
  '/analytics': Analytics,
  '/admin/revenue': Revenue,
  '/admin/analytics': Revenue,
  '/admin/fee-config': Fees,
  '/admin/compliance': Compliance,
  '/superuser/dashboard': Dashboard,
  '/superuser/users': Users,
  '/superuser/tasks': Projects,
  '/superuser/escrow': Escrow,
  '/superuser/disputes': Disputes,
  '/superuser/create-task': Create,
};
export const staffPageFor = (path: string) => pages[path];
