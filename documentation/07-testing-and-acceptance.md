# Testing and Acceptance

Status: migration acceptance specification. Reports 10–17 record executed wave checks; report 17 distinguishes functional cutover from remaining whole-backend lint debt and cross-browser/visual limits.

## Existing and planned tooling

The backend already uses Jest, Nest testing utilities, ts-jest, and Supertest. Unit files match `src/**/*.spec.ts`; HTTP files match `test/**/*.e2e-spec.ts`. Ledger tests are retained. Authentication unit regressions and a real HTTP authentication suite now replace the obsolete starter HTTP test.

The frontend uses [Vitest](https://vitest.dev/guide/) for utilities/hooks and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for user-facing behavior. Playwright covers browser journeys with isolated actor sessions. Avoid tests that only mirror component internals or snapshots of large HTML trees.

Shared backend API configuration now lives in `src/configure-api.ts`. Test instances must use the real prefix, validation pipe, response interceptor, exception filter, middleware/guards, and token behavior. Seed isolated disposable fixtures; do not depend on old calendar deadlines or previous test mutations.

## Acceptance scenarios

| ID | Scenario | Required result | Defects addressed |
| --- | --- | --- | --- |
| A01 | API base unset/configured, cross-origin session, multipart upload, missing file | Requests use the correct origin/proxy, permitted headers, decoded responses, and useful errors | D01, D02 |
| A02 | Login, refresh, logout, expiry, malformed storage, session without token, suspension/deletion | Protected routes wait for server identity; invalid credentials cannot restore access; private caches clear on logout/switch | D03 |
| A03 | Valid account substitutes another owner/worker/expert ID on each mutation | Server refuses unauthorized record/action; forged identity fields do not override actor | D04 |
| A04 | Collection reads omit filters or name another user/project | Actor sees only authorized records/projections; private fields never leak via directories | D05 |
| A05 | Delete an unfunded open project; delete/cancel a funded project | Zero refund for unfunded work; actual escrow refund through named cancellation; history retained | D06 |
| A06 | Patch wallet balance, status, role, reputation, or post fabricated transaction/notification | Protected self-service fields rejected; only dedicated authorized operations/internal writes succeed | D07 |
| A07 | Force a payout/account/repository failure midway through a workflow | All participating state, counters, coverage, balances, history, and status roll back | D08, D12 |
| A08 | Invalid status, premature approval, active dispute, wrong milestone report | Transition rejected without money/state changes; audit gate cannot be bypassed | D09 |
| A09 | Client-favour verdict followed by revision and resubmission | Escrow retained; work can be revised; valid client approval releases once | D09 |
| A10 | Worker-favour verdict followed by more project work or termination | Disputed milestone paid once; project continues or unused funds refunded after blockers | D09 |
| A11 | Split an odd-paise milestone; repeat same/different verdict | Worker receives half rounded down before fees; remaining gross refunded; same result replayed; changed verdict conflicts | D08, D09 |
| A12 | Terminate with unsubmitted work, submitted work, active dispute, or worker departure | New work blocked; pending work settles first; only unused project/audit escrow refunded; paid work preserved | D06, D08, D09 |
| A13 | Save every supported role profile field and reload; simulate request failure | Server persists values; session reflects server identity; no false success; identity remains read-only | D10 |
| A14 | Intake reads linked résumé/certificate and tries unrelated project file | Application documents available; unrelated files remain forbidden | D11 |
| A15 | Approve application with missing credentials, conflicting account, or creation failure | No shared fallback credential or approved-but-unusable account; atomic rollback | D12 |
| A16 | All seven roles open staff routes and invoke staff actions directly | Operations/revenue/intake/compliance responsibilities remain separate; expert verdicts require assignment | D13 |
| A17 | Submit password recovery screen | Honest unavailable state; no fabricated email delivery | D14 |
| A18 | INR display, fractional amounts, unsupported currency, fee-tier boundaries | INR-only validated inputs; consistent paise rounding; fee calculations preserve intended defaults | D16 |
| A19 | Legacy deep link, missing IDs, forged role parameter, unknown route, asset/API 404 | Authorized redirect or actionable error; no arbitrary fallback record; no HTML returned for API/asset failures | Migration parity |
| A20 | Navigate each screen family by keyboard and at narrow/desktop widths | Accessible labels/focus, stable layout, distinct loading/empty/error states, usable dialogs | Migration parity |
| A21 | Create → hire/invite → submit → approve → payout, audited and unaudited variants | Complete documented marketplace flow; notifications and query refresh reflect committed state | D04–D09 |
| A22 | Multi-milestone project audit, report re-file, revised work, termination before final report | Coverage keyed to exact milestone; expert paid once after completion; unpaid fee refunded on termination | D08, D09 |

Each defect correction needs its corresponding scenario implemented before the defect is marked fixed. Expand individual matrix rows into meaningful tests for the operation being changed rather than one superficial assertion per row.

## Financial invariants

- Wallet balances, project escrow, audit escrow, and revenue are nonnegative after valid operations.
- Relative to fixture opening state, net external deposits minus withdrawals equal the change in wallets plus escrow plus revenue.
- A release/refund cannot consume more than actual held funds or pay another project's worker.
- Project and audit funds remain distinct even when multiple engagements share a project.
- Hiring, approval, audit payout, verdict settlement, and termination replay cannot duplicate financial effects.
- Failed operations leave the full previous financial/workflow state unchanged.
- Fee changes do not rewrite historical charged fees or settled amounts. Boundary tests cover tier transitions and fractional values.

Use opening-state comparisons; demonstration fixtures may include historical funds and payouts. Do not assume every seeded balance arose from transactions created during a test.

## Running checks

Commands are from the named package directory. These existing backend commands are available now once dependencies are installed:

```sh
npm run build
npm test -- --runInBand
NODE_ENV=test npm run test:e2e
NODE_ENV=test npm run test:cov
npx eslint "{src,apps,libs,test}/**/*.ts"
```

Current frontend commands:

```sh
npm run build
npm run lint
```

These frontend scripts are implemented:

```sh
npm run typecheck       # tsc --noEmit
npm test                # vitest run
npm run test:watch      # vitest
npm run test:e2e        # playwright test
```

Non-mutating `lint:check`/`format:check` scripts now exist. Whole-backend checks still expose existing debt; `lint:foundation` and frontend lint pass. Today's backend `npm run lint` uses `--fix`, and `npm run format` rewrites files; do not use them as read-only verification commands. There is no existing numeric coverage threshold. Required behavior coverage and financial invariants are the release gate rather than an invented percentage.

## Completion gates

1. All 58 screen mappings have a tested implementation, authorized consolidation, redirect, or honest unavailable state.
2. Every open P0/P1 defect has a correction and passing regression evidence. No placeholder feature page remains.
3. Relevant builds, type checking, non-mutating lint/format checks, unit/HTTP tests, and browser journeys pass. Record failures honestly and resolve them before declaring migration complete.
4. Permission tests use multiple real actors, including nonparticipants and all staff roles; UI hiding alone never counts as a server check.
5. The served React build survives direct refresh; API/Swagger/file/asset routes are not swallowed by SPA fallback.
6. Supported settings persist, INR is consistent, and unavailable features do not claim success.
7. No runtime synchronous XHR, legacy Store/Auth globals, role-based impersonation, or browser ledger writes remain.
8. Documentation matches the implementation. A newcomer can run the app, trace one request, and add a small feature using the guides.

Keep browser/backend logs and request IDs for failing scenarios. Treat repeated 401/403 calls, unexpected notification failures, and failed rollback assertions as defects, not acceptable console noise.
