import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * W4 expert-flow pages: audits, reports, disputes, expert applications and
 * the expert dashboard. Kept apart from the marketplace (pages.tsx) and staff
 * (staff-pages.tsx) adapters so each wave's wiring can change independently.
 */
const named = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(async () => ({ default: (await load())[name] }));

const audits = () => import('../../features/audits/pages');
const disputes = () => import('../../features/disputes/DisputePages');
const reports = () => import('../../features/reports/ReportPages');
const applications = () => import('../../features/expert-applications/pages');
const expert = () => import('../../features/expert/ExpertDashboardPage');

const Messages = named(
  () => import('../../features/messages/MessagesPage'),
  'MessagesPage',
);
const ClientAuditOffers = named(audits, 'ClientAuditOffersPage');
const AuditRequests = named(audits, 'AuditRequestsPage');
const AuditPreview = named(audits, 'AuditPreviewPage');
const ReportAudit = named(audits, 'ReportAuditPage');
const RaiseDispute = named(disputes, 'RaiseDisputePage');
const DisputeDetail = named(disputes, 'DisputeDetailPage');
const ResolveDispute = named(disputes, 'ResolveDisputePage');
const ExpertDisputes = named(disputes, 'ExpertDisputesPage');
const ReportsList = named(reports, 'ReportsListPage');
const ReportView = named(reports, 'ReportViewPage');
const ExpertSignup = named(applications, 'ExpertSignupPage');
const Intake = named(applications, 'IntakePage');
const IntakeAlias = named(applications, 'IntakeAliasPage');
const ExpertDashboard = named(expert, 'ExpertDashboardPage');

const pages: Record<string, ComponentType> = {
  '/client/audit-offers': ClientAuditOffers,
  '/expert/dashboard': ExpertDashboard,
  '/expert/audit-requests': AuditRequests,
  '/expert/audit-preview/:id': AuditPreview,
  '/expert/report-audit/:id': ReportAudit,
  '/expert/disputes': ExpertDisputes,
  '/expert/report-dispute/:id': DisputeDetail,
  '/expert/reports': ReportsList,
  '/expert/messages': Messages,
  '/project/:projectId/milestones/:milestoneId/disputes/new': RaiseDispute,
  '/dispute/:id': DisputeDetail,
  '/dispute/:id/resolve': ResolveDispute,
  '/shared/reports': ReportsList,
  '/project/:id/milestone-reports': ReportsList,
  '/reports/:reportId': ReportView,
  '/reports/audits/:reportId': ReportView,
  '/admin/expert-applications': Intake,
  '/superuser/expert-applications': IntakeAlias,
  '/expert-signup': ExpertSignup,
};

export const expertPageFor = (path: string): ComponentType | undefined =>
  pages[path];
