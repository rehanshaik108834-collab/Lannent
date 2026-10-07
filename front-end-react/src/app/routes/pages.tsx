import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { NotFoundPage } from '../../features/public/PublicPages';
import { Loading } from '../../shared/ui/ui';
import { expertPageFor } from './expert-pages';
import { staffPageFor } from './staff-pages';

/**
 * Implemented portal pages, keyed by their path in `registry.ts`. Paths and
 * roles stay in the registry. Route coverage tests require an implementation
 * for every portal path. Pages load on demand.
 */
const named = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(async () => ({ default: (await load())[name] }));

const projects = () => import('../../features/projects/pages');
const proposals = () => import('../../features/proposals/pages');
const milestones = () => import('../../features/milestones/pages');
const wallets = () => import('../../features/wallets/WalletPage');
const messages = () => import('../../features/messages/MessagesPage');
const dashboards = () => import('../../features/dashboards/DashboardPages');

const PostTask = named(projects, 'PostTaskPage');
const MyProjects = named(projects, 'MyProjectsPage');
const Browse = named(projects, 'BrowseTasksPage');
const TaskDetails = named(projects, 'TaskDetailsPage');
const Applications = named(proposals, 'ApplicationsPage');
const MyProposals = named(proposals, 'MyProposalsPage');
const Invitations = named(proposals, 'InvitationsPage');
const HireWorkers = named(proposals, 'HireWorkersPage');
const Workroom = named(milestones, 'WorkroomPage');
const Board = named(milestones, 'MilestoneBoardPage');
const Submit = named(milestones, 'SubmitDeliverablePage');
const Review = named(milestones, 'ReviewDeliverablePage');
const SubmitAlias = named(milestones, 'SubmitAliasPage');
const ReviewAlias = named(milestones, 'ReviewAliasPage');
const Wallet = named(wallets, 'WalletPage');
const Messages = named(messages, 'MessagesPage');
const ClientDashboard = named(dashboards, 'ClientDashboardPage');
const WorkerDashboard = named(dashboards, 'WorkerDashboardPage');

const pages: Record<string, ComponentType> = {
  '/client/dashboard': ClientDashboard,
  '/client/projects': MyProjects,
  '/client/post-task': PostTask,
  '/client/hire': HireWorkers,
  '/client/applications': Applications,
  '/client/wallet': Wallet,
  '/worker/dashboard': WorkerDashboard,
  '/worker/browse': Browse,
  '/worker/projects': MyProjects,
  '/worker/invitations': Invitations,
  '/worker/proposals': MyProposals,
  '/worker/wallet': Wallet,
  '/shared/messages': Messages,
  '/tasks/:id': TaskDetails,
  '/project/:id/workroom': Workroom,
  '/project/:id/milestone-board': Board,
  '/project/:id/submit-deliverable': SubmitAlias,
  '/project/:id/review-deliverable': ReviewAlias,
  '/project/:projectId/milestones/:milestoneId/submit': Submit,
  '/project/:projectId/milestones/:milestoneId/review': Review,
};

/** Render a migrated route. Unknown paths receive the ordinary not-found screen. */
export function pageComponentFor(path: string): ComponentType | undefined {
  return pages[path] || expertPageFor(path) || staffPageFor(path);
}
export function pageFor(path: string): ReactNode {
  // Marketplace (W3) here; expert flow (W4) and staff screens (W5) in their own adapters.
  const Page = pageComponentFor(path);
  return Page ? (
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  ) : (
    <NotFoundPage />
  );
}
