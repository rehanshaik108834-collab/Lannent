import { test, expect } from '@playwright/test';

const accounts = [
  ['client', 'Password@123', '/client/dashboard'],
  ['worker', 'Password@123', '/worker/dashboard'],
  ['expert', 'Password@123', '/expert/dashboard'],
  ['super', 'Superadmin@123', '/superuser/dashboard'],
  ['admin', 'Admin@123', '/admin/revenue'],
  ['intake', 'Intake@123', '/admin/expert-applications'],
  ['compliance', 'Compliance@123', '/admin/compliance'],
];
for (const [account, password, dashboard] of accounts) {
  test(`${account} signs in, refreshes, and signs out`, async ({ page }) => {
    await page.goto('/login');
    await page
      .getByLabel('Email', { exact: true })
      .fill(`${account}@gmail.com`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(dashboard);
    await expect(
      page.getByRole('navigation', { name: 'Portal navigation' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    if (account === 'super') {
      await expect(
        page.getByRole('link', { name: 'Revenue', exact: true }),
      ).toHaveCount(0);
      await page.goto('/admin/fee-config');
      await expect(
        page.getByRole('heading', { name: 'Access restricted' }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Go to your dashboard' }).click();
    }
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await page.evaluate(() => localStorage.getItem('lannent_token')),
    ).toBeNull();
  });
}
test('creates a client account and reports honest recovery availability', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('New Contributor');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`contributor-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Password@123');
  await page.getByLabel('Confirm password').fill('Password@123');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveText(
    'Account created. Sign in to continue.',
  );
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(
    page.getByText('This page cannot send a reset link', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('ignores forged cached identity and preserves authorized deep links', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'lannent_session',
      JSON.stringify({ userId: 'u1', role: 'superuser' }),
    ),
  );
  await page.goto('/client/projects?view=active');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill('client@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('Password@123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/client/projects?view=active');
});
test('public pages fit mobile and show a useful not-found screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/landing-mobile.png',
    fullPage: true,
  });
  await page.goto('/login');
  await page.screenshot({
    path: 'test-results/login-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.screenshot({
    path: 'test-results/login-desktop.png',
    fullPage: true,
  });
  await page.goto('/does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});
