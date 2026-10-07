import { describe, it, expect } from 'vitest';
import { dashboards, destination, portalRoutes } from './registry';
import { ROLES } from '../../shared/types/auth';
describe('route permissions', () => {
  it.each(ROLES)('provides an accessible dashboard for %s', (role) => {
    expect(
      portalRoutes.find((route) => route.path === dashboards[role])?.roles,
    ).toContain(role);
  });
  it('keeps staff duties separate', () => {
    expect(
      portalRoutes.find((route) => route.path === '/admin/fee-config')?.roles,
    ).toEqual(['revenue-admin']);
    expect(
      portalRoutes.find((route) => route.path === '/admin/expert-applications')
        ?.roles,
    ).not.toContain('superuser');
    expect(
      portalRoutes.find((route) => route.path === '/admin/compliance')?.roles,
    ).toEqual(['compliance-admin']);
  });
  it('permits authorized return paths and rejects external or privileged destinations', () => {
    expect(destination('worker', '/worker/browse?q=test#list')).toBe(
      '/worker/browse?q=test#list',
    );
    for (const path of [
      '//evil.test',
      '/\\evil.test',
      '/admin/fee-config',
      '/missing',
    ])
      expect(destination('client', path)).toBe('/client/dashboard');
  });
  it('has no duplicate paths', () =>
    expect(new Set(portalRoutes.map((route) => route.path)).size).toBe(
      portalRoutes.length,
    ));
});
