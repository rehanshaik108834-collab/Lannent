import { test, expect } from '@playwright/test';
async function signIn(
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
test('operations creates a project for a real client and cannot enter the revenue desk', async ({
  page,
}) => {
  await signIn(page, 'super', 'Superadmin@123');
  await page.goto('/superuser/create-task');
  await page.getByLabel('Client', { exact: true }).selectOption('u1');
  await page.getByLabel('Project title').fill('Staff-created project');
  await page.getByLabel('Project description').fill('A real delegated project');
  await page.getByLabel('Project budget (INR)').fill('200');
  await page.getByLabel('Milestone 1 title').fill('Deliver work');
  await page.getByLabel('Milestone 1 budget').fill('200');
  await page.getByRole('button', { name: 'Create project for client' }).click();
  await expect(
    page.getByText('Project created for the selected client.'),
  ).toBeVisible();
  await page.goto('/admin/revenue');
  await expect(
    page.getByRole('heading', { name: 'Access restricted' }),
  ).toBeVisible();
});
test('revenue saves a fee and compliance can inspect its audit trail', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin', 'Admin@123');
  await page.goto('/admin/fee-config');
  await page.getByLabel('Deposit processing (%)').fill('3.1');
  await page.getByRole('button', { name: 'Save fee configuration' }).click();
  await expect(page.getByText('Fee configuration saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Deposit processing (%)')).toHaveValue('3.1');
  const context = await browser.newContext();
  const compliance = await context.newPage();
  await signIn(compliance, 'compliance', 'Compliance@123');
  await compliance.goto('/admin/compliance');
  await compliance.getByLabel('Event kind').fill('fee.change');
  await expect(
    compliance.getByRole('cell', { name: 'fee.change', exact: true }),
  ).toBeVisible();
  await compliance.goto('/admin/fee-config');
  await expect(
    compliance.getByRole('heading', { name: 'Access restricted' }),
  ).toBeVisible();
  await context.close();
});
test('profile settings save, refresh, and update the signed-in name', async ({
  page,
}) => {
  await signIn(page, 'worker', 'Password@123');
  await page.goto('/settings/worker');
  await page.getByLabel('Display name').fill('Alex Updated');
  await page.getByLabel('Job title').fill('Frontend engineer');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  await expect(
    page.locator('header').getByText('Alex Updated', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Job title')).toHaveValue('Frontend engineer');
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
});
