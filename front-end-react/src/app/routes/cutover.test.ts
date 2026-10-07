import { describe, it, expect, vi } from 'vitest';
import { portalRoutes, destination } from './registry';
import { legacyRoutes } from './legacy-map';
import { resolveLegacy } from './legacy';
import { pageComponentFor } from './pages';

describe('Cutover route reconciliation', () => {
  it('implements every registry route and maps all 58 legacy screens', () => {
    expect(Object.keys(legacyRoutes)).toHaveLength(58);
    for (const route of portalRoutes)
      expect(pageComponentFor(route.path), route.path).toBeDefined();
  });
  it('retains authorized legacy links after sign-in without trusting role query parameters', () => {
    expect(
      destination('worker', '/pages/worker-my-projects.html?role=superuser'),
    ).toBe('/pages/worker-my-projects.html?role=superuser');
    expect(destination('worker', '/pages/admin-fee-config.html')).toBe(
      '/worker/dashboard',
    );
  });
  it('resolves milestone ownership through the API and rejects an inconsistent project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: { id: 'm6', taskId: 't2' },
            }),
          ),
      ),
    );
    expect(
      await resolveLegacy('/pages/review-deliverable.html', '?id=m6', 'client'),
    ).toBe('/project/t2/milestones/m6/review');
    await expect(
      resolveLegacy(
        '/pages/review-deliverable.html',
        '?id=m6&taskId=t1',
        'client',
      ),
    ).rejects.toThrow('does not belong');
  });
  it('keeps resource-specific aliases and rejects contradictory IDs', async () => {
    expect(
      await resolveLegacy(
        '/pages/expert-audit-preview.html',
        '?id=ar1&taskId=t2',
        'expert',
      ),
    ).toBe('/expert/audit-preview/ar1');
    expect(
      await resolveLegacy(
        '/pages/resolve-dispute.html',
        '?disputeId=d2&taskId=t2',
        'expert',
      ),
    ).toBe('/dispute/d2/resolve');
    await expect(
      resolveLegacy(
        '/pages/project-workroom.html',
        '?id=t1&taskId=t2',
        'client',
      ),
    ).rejects.toThrow('conflicting resource IDs');
    await expect(
      resolveLegacy(
        '/pages/review-deliverable.html',
        '?id=m6&milestoneId=m7',
        'client',
      ),
    ).rejects.toThrow('conflicting resource IDs');
  });
  it('requires an actual ID rather than choosing a cached first project', async () => {
    await expect(
      resolveLegacy('/pages/project-workroom.html', '', 'client'),
    ).rejects.toThrow('missing a resource ID');
    await expect(
      resolveLegacy('/pages/dispute.html', '', 'client'),
    ).rejects.toThrow('Choose a milestone');
  });
});
