# Codex: Next Steps and Remaining Work

Date: 2026-10-07. Scope: planning after W5/W6 and Claude’s subsequent verification pass. This document records follow-up work; creating it does not implement the listed changes.

## Current Position

W0–W5 and the functional W6 cutover are delivered. React is served by NestJS, all 55 portal routes have renderers, and all 58 legacy HTML screens have compatibility mappings. Marketplace, expert, staff, settings, analytics, and notifications are implemented. The static frontend is archived at `legacy/front-end/`.

Claude’s later verification also corrected declined-audit refunds/reviewer recovery, frozen-milestone actions, duplicate dispute creation, report re-filing, and page-level error headings. These are delivered fixes, not outstanding tasks.

| Latest recorded check | Result |
| --- | --- |
| Backend unit / HTTP tests | 51 / 83 passed, reported by Claude |
| Frontend unit/component tests | 65 passed, reported by Claude |
| Built-server browser suite | 20/20 passed, including canonical route inventory |
| Isolated staff browser suite | 3/3 passed |
| Default Vite browser suite | 19/20 passed; configuration mismatch below remains |
| Whole-backend strict lint/format | Remaining quality debt; clean combined gate not established |

These are recorded coordination checkpoints, not newly executed checks for this document. [W5 report](16-w5-implementation.md) and [W6 report](17-w6-cutover.md) retain earlier results; preserve their historical counts when adding newer evidence.

## Ordered Follow-up Work

### N01 — Fix Default Browser Test Selection

**Priority: first.** [playwright.config.ts](../front-end-react/playwright.config.ts) currently includes `tests/cutover.spec.ts` in its Vite run. Its document-CSP test expects NestJS’s served HTML headers; Vite supplies no such CSP header, causing `npm run test:e2e` to fail.

Exclude `cutover.spec.ts` from the default configuration, for example with `testIgnore: '**/cutover.spec.ts'`. Keep it in [playwright.cutover.config.ts](../front-end-react/playwright.cutover.config.ts), which tests the actual built server. Preserve the staff runner’s inherited selection.

**Done when:** default, staff, and cutover commands all pass independently. Keep the CSP assertion intact; do not add production headers to Vite merely to satisfy this test.

### N02 — Clear Backend Lint and Formatting Debt

**Priority: migration quality gate.** Run the existing read-only `lint:check` and `format:check` commands to capture the current failures. Earlier inspection found substantial legacy service/DTO/test typing and formatting debt; obtain fresh totals rather than treating historical counts as current.

Work in small, claimed batches. Replace unsafe `any` boundaries with existing record types, typed DTOs/projections, and explicit narrowing. Keep formatting-only edits separate from behavioral changes. Format exact claimed paths, without disabling lint rules or changing fee/settlement policies to obtain a passing run.

**Done when:** whole-backend lint/format checks pass, builds pass, and affected authorization, rollback, INR, settlement, and module-ownership regressions remain green. Passing `lint:foundation` alone does not close this task.

### N03 — Finish Small UI Copy Cleanup

**Priority: low.** [RevenuePages.tsx](../front-end-react/src/features/administration/RevenuePages.tsx) renders counts as “1 events.” Use singular/plural wording consistently in fee-type and time-bucket lists. Inspect zero, one, and multiple events; leave aggregation and money calculations unchanged.

### N04 — Record One Consolidated Verification Checkpoint

After N01/N02 and any agreed fixes, run the commands below against the same checkout, sequentially for browser tests. Record actual counts, failures, commands, and artifact locations in a new verification report; update the documentation index/current status links.

Retain coverage of declined-audit refunds, one active audit per project, reviewer replacement, frozen work, exact-milestone reports, termination, staff separation, and legacy resource-ID validation. Ensure newcomers can distinguish passing functional cutover from open release gates.

**Done when:** the required checks have a reproducible, passing result on the combined codebase. Do not silently replace older wave evidence or claim success based only on route rendering.

### N05 — Close Visual, Accessibility, and Onboarding Review

Existing checks covered permitted routes, mobile/desktop layouts, labels, headings, and key flows. Finish the remaining acceptance review: compare representative screens against the preserved designs; exercise keyboard navigation, focus handling, dialogs, loading/error/retry states, and supported settings persistence. Add Firefox/WebKit checks if those browsers are part of the supported release target; Chromium evidence alone does not establish that support.

Have a new contributor follow [onboarding](08-contributor-onboarding.md), run the cohosted app and Vite workflow, then trace one page → hook/API → controller → service → repository operation. Correct confusing current guidance while leaving historical reports identifiable. Preserve the existing workspace `AGENTS.md`.

### N06 — Prepare a Reviewable Handoff

Review the combined diff, including archived-file moves, configuration changes, and dependencies. Summarize behavior, tests, remaining limitations, and relevant screenshots. Coordinate ownership before preparing commits or a PR; no commit, push, or deployment has been performed by this documentation task.

## Verification Commands

From `back-end/`, after installing both packages:

```sh
npm run build:all
npm test -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
npm run lint:check
npm run format:check
npm run lint:foundation
```

From `front-end-react/`:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run test:staff
npm run test:cutover
```

Install Chromium first if needed. Coordinate browser runs through workspace `shared/`; do not overlap runs or rebuild bundles they are using. Use each runner’s assigned ports/output folder. `build:all` pins the cohosted frontend API to `/api` and preserves local `.env` files.

## Deferred Product Work

The following remain outside the agreed migration scope, as recorded in [decisions](09-decisions-and-deferred-features.md):

| Future capability | Decision required before implementation |
| --- | --- |
| Durable database/storage | Engine, schema/migrations, transaction and restart guarantees |
| Real payments/bank transfers | Provider, asynchronous confirmations, refunds, reconciliation |
| Password recovery via email/SMS | Delivery provider, recovery tokens, expiry and account lifecycle |
| Self-service identity/credential changes | Dedicated authenticated flows and token invalidation |
| Multiple currencies | Currency-specific accounting, fees, conversion and history |
| Full redesign/realtime/jobs | Approved product need, designs and operational requirements |

Keep in-memory restart behavior, demo payment operations, and honest recovery unavailability documented. These exclusions are not permission to start new integrations. Deployment readiness depends on the intended demo/production scope and configuration; external integrations require a separate plan.

## Execution Order and Coordination

Start N01, then N02; N03 can proceed independently once its file is claimed. Finish N04/N05 before the N06 handoff. Read Claude’s claims/outbox before editing, announce shared-file changes, and release ownership with evidence. New behavior changes must update the related workflow, contract, and regression scenario together.
