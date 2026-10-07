import { api, ApiError } from '../../shared/api/client';
import { legacyRoutes, legacyFile } from './legacy-map';
import type { Role } from '../../shared/types/auth';
const encoded = (id: string) => encodeURIComponent(id);
export function cachedMilestone(key: string): string | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    return value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string'
      ? value.id
      : undefined;
  } catch {
    return undefined;
  }
}
/** Only aliases for the same resource participate; contradictory aliases are unsafe. */
function resourceId(
  params: URLSearchParams,
  keys: string[],
): string | undefined {
  const values = [
    ...new Set(keys.flatMap((key) => params.getAll(key)).filter(Boolean)),
  ];
  if (values.length > 1)
    throw new ApiError(
      'This old link contains conflicting resource IDs. Open the item from your dashboard.',
      400,
    );
  return values[0];
}
export async function resolveLegacy(
  path: string,
  search: string,
  role: Role,
): Promise<string> {
  const file = legacyFile(path);
  const template = file ? legacyRoutes[file] : undefined;
  if (!file || !template || template === '*')
    throw new ApiError('This old page has no destination.', 404);
  const params = new URLSearchParams(search);
  if (file === 'milestone-reports.html')
    return params.get('taskId')
      ? `/project/${encoded(params.get('taskId')!)}/milestone-reports`
      : '/shared/reports';
  if (file === 'analytics.html')
    return role === 'worker' ? '/worker/analytics' : '/client/analytics';
  if (
    [
      'submit-deliverable.html',
      'review-deliverable.html',
      'dispute.html',
    ].includes(file)
  ) {
    const id =
      resourceId(params, ['milestoneId', 'id']) ||
      cachedMilestone(
        file === 'dispute.html'
          ? 'disputeTargetMilestone'
          : 'selectedMilestone',
      );
    if (!id)
      throw new ApiError(
        'Choose a milestone from the project workroom to continue.',
        400,
      );
    const milestone = await api.request<{ id: string; taskId: string }>(
      `/milestones/${encoded(id)}`,
    );
    if (params.get('taskId') && params.get('taskId') !== milestone.taskId)
      throw new ApiError(
        'The milestone does not belong to the requested project.',
        400,
      );
    const action =
      file === 'submit-deliverable.html'
        ? 'submit'
        : file === 'review-deliverable.html'
          ? 'review'
          : 'disputes/new';
    return `/project/${encoded(milestone.taskId)}/milestones/${encoded(milestone.id)}/${action}`;
  }
  if (file === 'expert-report-audit.html' && params.get('reportId')) {
    const id = params.get('reportId')!;
    await api.request(`/audit-reports/${encoded(id)}`);
    return `/reports/audits/${encoded(id)}`;
  }
  if (template.includes(':')) {
    const aliases =
      template.startsWith('/dispute/') ||
      template.startsWith('/expert/report-dispute/')
        ? ['id', 'disputeId']
        : template.startsWith('/expert/')
          ? ['id', 'auditRequestId']
          : ['id', 'taskId'];
    const id = resourceId(params, aliases);
    if (!id)
      throw new ApiError(
        'This old link is missing a resource ID. Open the item from your dashboard.',
        400,
      );
    let result = template.replace(':id', encoded(id));
    if (file === 'expert-report-audit.html' && params.get('milestoneId'))
      result += `?milestoneId=${encoded(params.get('milestoneId')!)}`;
    return result;
  }
  return template;
}
