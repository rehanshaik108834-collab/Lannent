# W2 Backend Structure

Date: 2026-10-06. Status: W2 structural implementation complete and verified. This report completes the three structural deliverables left open in [Claude's W2 report](11-w2-implementation.md). The [D10–D12 report](12-d10-d12-implementation.md) describes Claude's concurrent profile/intake work.

## What changed

### Typed records and actor boundary

Each repository now has explicit record, insert, update, collection, and nullable lookup types. New `<feature>.types.ts` files describe accounts/profiles, projects, milestones/deliverables, proposals, audits/reports, disputes, transactions, messages, notifications, applications, and files. Existing ledger and audit-event types remain in their repository files.

Seed arrays are checked against those records with type-only imports. Repositories clone typed fixtures with `structuredClone`, removing untyped JSON parsing. Seed amounts, dates, credentials, and identifiers are unchanged by this structural pass. Account fields include Claude's new per-role profile contract and application `accountId`.

The existing `@CurrentActor()` is retained. Its `role` now uses the central `Role` union, and its boundary rejects missing/malformed identities and unknown roles with 401. It preserves `{ id, role, email }`, strips unrelated fields, and reads identity established by middleware.

Typed internal records are not automatically public DTOs. Directory/account projections and ownership rules from the authorization work remain required. Some repositories retain mutable internal references for existing workflows; this refactor does not promise immutable repository reads or durable storage.

### Leaf storage and acyclic composition

Fourteen `<feature>.data.module.ts` modules each register and export their repository once. They import no workflow or HTTP modules. Service-only `.core.module.ts` files compose dependencies and export the existing service facades. HTTP modules retain their controllers, authentication exclusions, middleware, and role boundaries, while importing core modules instead of registering duplicate stores.

`TasksAccessService` contains shared project reads, visibility, draft publication, and trusted internal update rules. It depends only on project/audit data. Audit workflows now read milestone/dispute repositories directly, removing the audit → milestone/dispute → audit cycles. Milestones, proposals, disputes, reports, and files use lower-level queries/data rather than importing project HTTP workflows.

Feature modules/services no longer use `forwardRef` or `ModuleRef` service locators. The unit-of-work infrastructure still resolves participating repositories through Nest; this is deliberate and covered by singleton-store checks. Authentication imports user core/data without importing wallet HTTP workflows. Seed reset operates on repositories, then rebuilds ledger state and cleans stored files.

### Ledger operations

[`LedgerService`](../back-end/src/modules/ledger/ledger.service.ts) remains the public API. Its implementation delegates to:

| Class | Responsibility |
| --- | --- |
| [`WalletOperations`](../back-end/src/modules/ledger/wallet-operations.ts) | Deposits and withdrawals |
| [`EscrowFundingOperations`](../back-end/src/modules/ledger/escrow-funding-operations.ts) | Project and audit funding |
| [`PayoutOperations`](../back-end/src/modules/ledger/payout-operations.ts) | Milestone and expert payouts; idempotency |
| [`RefundOperations`](../back-end/src/modules/ledger/refund-operations.ts) | Project and audit escrow refunds |
| [`LedgerContext`](../back-end/src/modules/ledger/ledger-context.ts) | Shared stores, balance/escrow guards, atomic execution |

Existing paise calculations, fee defaults, response shapes, settlement decisions, and idempotency behavior are preserved. Every standalone facade money operation now snapshots account, transaction, and ledger stores; a write failure restores balances, escrow, fees, billings, counters, and payout markers. Higher-level workflows retain their surrounding unit of work so domain status/report writes roll back with money movement.

This guarantees consistency within one process. It does not add restart persistence, a database transaction, or multi-process coordination.

## Regression evidence

- [`module-architecture.spec.ts`](../back-end/src/module-architecture.spec.ts) rejects module cycles, HTTP dependencies in core modules, imports in leaf data modules, and duplicate repository registration. It verifies all fourteen stores are registered once in the real AppModule.
- [`ledger-atomic.spec.ts`](../back-end/src/modules/ledger/ledger-atomic.spec.ts) injects revenue/history write failures and verifies standalone deposit/payout rollback. A failed payout can subsequently succeed, and a repeated successful payout remains idempotent.
- [`current-actor.decorator.spec.ts`](../back-end/src/common/decorators/current-actor.decorator.spec.ts) covers all seven supported roles and malformed/unknown identities.
- Existing authorization, ledger conservation, audit/dispute, profile, file-access, and expert-approval cases remain in place. Settlement fixtures now satisfy record types; the progress-rollup failure spy follows the extracted access helper without changing the scenario or assertions.
- The expert-approval rollback test previously spied on a repository instance, causing `structuredClone` to fail before account creation. It now spies on the prototype and confirms that the account exists at the injected failure point, then verifies rollback and successful retry.

## Validation

The final backend build and TypeScript check passed. The complete unit suite passed **49/49 across eight suites**; the complete HTTP suite passed **46/46 across three suites**. Targeted ESLint checks passed for all new types/data/core modules, ledger operations/facade/context, task access, actor boundary, and new regression suites. Prettier checks passed for the structural files.

Existing Chromium authentication journeys passed **10/10** before Claude's W3 frontend edits. These verify W1 authentication against the W2 backend; they do not verify Claude's subsequent marketplace work.

Commands from `back-end/`:

```sh
npm run build
npm test -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
```

ESLint and Prettier checks cover the new types/data/core modules, task access helper, ledger facade/operations, actor boundary, and architecture/atomic tests. Whole-repository lint debt in existing services remains separate; no package-wide autofix was run. Expected injected-failure logs in HTTP tests are part of rollback verification.

## Contributor path and handoff

For a backend change, trace controller → core service/use case → policy/access helper → ledger or repository. Import a data module for a store and a core module for behavior; do not register the same repository again in an HTTP module. Use actor-aware methods at HTTP boundaries. Keep financial mutations inside the ledger facade and coupled domain writes inside the unit of work.

Claude retains W3 React marketplace work. The stable task-creation service/DTO is released to Claude for W3's atomic initial-milestone creation. That endpoint enhancement, React feature screens, termination flows, and production React cutover are outside this structural pass. Coordination and file ownership are recorded in the workspace's `shared/` folder, outside Git.
