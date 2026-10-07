# What's Left and What's Next

Date: 2026-10-07. Author: Claude. Scope: the React migration as it stands after W0–W6 and the page verification pass. Paths are relative to `40_Lannent/`.

## Where things stand

All six waves are implemented. Every page renders from React and is served by NestJS, the static app is archived under `legacy/front-end/`, and defects D01–D14 and D16 have corrections with regression tests. D15 is only partly done.

Evidence from the final combined run on 2026-10-07:

| Check | Result |
| --- | --- |
| Backend unit / HTTP (`npm test`, `npm run test:e2e` in `back-end/`) | 51 / 83 pass |
| Frontend unit, typecheck, lint (`front-end-react/`) | 65 pass; typecheck and lint clean |
| `npm run test:cutover` (built server, all 55 routes) | 20/20 |
| `npm run test:staff` | 3/3 |
| `npm run test:e2e` (Vite) | 19/20 (see item 2 below) |
| Backend `lint:check` / `format:check` | **Fail**: 1,372 errors and 134 warnings; 56 files unformatted |

Nothing has been committed. The working tree holds about 265 changed paths on top of commit `64ff265`.

## Left to finish the migration

The migration is not complete until these are done. Gate numbers refer to [testing and acceptance](07-testing-and-acceptance.md#completion-gates).

1. **Clean up backend lint and format debt (D15, gate 3).** `npm run lint:check` reports 1,372 errors, mostly `any` in older services, DTOs and tests. `npm run format:check` flags 56 files. Only `lint:foundation` passes. Fix it module by module, keep `lint:check` non-mutating, and don't disable rules to hide errors. Run the HTTP suite after each module, because the touched code includes settlement paths.
2. **Make `npm run test:e2e` pass out of the box (gate 3).** The default Playwright config runs every spec against the Vite dev server, including `tests/cutover.spec.ts`. Its CSP assertion at line 88 needs the built Nest server, so it fails under Vite and passes under `test:cutover`. Fix: add `testIgnore: 'cutover.spec.ts'` to `front-end-react/playwright.config.ts`. That file belongs to Codex; the change was proposed in `shared/claude-to-codex.md`.
3. **Document the verification fixes (gate 8).** These changed behavior or contracts after reports 15–17 were written, and the main docs don't describe them yet:
   - Declining a funded audit engagement whose fee hasn't been paid refunds the audit escrow to the client. This applies in `escrow-funded`, `in-progress` and `report-submitted` (`audit-requests.service.ts`, `decline`).
   - A project can have only one active project audit. A second request returns 409.
   - `clientId` is optional on `POST /audit-requests`; if sent, it must match the signed-in client.
   - A client can recover after a decline on a draft project: choose another reviewer with an opening offer, or cancel the draft (`ClientAuditOffersPage.tsx`).
   - Milestones under an open dispute show a notice and offer no actions. A second dispute on the same milestone is refused in the UI.
   - Re-filing an audit report starts from the existing report.

   Update [API and data contracts](05-api-and-data-contracts.md) (audit-requests row), [workflows](02-workflows-and-permissions.md) (decline recovery), and add a short verification section to report 15 or 17. Regression tests: `back-end/test/audit-recovery.e2e-spec.ts` and `front-end-react/src/features/milestones/verification-fixes.test.tsx`.
4. **Commit the work.** Split it into reviewable commits by wave: W1 auth, W2 backend authorization/money, D10–D12, W3, W4, W5, W6 cutover, verification fixes. Each PR should list its validation commands and results and include screenshots for UI changes (per `AGENTS.md`). Before committing, check that no `.env` file or secret is staged, and that build output (`dist/`, `test-results*`) is ignored.

## Small fixes

| Item | Where | Fix |
| --- | --- | --- |
| "1 events" pluralization | `front-end-react/src/features/administration/RevenuePages.tsx:116` and `:140` | Write "event" when the count is 1 |
| Frontend unit tests not in a CI pipeline | `front-end-react/package.json` | No CI config exists; add one that runs typecheck, lint, Vitest, backend unit/HTTP tests and `test:cutover` |
| `npm run lint` / `npm run format` in `back-end/` rewrite files | `back-end/package.json` | Point contributors to `lint:check` / `format:check` for verification (already noted in 07; repeat in onboarding) |

## Not yet verified

Gaps in the evidence so far, so nobody overclaims:

- **Keyboard navigation (A20).** The page crawl checked form labels, button names, duplicate IDs, page headings and layout at 390 px and 1280 px. It did not tab through each screen or check focus order, focus return after dialogs, or visible focus rings. Do one keyboard pass per screen family.
- **Browsers other than Chromium.** No Firefox or WebKit runs. Add them as Playwright projects if those browsers matter.
- **Visual match to Figma.** Screens follow the old layout but weren't compared pixel by pixel with `Figma Designs/`.
- **Restart behavior.** Data lives in memory, so a server restart reseeds everything. This is by design, but users of a demo deployment should be told.

## Deferred by decision (outside this migration)

These are recorded in [decisions and deferred features](09-decisions-and-deferred-features.md#deferred-work). Each needs an owner decision before work starts:

- Real database and restart durability (`Database/` SQL is a reference only)
- Real payment provider and bank payouts; deposits and withdrawals are simulated
- Email or SMS password recovery; the screen honestly says it's unavailable
- Self-service changes to email, password and role
- Multiple currencies (INR only today)
- Full UI redesign, realtime updates, background jobs
- Expert pay for partial work on early termination

## Suggested order

1. Codex's one-line Playwright config fix (item 2), so all three browser suites pass.
2. Documentation updates for the verification fixes (item 3).
3. Commit in wave-sized PRs (item 4). Do this early so the lint cleanup lands on a clean baseline.
4. Backend lint/format cleanup module by module (item 1), with the HTTP suite after each module.
5. Keyboard pass and the pluralization fix.
6. Pick the first deferred feature. Durable storage is the usual prerequisite for the payment and email work.

## Running the checks

```bash
# back-end/
npm test && npm run test:e2e        # unit + HTTP
npm run lint:check && npm run format:check
npm run build:all                   # React (same-origin /api) + Nest

# front-end-react/
npm run typecheck && npm run lint && npm test
npm run test:cutover                # all browser journeys against the built server (port 3103)
npm run test:staff                  # staff journeys (ports 3102/5175)
npm run test:e2e                    # Vite journeys (ports 3101/5174); see item 2
```

The suites use separate ports and output folders, but they share build output. Don't run two of them at the same time while anyone else is running browser tests.
