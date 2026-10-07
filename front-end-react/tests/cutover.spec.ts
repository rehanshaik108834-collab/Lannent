import { test, expect } from '@playwright/test';
async function login(
  page: import('@playwright/test').Page,
  account: string,
  password: string,
) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${account}@gmail.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
test('built React preserves login, direct refresh, and legacy milestone identities', async ({
  page,
}) => {
  await page.goto('/pages/client-my-projects.html');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill('client@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('Password@123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/client/projects');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'My projects', exact: false }),
  ).toBeVisible();
  await page.goto('/pages/review-deliverable.html?id=m6');
  await expect(page).toHaveURL('/project/t2/milestones/m6/review');
  await expect(
    page.getByRole('heading', { name: 'Core UI Implementation', level: 1 }),
  ).toBeVisible();
  await page.goto('/pages/review-deliverable.html?id=m6&taskId=t1');
  await expect(
    page.getByText('The milestone does not belong to the requested project.'),
  ).toBeVisible();
});
test('serves every permitted screen family from the built server without missing lazy chunks', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'super', 'Superadmin@123');
  for (const path of [
    '/superuser/dashboard',
    '/superuser/users',
    '/superuser/tasks',
    '/superuser/disputes',
    '/superuser/escrow',
    '/settings/staff',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  }
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(
    page.getByRole('region', { name: 'Notifications' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close notifications' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/superuser/users');
  await expect(
    page.getByRole('heading', { name: 'Manage users', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: /loading/i }),
  ).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results-cutover/staff-mobile.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('keeps asset/API/Swagger boundaries and applies document CSP', async ({
  request,
  page,
}) => {
  const document = await request.get('/client/dashboard', {
    headers: { Accept: 'text/html' },
  });
  expect(document.status()).toBe(200);
  expect(document.headers()['content-security-policy']).toContain(
    "script-src 'self'",
  );
  const api = await request.get('/api/no-such-route', {
    headers: { Accept: 'text/html' },
  });
  expect(api.status()).toBe(404);
  expect(api.headers()['content-type']).toContain('application/json');
  const asset = await request.get('/assets/no-such.js', {
    headers: { Accept: 'text/html' },
  });
  expect(asset.status()).toBe(404);
  expect(await asset.text()).not.toContain('<div id="root">');
  await page.goto('/api-docs');
  await expect(
    page.getByRole('heading', { name: /Lannent API/, level: 1 }),
  ).toBeVisible();
  await page.goto('/pages/missing.html');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});

test('every canonical portal route mounts for an allowed seeded role', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { portalRoutes } = await import('../src/app/routes/registry');
  const accounts: Record<string, [string, string]> = {
    client: ['client', 'Password@123'],
    worker: ['worker', 'Password@123'],
    expert: ['expert', 'Password@123'],
    superuser: ['super', 'Superadmin@123'],
    'revenue-admin': ['admin', 'Admin@123'],
    'intake-admin': ['intake', 'Intake@123'],
    'compliance-admin': ['compliance', 'Compliance@123'],
  };
  for (const [role, [account, password]] of Object.entries(accounts)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, account, password);
    for (const route of portalRoutes.filter((row) => row.roles[0] === role)) {
      const projectId = role === 'worker' ? 't6' : 't2';
      const milestoneId = role === 'worker' ? 'm20' : 'm6';
      let path = route.path
        .replace(':projectId', projectId)
        .replace(':milestoneId', milestoneId)
        .replace(':reportId', 'rep2');
      if (path.includes(':id'))
        path = path.replace(
          ':id',
          path.startsWith('/expert/audit') ||
            path.startsWith('/expert/report-audit')
            ? 'ar1'
            : path.startsWith('/dispute') ||
                path.startsWith('/expert/report-dispute')
              ? role === 'expert'
                ? 'd2'
                : 'd1'
              : projectId,
        );
      await page.goto(path);
      await expect(
        page.getByRole('button', { name: 'Sign out' }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: /loading|checking|verifying/i }),
      ).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(
        page.getByRole('heading', { level: 1 }),
        route.path,
      ).toBeVisible();
      await expect(
        page.getByText(/under construction|not available in this version/),
      ).toHaveCount(0);
      expect(errors, route.path).toEqual([]);
    }
    await context.close();
  }
});
