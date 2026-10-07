# Decisions and Deferred Features

Status: approved planning decisions recorded on 2026-10-06, plus explicit implementation defaults. This file records intent; it does not claim the application has been changed.

## Decisions confirmed by the project owner

| Decision | Agreed direction | Consequence |
| --- | --- | --- |
| Migration scope | Entire frontend becomes React; targeted backend corrections and modularization | Keep NestJS; extract workflow responsibilities instead of replacing the server stack |
| Storage | No durable database work | Keep seeded in-memory repositories; document restart limitations |
| Language | React TypeScript | Explicit API/domain types and type checks aid newcomers |
| Design | Preserve and clean up | Retain recognizable screens/flow; consolidate inconsistent controls and styles |
| Maintainability | Smaller modules, meaningful comments, naming conventions | Organize by domain and operation; explain authorization/side effects/failures |
| Staff roles | Separate operations, revenue, intake, and compliance duties | Superuser does not automatically gain every admin permission |
| Technical review | Require the exact milestone report before client approval when audit is enabled | Enforce on the server; report is advisory, client acceptance is decisive |
| Client-favour dispute | Worker reworks; funds remain held | Do not refund before revisions; cancellation refunds unused funds if work ends |
| Worker-favour dispute | Pay disputed milestone; remaining work continues | Client can request termination and recover unused funds after pending settlement |
| Termination | Settle submitted work/active disputes first | Block new work; preserve earned payments; return only actual remaining project escrow |
| Unpaid expert fee on termination | Refund unpaid audit funds | Accepted/partially reported engagements do not receive a new payout on early termination; already paid fees remain paid |
| Unsupported features | Honest unavailable states | Recovery must not falsely claim email delivery; defer external-service capabilities |
| Currency | Single currency, changed from the discussed USD default to **INR** | Remove unsupported currency choices and use INR consistently |
| Deliverable | Repository documentation containing the deep analysis and migration plan | This change creates documentation only; application implementation is subsequent work |

The project owner's written clarification overrides the earlier selected “refund and close” dispute option: client-favour means funded rework, not immediate refund. The final currency choice is INR, not USD.

## Implementation defaults adopted in the plan

These are concrete engineering choices, not additional product approvals:

- Keep the existing React/Vite project and stable role URLs; use feature folders and shared component/API infrastructure.
- Add TanStack Query for server state; use local React state for UI and a dedicated validated authentication provider. Do not introduce Redux or a second global entity store.
- Use CSS Modules and extracted existing tokens rather than a full design-system replacement.
- Preserve numeric demo balances, budgets, fixed fees, and tier thresholds as nominal INR values. No live FX conversion or economic fee repricing is specified. Preserve percentages and perform arithmetic in paise.
- Keep existing once-per-milestone technical audit coverage. Revised submissions do not automatically incur another expert charge; show report dates clearly.
- Preserve the existing half-worker/half-client split verdict. Give the client an odd remaining paise and charge worker fees only on the released worker share.
- Either party can request termination. Pending submitted/disputed work has no automatic timeout decision. Finalization is idempotent and reevaluated after blockers settle.
- Retain earned marketplace/initiation fees and settled payouts on termination; refund remaining project escrow and unpaid audit escrow.
- Keep meaningful existing profile/preference inputs; identity/credential changes are read-only/deferred in the migrated UI. Protect status/reputation/balance writes with separate authority.
- Keep public landing, shared login presentation, scoped directories, and legacy-link compatibility. A legacy unauthorized screen is consolidated/denied, not used to expand permissions.
- Use synchronous in-memory snapshot/rollback for coupled state changes, with post-commit notifications and explicit upload cleanup.
- Test behavior through Jest/Supertest, Vitest/React Testing Library, and Playwright. There is no invented percentage coverage gate.

If a future request changes one of these defaults, revise the related workflow, contract, roadmap, and acceptance scenarios together before implementing the new behavior.

## Deferred work

| Capability | Reason outside this migration | Required future decision |
| --- | --- | --- |
| Database/ORM and restart durability | Explicitly excluded by owner | Storage engine, migration, transactional/durability requirements |
| Multiple currencies/FX | INR-only chosen | Currency-specific balances/fees, conversions, historical accounting |
| Real payment processing or bank transfers | Existing deposits/withdrawals are demo operations | Provider, asynchronous confirmation/refund handling, reconciliation |
| Email/SMS password recovery | No delivery/recovery capability exists; owner chose truthful unavailable state | Delivery provider, recovery token and account security lifecycle |
| Email/password/role self-service changes | General profile updates must not alter identity | Dedicated authenticated flows and credential/token invalidation |
| Full UI redesign | Owner selected preserve-and-clean-up | New designs, interactions, and approval criteria |
| Microservices, durable jobs, or realtime infrastructure | Unnecessary for the agreed modular demo scope | Operational need and consistency/retry requirements |
| New expert fee policy on partial completion | Owner chose refund unpaid audit funds on termination | If changed, define partial-work compensation explicitly |

## Consistency checks for reviewers

Search touched code/docs for USD symbols/codes, arbitrary actor header use, raw balance PATCH fields, fake-success UI, and browser financial writes. Review each occurrence in context; a current-state description may correctly mention legacy USD behavior.

Do not call the migration complete because documents exist or pages render. Completion requires the behavior and verification gates in [testing and acceptance](07-testing-and-acceptance.md).
