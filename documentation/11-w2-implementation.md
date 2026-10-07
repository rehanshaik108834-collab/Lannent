# W2 Implementation Report

Date: 2026-10-06. Scope: the W2 backend foundation from the [migration roadmap](06-migration-roadmap.md), covering defects D04–D09 and D16 from the [defect register](01-current-state-and-defects.md). D15 (shared HTTP configuration) was delivered during W1. This report states what is done and what W2 structural work is still outstanding.

## Status

**W2 exit criteria are met:**
- D04–D09/D15/D16 have regression tests.
- The existing ledger invariants still hold.
- No browser route writes balances or financial history.

**Three structural W2 deliverables are outstanding:**
- **Typed domain records:** repositories still return `any`.
- **Leaf data modules:** removing the `forwardRef` cycles between feature modules.
- **Ledger decomposition:** splitting `LedgerService` into wallet, escrow, payout and refund operations.

These are refactors with no intended behaviour change. They can proceed in parallel with W3.

## Delivered

### Shared building blocks

| File | Purpose |
| --- | --- |
| [`common/decorators/current-actor.decorator.ts`](../back-end/src/common/decorators/current-actor.decorator.ts) | `@CurrentActor()` supplies the verified token identity. Body/header identity fields are compared with it, never trusted. |
| [`common/unit-of-work/unit-of-work.ts`](../back-end/src/common/unit-of-work/unit-of-work.ts) | Synchronous in-memory transaction. Snapshots the participating repositories and restores all of them if any step throws. Notifications are sent after commit. |
| [`common/money/inr.ts`](../back-end/src/common/money/inr.ts) | INR in integer paise: conversion, exact percentages, the split rule (worker gets half rounded down), `₹` formatting. |
| [`common/policies/protected-fields.ts`](../back-end/src/common/policies/protected-fields.ts) | Generic PATCH routes reject a *changed* protected field and ignore one resent unchanged, because legacy forms resend whole records. |
| [`modules/ledger/settlement-stores.ts`](../back-end/src/modules/ledger/settlement-stores.ts) | The repositories every money movement may write to. |
| [`modules/users/users.projections.ts`](../back-end/src/modules/users/users.projections.ts) | Directory entry (others) versus private account (self and oversight). |

### Defects

| ID | Correction | Evidence |
| --- | --- | --- |
| D04 | Every mutation checks the actor against the record: <br>• Projects and milestones: the owning client. <br>• Submissions and work start: the assigned worker. <br>• Proposals: the worker authors; the project's client invites, rejects and hires. <br>• Invitations: only the invited worker accepts or declines. <br>• Audit offers, funding, acceptance and decline: the engagement's client or assigned reviewer; operations can no longer act for either. <br>• Disputes: raised by a project party. <br>• Verdicts and reports: the assigned reviewer. <br>• Messages: sent by a participant. <br>A body field that names a different actor is rejected. | `test/authorization.e2e-spec.ts` › D04; `milestone-settlement.spec.ts` › submission/approval/verdict authorization |
| D05 | Reads are filtered by viewer *before* query filters: transactions, notifications, messages, proposals, tasks (open projects stay discoverable), milestones, disputes, audit engagements and reports. `GET /users` returns directory entries without email or balance for other accounts. Oversight (superuser, compliance) keeps full reads. | `authorization.e2e-spec.ts` › D05 |
| D06 | `DELETE /tasks/:id` removes only open, unassigned projects that hold no money, and refunds nothing. Started or funded projects return 409. The legacy client and operations pages no longer deposit the budget into the client's wallet or post a fake refund row. | `authorization.e2e-spec.ts` › D06 |
| D07 | A profile update rejects balance, status, reputation and identity changes. `PATCH /users/:id/status` is the operations-only status route. `POST /users/:id/wallet/deduct` and `POST /transactions` are removed; only `LedgerService` writes balances and transaction rows. | `authorization.e2e-spec.ts` › D07 |
| D08 | Dispute verdicts, audit-report filing, approval, hiring, audit funding and draft cancellation run in a unit of work. An injected failure leaves balances, escrow, transactions, statuses, coverage and reports unchanged. | `unit-of-work.spec.ts`; `milestone-settlement.spec.ts` › rollback cases |
| D09 | Approval requires the `submitted`/`review` state, no open dispute, and (for audited projects) the exact milestone's report. Client-favour keeps funds for rework, worker-favour pays once, split gives the worker half rounded down and refunds the client the odd paisa. Repeated verdicts and approvals return the recorded result. `POST /milestones/:id/request-revision` sends work back with funds held. Verdict values are validated. | `milestone-settlement.spec.ts` |
| D16 | Fees, escrow, payouts and refunds are computed in paise, with `₹` in messages and transaction descriptions. Projects accept INR only and reject sub-paisa amounts. Seed data is labelled INR with unchanged numbers. The legacy post-task currency list offers INR only. | `inr.spec.ts`; `authorization.e2e-spec.ts` › D16; ledger fee tests |

Each regression suite was checked by removing the guard it covers and confirming that tests fail. That covers rollback, dispute freeze and task ownership.

### Contract changes for frontend work

| Interface | Change |
| --- | --- |
| `GET /users`, `GET /users/:id` | Other accounts: directory fields only (`id`, `name`, `role`, `avatar`, `avatarColor`, `status`, `joinDate`, `company`, `location`, `skills`, `rating`, `completedProjects`, `specialization`, `reviewsDone`, `domains`, `hourlyRate`) |
| `PATCH /users/:id` | Own profile (operations may edit others' profile fields); protected fields rejected if changed |
| `PATCH /users/:id/status` | New; superuser only; `{ status: 'active' \| 'suspended' }` |
| `POST /users/:id/wallet/deduct`, `POST /transactions` | Removed |
| `POST /tasks` | `clientId` optional (must match the actor); `currency` INR only |
| `PATCH /tasks/:id` | Owner only; `status`, `workerId`, `progress`, audit settings not editable; budget only before hiring |
| `DELETE /tasks/:id` | Only open, unassigned, unfunded projects; response `{ deleted, removedMilestones, refunded: 0 }` |
| `POST /proposals` | `workerId` optional for proposals (must match the actor); required for invitations. Worker display fields come from the account |
| `PATCH /proposals/:id` | Only `{ status: 'withdrawn' \| 'rejected' }`, by the role allowed to close it |
| `PATCH /milestones/:id` | Client: title/description/dueDate/priority (budget before hiring). Worker: start work and report progress 0–99 |
| `POST /milestones/:id/request-revision` | New; `{ reason }`; owning client |
| `POST /disputes` | `raisedBy`/`againstId` optional (derived); milestone must belong to the project and not be settled |
| `POST /disputes/:id/resolve`, `POST /audit-reports` | Assigned reviewer only; `expertId` optional (must match the actor) |
| Audit request offers/accept | `offeredBy` and `expertId` optional (derived from the actor) |
| `POST /notifications` | Unchanged for legacy pages; still to be removed at cutover |

### Legacy pages adjusted

The static frontend is still the running app until cutover, so only the calls the stricter API changes were updated:

- [`js/store.js`](../legacy/front-end/js/store.js): `deleteTask` reports the server's verdict and changes the cache only on success. Added `setUserStatus` and `requestRevision`.
- [`client-my-projects.html`](../legacy/front-end/pages/client-my-projects.html), [`superuser-tasks.html`](../legacy/front-end/pages/superuser-tasks.html): delete without refunding the budget, and show the server's refusal. The status field is removed from the project edit modal.
- [`superuser-users.html`](../legacy/front-end/pages/superuser-users.html): identity fields are read-only when editing; status changes use the status route.
- [`review-deliverable.html`](../legacy/front-end/pages/review-deliverable.html): "Request changes" calls `request-revision` instead of writing an invalid `todo` status.
- [`post-task.html`](../legacy/front-end/pages/post-task.html): INR is the only currency.

## Behaviour changes to know about

- Seed dispute `d1` has no assigned reviewer, so it cannot be resolved until operations assignment exists (W5).
- Superusers can no longer file audit reports, fund or accept audits, or create projects as a client. On-behalf project creation is the planned W5 endpoint; the legacy superuser create-task page already failed before this change.
- Legacy pages still update their local cache when a generic PATCH is refused. A refused edit can look successful until reload. Those pages are retired in W6.

## Validation performed

From `back-end/`, on Node 26.8.1:

```sh
npx tsc --noEmit -p tsconfig.json   # clean
npm run build                       # passed
npx jest --runInBand                # 5 suites, 43 tests passed
NODE_ENV=test npx jest --config ./test/jest-e2e.json --runInBand   # 2 suites, 29 tests passed
```

The React app was not rebuilt; it calls only `POST /users` and `/auth/*`, which are unchanged. The legacy pages changed in this wave were syntax-checked, but no browser walkthrough was done. `npm run lint` still reports problems; most predate this wave, from the codebase's existing `any`-typed style. New files are Prettier-formatted, and existing files were not reformatted wholesale.

## Next

- **W3:** the marketplace vertical flow (create → hire → submit → approve → payout) in React, against the contracts above.
- **W2 structural refactors**, in parallel with W3.
- **D10–D12** (profile persistence, intake file access, atomic expert approval).
