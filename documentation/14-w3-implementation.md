# W3 Implementation Report

Date: 2026-10-06. Scope: W3, the marketplace vertical flow from the [migration roadmap](06-migration-roadmap.md): create a project, discover it, propose or invite, hire, collaborate in the workroom, deliver milestones, review, approve and pay, wallets, messages and dashboards. Builds on W1 ([10](10-w1-implementation.md)), W2 ([11](11-w2-implementation.md), [13](13-w2-structure.md)) and D10–D12 ([12](12-d10-d12-implementation.md)).

## Status

**The W3 exit criterion is met.** The unaudited create → hire → submit → approve → payout flow passes:
- end to end through the API (HTTP suite);
- in a real browser against a freshly started backend (Playwright).

Ownership and rollback cases are covered. Audited projects (expert review before approval) belong to W4. The screens show an honest note where that work is pending.

## React screens

Every W3 row of the [legacy screen mapping](06-migration-roadmap.md#legacy-screen-mapping) now renders a real page instead of the "not available yet" placeholder. Pages are registered in [`app/routes/pages.tsx`](../front-end-react/src/app/routes/pages.tsx) against the unchanged route registry and lazy-loaded.

| Route | Page | Who |
| --- | --- | --- |
| `/client/dashboard`, `/worker/dashboard` | Live counts and active projects; counts show "…" while loading and "—" on failure, never a fake zero | client / worker |
| `/client/post-task` | Project and milestones in one form (`useReducer`); milestone budgets must add up to the budget in whole paise before anything is sent | client |
| `/client/projects`, `/worker/projects` | Own projects; an unfunded open project can be deleted (nothing is refunded) | client / worker |
| `/worker/browse` | Open projects with search and category filter | worker |
| `/tasks/:id` | Project details and milestones; workers propose or withdraw here | all signed-in roles |
| `/client/applications` | Proposals on your open projects; hire with a two-step confirmation stating the escrow charge; reject | client |
| `/client/hire` | Worker directory (no private fields); invite to one of your open projects | client |
| `/worker/proposals`, `/worker/invitations` | Own proposals (withdraw); invitations (accept, which funds escrow from the client; decline) | worker |
| `/project/:id/workroom` | Status, budget, escrow held, progress, milestones with role actions, conversation with the other party | parties, engaged reviewer, oversight |
| `/project/:id/milestone-board` | Kanban by status (to do, in progress, in review, done); same cards and actions | as above |
| `/project/:projectId/milestones/:milestoneId/submit` | Assigned worker submits a description, link, branch and files (uploaded as chosen) | worker |
| `/project/:projectId/milestones/:milestoneId/review` | Deliverable with authorized downloads; client approves after confirmation, with the server's payout breakdown shown, or requests changes with a reason | client (decides); others read only |
| `/project/:id/submit-deliverable`, `/project/:id/review-deliverable` | Legacy aliases: honour `?milestoneId=`, otherwise list eligible milestones; never auto-select one | worker / client |
| `/client/wallet`, `/worker/wallet` | Balance, demo deposit and withdrawal with the server's fee breakdown, own history | client / worker |
| `/shared/messages` | Conversations grouped by project and person, including active projects not yet discussed | parties |

**Structure:** each feature has `api.ts` (wire adapters), `hooks.ts` (TanStack Query, with actor-prefixed keys) and its pages. Shared pieces live in `src/shared/`:
- `types/domain.ts`: API shapes.
- `format/format.ts`: INR and dates.
- `ui/`: page header, query states (loading, empty, forbidden, not found, network), status badge, stat cards, fields, two-step `ConfirmAction`.
- `api/keys.ts` and `api/invalidate.ts`: query keys and invalidation.

**Behaviour rules the code follows:**
- **No optimistic money or workflow changes.** Mutations refresh every affected view (projects, milestones, escrow, account, transactions) only after the server confirms.
- **Invalidation is fire-and-forget.** Awaiting it let a refetch unmount the component that started an action, which swallowed its confirmation (a hired project leaving the "open" list).
- **Roles control what's offered, not what's allowed.** Every rule is enforced by the server; the UI only avoids offering refused actions.
- **Exact routes.** Submit and review load the exact project and milestone named in the URL and refuse a mismatched pair rather than falling back to another record.

## Backend changes made for W3

| Change | Detail |
| --- | --- |
| Atomic project creation | `POST /tasks` accepts `milestones[]` (`title`, `description?`, `budget`, `dueDate?`). Budgets must add up exactly, in paise, to the project budget. Project, milestones and any audit engagement are created in one unit of work; any refusal (e.g. an invalid reviewer) leaves nothing behind. Response: the project plus `milestones`. |
| Escrow read scope | `GET /ledger/escrow/:taskId` now applies the project-visibility rule (parties, engaged reviewers, oversight). Previously any signed-in account could read any project's escrow. |
| Refused uploads | A signed-in upload refused by the attachment check (e.g. to someone else's project) now deletes the bytes multer already wrote, instead of leaving an unreachable file. |

## Evidence

| Check | Result |
| --- | --- |
| `back-end/test/marketplace.e2e-spec.ts` (new, 9) | Mismatched milestone budgets and an invalid reviewer create nothing. Only the owner hires, and the hire charges ₹1,054.99 for a ₹1,000 budget (5% marketplace + ₹4.99 initiation), funds escrow, assigns the worker and rejects the other proposals. An unaffordable hire rolls back completely. A non-assigned worker cannot submit. The first payout is ₹480 net (20% tier), and the second, after a revision with funds still held, is ₹360 (10% tier). The project completes, escrow reaches ₹0, a repeated approval pays nothing, and payouts appear in each party's own history. |
| `back-end/test/authorization.e2e-spec.ts` | Plus the escrow-scope regression (other client 403; owner and compliance 200). |
| Mutation check | Removing the unit of work from project creation makes the invalid-reviewer case fail. |
| `front-end-react/src/features/projects/PostTaskPage.test.tsx` (4) | Paise validation. Mismatched milestones never reach the server. One INR request carries the milestones. A server refusal keeps the form and shows the reason. |
| `front-end-react/src/features/milestones/marketplace.test.tsx` (7) | Approval requires confirmation and shows the server's net payout. A mismatched project/milestone pair is refused. 403 is shown as forbidden and 5xx as an outage, never as empty. Deposit shows the charged fee, and invalid amounts are not sent. Legacy alias lists eligible milestones without auto-selecting. |
| `front-end-react/tests/marketplace.spec.ts` (Playwright) | Client and worker in separate browsers: post → propose → hire → start → submit → review → approve, and the worker's balance increases. Seven W3 screens at 390px and 1280px have no horizontal overflow; screenshots are saved under `test-results/` and were inspected. |

Two defects were found and fixed by these checks:
- Duplicate "Title"/"Budget" labels between the project and its milestones (now "Milestone 1 title", …).
- The milestone board overflowing by 16px at 1280px wide (now auto-fit columns).

### Validation performed

From `back-end/`: `npx tsc --noEmit` clean, `npm run build` passed, `npx jest --runInBand` 8 suites / 49 tests passed, and `NODE_ENV=test npx jest --config ./test/jest-e2e.json --runInBand` 4 suites / 56 tests passed.

From `front-end-react/`: `npm run build` passed (typecheck included), `npm run lint` passed, `npm run format:check` passed, `npm test` 6 files / 44 tests passed, and `npm run test:e2e` 11 passed (Codex's 10 W1 journeys and the W3 journey).

The login route is rate limited (10 per minute). The browser journey signs each person in once, in separate browser contexts, so the full suite stays under the limit.

## Not in W3

These are deliberately left for later waves:
- **W4:** audited projects, disputes and reports, the expert screens, and the "Milestone Reports" pages.
- **W5:** analytics, settings and staff screens.
- **W6:** legacy `/pages/*.html` redirects and serving the React build from NestJS. Those routes still show the honest pending page.
- **Notifications:** still created by legacy pages and not shown in the React shell yet.
