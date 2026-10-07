import { test, expect, type Page } from '@playwright/test';

/**
 * W3 browser journey against the real API: a client posts a project, a
 * worker proposes, the client hires, the worker delivers, the client approves
 * and the worker is paid. Each step signs in as the acting account.
 */
const title = `Checkout redesign ${Date.now()}`;

async function signIn(page: Page, email: string, password = 'Password@123') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Portal navigation' }),
  ).toBeVisible();
}

test('unaudited project: post, propose, hire, deliver, approve, get paid', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // Two people, two browsers, one sign-in each (sign-in is rate limited).
  const client = await (await browser.newContext()).newPage();
  const worker = await (await browser.newContext()).newPage();
  await signIn(client, 'client@gmail.com');
  await signIn(worker, 'worker@gmail.com');

  // Client posts a project with a milestone that adds up to the budget.
  await client.getByRole('link', { name: 'Post Task' }).click();
  await client.getByLabel('Title', { exact: true }).fill(title);
  await client
    .getByLabel('Description')
    .fill('Redesign the checkout flow end to end.');
  await client.getByLabel('Budget (₹)', { exact: true }).fill('1000');
  await client.getByLabel('Milestone 1 title').fill('Design');
  await client.getByLabel('Milestone 1 budget (₹)').fill('1000');
  await client.getByRole('button', { name: 'Publish project' }).click();
  await expect(client.getByRole('status')).toContainText(
    'Published with 1 milestone',
  );

  // Worker finds it and proposes.
  const workerBefore = await walletBalance(worker, '/worker/wallet');
  await worker.goto('/worker/browse');
  await worker.getByLabel('Search').fill(title);
  await worker
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link', { name: 'View and propose' })
    .click();
  await worker.getByLabel('Your bid (₹)').fill('1000');
  await worker.getByLabel('Timeline').fill('2 weeks');
  await worker
    .getByLabel('Cover letter')
    .fill('I have shipped several checkout redesigns.');
  await worker.getByRole('button', { name: 'Send proposal' }).click();
  await expect(
    worker.getByRole('heading', { name: 'Your proposal' }),
  ).toBeVisible();

  // Client hires, confirming the escrow charge.
  await client.goto('/client/applications');
  const section = client
    .locator('section')
    .filter({ has: client.getByRole('heading', { name: title }) });
  await section.getByRole('button', { name: 'Hire' }).first().click();
  await section.getByRole('button', { name: 'Confirm hire' }).click();
  await expect(client.getByRole('status')).toContainText('Escrow is funded.');

  // Worker starts and submits the milestone.
  await worker.goto('/worker/projects');
  await worker
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link', { name: 'Workroom' })
    .click();
  await worker.getByRole('button', { name: 'Start work' }).click();
  await worker.getByRole('link', { name: 'Submit deliverable' }).click();
  await worker
    .getByLabel('What you delivered')
    .fill('Figma file, prototype and design notes for checkout.');
  await worker.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    worker.getByRole('heading', { name: `${title}: milestones` }),
  ).toBeVisible();

  // Client reviews and approves; the worker is paid once.
  await client.goto('/client/projects');
  await client
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('link', { name: 'Workroom' })
    .click();
  await client.getByRole('link', { name: 'Review deliverable' }).click();
  await expect(
    client.getByText('Figma file, prototype and design notes for checkout.'),
  ).toBeVisible();
  await client.getByRole('button', { name: 'Approve and pay' }).click();
  await client.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(client.getByRole('status')).toContainText('paid to the worker');

  expect(await walletBalance(worker, '/worker/wallet')).toBeGreaterThan(
    workerBefore,
  );

  // The W3 screens fit a phone without horizontal scrolling (A20).
  const projectUrl = new URL(client.url()).pathname.split('/milestones/')[0];
  const screens: [Page, string, string][] = [
    [client, '/client/dashboard', 'client-dashboard'],
    [client, '/client/post-task', 'post-task'],
    [client, `${projectUrl}/workroom`, 'workroom'],
    [client, `${projectUrl}/milestone-board`, 'milestone-board'],
    [client, '/client/wallet', 'client-wallet'],
    [worker, '/worker/browse', 'browse'],
    [worker, '/shared/messages', 'messages'],
  ];
  for (const [page, path, name] of screens) {
    for (const [width, height] of [
      [390, 844],
      [1280, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.screenshot({
        path: `test-results/w3-${name}-${width}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${name} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

/** Reads the balance shown on the wallet page, in rupees. */
async function walletBalance(page: Page, path: string): Promise<number> {
  await page.goto(path);
  const text = await page
    .getByText('Available balance')
    .locator('..')
    .textContent();
  const amount = /₹([\d,]+\.\d{2})/.exec(text ?? '')?.[1];
  expect(amount).toBeTruthy();
  return Number(amount!.replace(/,/g, ''));
}
