import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * W4 browser journey against the real API, with client, worker and reviewer
 * in separate browsers: an audited project is negotiated, funded and accepted;
 * approval waits for the reviewer's exact-milestone report; a disputed
 * milestone is settled by the assigned reviewer's verdict.
 */
const title = `Audited checkout ${Date.now()}`;

async function signedIn(
  browser: Browser,
  email: string,
  password = 'Password@123',
): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Portal navigation' }),
  ).toBeVisible();
  return page;
}

const item = (page: Page, text: string) =>
  page.getByRole('listitem').filter({ hasText: text });

test('audited project: negotiate, fund, report-gated approval, dispute verdict', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const client = await signedIn(browser, 'client@gmail.com');
  const worker = await signedIn(browser, 'worker@gmail.com');
  const expert = await signedIn(browser, 'expert@gmail.com');

  // Client posts an audited project; it stays a draft.
  await client.goto('/client/post-task');
  await client.getByLabel('Title', { exact: true }).fill(title);
  await client
    .getByLabel('Description')
    .fill('Checkout rebuild with an expert review of each milestone.');
  await client.getByLabel('Budget (₹)', { exact: true }).fill('1000');
  await client.getByLabel('Milestone 1 title').fill('Design');
  await client.getByLabel('Milestone 1 budget (₹)').fill('600');
  await client.getByRole('button', { name: 'Add milestone' }).click();
  await client.getByLabel('Milestone 2 title').fill('Build');
  await client.getByLabel('Milestone 2 budget (₹)').fill('400');
  await client.getByLabel(/Have an Expert Reviewer audit/).check();
  await client
    .getByLabel('Reviewer', { exact: true })
    .selectOption({ label: 'Dr. Jane Smith — Full-Stack & Security' });
  await client.getByLabel('Opening offer (₹)').fill('300');
  await client.getByRole('button', { name: 'Publish project' }).click();
  await expect(
    client.getByRole('heading', { name: 'Project saved as a draft' }),
  ).toBeVisible();

  // Reviewer accepts the client's offer.
  await expert.goto('/expert/audit-requests');
  await item(expert, title).getByRole('link', { name: 'Open' }).click();
  const engagementUrl = expert.url();
  await expert.getByRole('button', { name: 'Accept ₹300.00' }).click();
  await expect(expert.getByText('Agreed fee: ₹300.00')).toBeVisible();

  // Client funds the agreed fee.
  await client.goto('/client/audit-offers');
  const offer = client.locator('section').filter({ hasText: title });
  await offer.getByRole('button', { name: 'Fund audit escrow' }).click();
  await offer.getByRole('button', { name: 'Confirm funding' }).click();
  await expect(client.getByRole('status')).toContainText(
    'Audit escrow funded.',
  );

  // Reviewer accepts the engagement; the project goes live.
  await expert.goto(engagementUrl);
  await expert.getByRole('button', { name: 'Accept engagement' }).click();
  await expert.getByRole('button', { name: 'Confirm accept' }).click();
  await expect(expert.getByRole('status')).toContainText(
    'Engagement accepted.',
  );

  // Worker proposes, client hires.
  await worker.goto('/worker/browse');
  await worker.getByLabel('Search').fill(title);
  await item(worker, title)
    .getByRole('link', { name: 'View and propose' })
    .click();
  await worker.getByLabel('Your bid (₹)').fill('1000');
  await worker.getByLabel('Timeline').fill('3 weeks');
  await worker
    .getByLabel('Cover letter')
    .fill('Experienced with audited payment projects.');
  await worker.getByRole('button', { name: 'Send proposal' }).click();
  await client.goto('/client/applications');
  const applications = client
    .locator('section')
    .filter({ has: client.getByRole('heading', { name: title }) });
  await applications.getByRole('button', { name: 'Hire' }).first().click();
  await applications.getByRole('button', { name: 'Confirm hire' }).click();
  await expect(client.getByRole('status')).toContainText('Escrow is funded.');

  // Worker delivers the first milestone.
  await worker.goto('/worker/projects');
  await item(worker, title).getByRole('link', { name: 'Workroom' }).click();
  const workroom = worker.url();
  await item(worker, 'Design')
    .getByRole('button', { name: 'Start work' })
    .click();
  await item(worker, 'Design')
    .getByRole('link', { name: 'Submit deliverable' })
    .click();
  await worker
    .getByLabel('What you delivered')
    .fill('Design system and checkout screens.');
  await worker.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    worker.getByRole('heading', { name: `${title}: milestones` }),
  ).toBeVisible();

  // Approval is refused until the reviewer reports on this exact milestone.
  await client.goto(workroom);
  await item(client, 'Design')
    .getByRole('link', { name: 'Review deliverable' })
    .click();
  const review = client.url();
  await client.getByRole('button', { name: 'Approve and pay' }).click();
  await client.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(client.getByRole('alert')).toContainText('report');

  await expert.goto('/expert/audit-requests');
  await item(expert, title)
    .getByRole('link', { name: 'File a report' })
    .click();
  await expert
    .getByLabel('Overall assessment')
    .fill('Clean, consistent design with complete states.');
  await expert.getByRole('button', { name: 'File report' }).click();
  await expect(expert.getByRole('status')).toContainText(
    '1 of 2 milestones now have a report',
  );

  await client.goto(review);
  await client.getByRole('button', { name: 'Approve and pay' }).click();
  await client.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(client.getByRole('status')).toContainText('paid to the worker');

  // The second milestone is disputed and the assigned reviewer decides it.
  await worker.goto(workroom);
  await item(worker, 'Build')
    .getByRole('button', { name: 'Start work' })
    .click();
  await item(worker, 'Build')
    .getByRole('link', { name: 'Submit deliverable' })
    .click();
  await worker
    .getByLabel('What you delivered')
    .fill('Checkout implementation and tests.');
  await worker.getByRole('button', { name: 'Submit for review' }).click();

  await client.goto(workroom);
  await item(client, 'Build')
    .getByRole('link', { name: 'Open dispute' })
    .click();
  await client
    .getByLabel('What went wrong')
    .fill('Coupons are ignored and tests are missing.');
  await client
    .getByLabel('Reviewer', { exact: true })
    .selectOption({ label: 'Dr. Jane Smith — Full-Stack & Security' });
  await client.getByRole('button', { name: 'Open dispute' }).click();
  await expect(
    client.getByText('Waiting for the reviewer’s verdict.', { exact: false }),
  ).toBeVisible();
  const disputeUrl = client.url();

  await expert.goto('/expert/disputes');
  await item(expert, 'Build')
    .getByRole('link', { name: 'Give verdict' })
    .click();
  await expert.getByRole('radio', { name: /In the worker’s favour/ }).check();
  await expert
    .getByLabel('Reasoning')
    .fill(
      'The delivered scope matches the milestone; coupons were out of scope.',
    );
  await expert.getByRole('button', { name: 'Record verdict' }).click();
  await expert.getByRole('button', { name: 'Confirm verdict' }).click();
  await expect(expert.getByRole('status')).toContainText('paid to the worker');

  await client.goto(disputeUrl);
  await expect(
    client.getByRole('heading', { name: /Verdict: In the worker’s favour/ }),
  ).toBeVisible();

  // W4 screens fit a phone and a desktop without horizontal scrolling.
  const screens: [Page, string, string][] = [
    [expert, '/expert/dashboard', 'expert-dashboard'],
    [expert, '/expert/audit-requests', 'audit-requests'],
    [expert, engagementUrl, 'audit-preview'],
    [client, '/client/audit-offers', 'audit-offers'],
    [client, disputeUrl, 'dispute'],
    [client, '/shared/reports', 'reports'],
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
        path: `test-results/w4-${name}-${width}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${name} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('public expert application page fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/expert-signup');
  await expect(
    page.getByRole('heading', { name: 'Apply as an Expert Reviewer' }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
