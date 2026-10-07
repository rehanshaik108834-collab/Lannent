# Current State and Defect Register

Status: original source-analysis baseline, 2026-10-06; observations below describe the pre-migration code. W1 addresses D01–D03/D14; W2 addresses D04–D09/D16 and module structure; profile/intake work addresses D10–D12. W3/W4 implement marketplace/expert workflows, and W5 supplies the D13 operations use case and supporting screens. W6 serves React and archives the static app. See implementation reports 10–17 for corrections and evidence. D15's whole-backend strict lint/format debt remains open; deferred external integrations are explicit.

Links to replaced frontend files now point to their W1 successors; baseline observations are preserved in Git commit `64ff265`.

## Architecture at baseline

The backend serves the static frontend from [main.ts](../back-end/src/main.ts), exposes JSON endpoints under `/api`, and mounts Swagger at `/api-docs`. Repositories hold seeded arrays and maps in process memory. Upload bytes are stored on disk while file metadata remains in memory.

The legacy frontend mixes templates, inline styles, event handlers, API calls, notifications, and business rules. Its [store.js](../legacy/front-end/js/store.js) has 1,083 lines, maintains cached collections, and uses synchronous XHR. Its initialization attempts to fetch many collections before rendering. File-download interception compensates for ordinary links not carrying bearer credentials.

At baseline commit `64ff265`, the React scaffold had routing, authentication context, sidebar, navbar, layout, and API helpers but no implemented pages. Its former `src/App.jsx` contained 55 distinct placeholder names and 56 explicit route declarations. The migration replaces it with [App.tsx](../front-end-react/src/app/App.tsx), public/auth pages, and a typed registry; all registry pages now have implementations. There are 57 legacy HTML pages plus the landing `index.html`; these inventories are not one-to-one. See the [complete mapping](06-migration-roadmap.md#legacy-screen-mapping).

The backend has 17 feature modules. Larger services include ledger operations, audit engagement, and revenue aggregation. Numerous `forwardRef` imports show that workflow orchestration and feature services depend on each other. Module names alone do not establish clean dependency boundaries.

## Module inventory

| Group | Existing modules | Principal responsibilities |
| --- | --- | --- |
| Identity | `auth`, `users`, `expert-applications` | Credentials, user profiles, role-specific records, expert intake |
| Marketplace | `tasks`, `proposals`, `milestones` | Projects, invitations, hiring, submissions, approval |
| Review | `audit-requests`, `audit-reports`, `disputes` | Expert negotiation, coverage, reports, arbitration |
| Finance | `ledger`, `transactions`, `revenue` | Wallets, escrow, fees, transaction history, aggregation |
| Collaboration | `messages`, `notifications`, `files` | Communication and attachments |
| Operations | `audit`, `seed` | Staff audit trail and disposable demonstration state |

## Defect register

P0 means protect financial integrity or private data before release. P1 means a workflow is broken or misleading. P2 means maintainability or verification gaps. The table records baseline findings; current correction status and regression evidence are in the implementation reports, rather than implied by these historical descriptions.

| ID | Priority | Observation and evidence | Target correction and reproduction |
| --- | --- | --- | --- |
| D01 | P1 | [React API helper](../front-end-react/src/shared/api/client.ts) defaults to `/api` and claims a proxy exists, but [Vite config](../front-end-react/vite.config.ts) has none. It also sends `x-lannent-session`, absent from the backend CORS allowlist in [main.ts](../back-end/src/main.ts). | Add a development proxy and bearer-only transport. Test configured and unset API base URLs and cross-origin requests with a stored session. |
| D02 | P1 | `fileUrl()` directly calls `.replace()` on `VITE_API_URL`, although other helpers allow that variable to be absent. Download behavior and file-reference handling differ between the two frontends. | Resolve URLs from the normalized API base; use authenticated downloads. Test unset configuration, file-reference objects, legacy filename-only records, missing files, and forbidden downloads. |
| D03 | P0 | [AuthContext](../front-end-react/src/app/providers/AuthProvider.tsx) restores a JSON session without `/auth/me`. [AuthService](../back-end/src/modules/auth/auth.service.ts) checks the token but not current active status; deleted-account lookup throws a user-not-found error through UsersService instead of explicitly rejecting authentication. Token verification also does not refresh current role/status. | Validate identity before opening protected routes and reject deleted/suspended accounts. Test malformed storage, session without token, expiry, suspension, deletion, and role changes. |
| D04 | P0 | [User updates](../back-end/src/modules/users/users.controller.ts), [task mutations](../back-end/src/modules/tasks/tasks.controller.ts), [milestone mutations](../back-end/src/modules/milestones/milestones.controller.ts), and [dispute resolution](../back-end/src/modules/disputes/disputes.controller.ts) do not pass an actor into the corresponding operation. [Proposal actions](../back-end/src/modules/proposals/proposals.controller.ts) have no action-specific role decorators. Authentication is not record ownership. | Require the owner, assigned worker, or assigned expert as appropriate. Test each operation using another valid account, altered IDs, and forged actor fields in the body. |
| D05 | P0 | [Messages](../back-end/src/modules/messages/messages.controller.ts), [notifications](../back-end/src/modules/notifications/notifications.controller.ts), [transactions](../back-end/src/modules/transactions/transactions.controller.ts), and [milestones](../back-end/src/modules/milestones/milestones.controller.ts) accept collection filters without enforcing viewer scope. Password redaction on users does not redact all private fields. | Filter by authenticated viewer before applying client filters; return public directory projections where needed. Test omitted filters and another user's IDs. |
| D06 | P0 | [Client project deletion](../legacy/front-end/pages/client-my-projects.html) and [operations deletion](../legacy/front-end/pages/superuser-tasks.html) call wallet top-up for `task.budget` and create a transaction before deleting an open, unassigned task. Budget is not proof of held funds. | Delete unfunded tasks without a refund. Cancel funded work through the ledger. Test an open task with zero held escrow and assert balances do not increase. |
| D07 | P0 | [UpdateUserDto](../back-end/src/modules/users/dto/update-user.dto.ts) exposes `walletBalance`, reputation counters, and status; [UsersService](../back-end/src/modules/users/users.service.ts) writes them. Generic transaction creation is also exposed by [TransactionsController](../back-end/src/modules/transactions/transactions.controller.ts). | Separate profile and operations fields; restrict balance/history writes to ledger operations. Test profile patches that attempt to set balances or reputation, including self-updates. |
| D08 | P0 | [DisputesService](../back-end/src/modules/disputes/disputes.service.ts) sets `resolved` before financial settlement. [AuditReportsService](../back-end/src/modules/audit-reports/audit-reports.service.ts) inserts/upserts a report before settlement; audit coverage is updated before payout. | Use an in-memory transaction for coupled writes. Inject insufficient funds or repository failure and assert the complete prior state is retained. |
| D09 | P0 | [Milestone approval](../back-end/src/modules/milestones/milestones.service.ts) does not enforce submitted state, active-dispute freeze, or required audit coverage. Generic DTO status fields often use `IsString` despite Swagger enums. Client-favour dispute code refunds funds and also requests revisions. | Enforce transitions and the agreed funded-rework rule. Test invalid statuses, pending/disputed approval, missing reports, and repeated settlement. |
| D10 | P1 | [Client settings](../legacy/front-end/pages/profile-settings.html) submits fields such as `email`, `bio`, and `companyDetails`; [expert settings](../legacy/front-end/pages/expert-settings.html) submits availability and domains. Current DTO/service fields do not persist several of these values, while the screens report success. | Define supported profile contracts, persist supported preferences, make identity fields read-only, and report errors truthfully. Save and reload each supported field. |
| D11 | P1 | Public application uploads have no uploader/project. [FilesService.canView](../back-end/src/modules/files/files.service.ts) allows broad staff readers but not intake admins; intake is responsible for application review. | Allow intake to read files referenced by expert applications, without granting unrelated file access. Test résumé/certificate access and unrelated project downloads. |
| D12 | P1 | [ExpertApplicationsService](../back-end/src/modules/expert-applications/expert-applications.service.ts) marks approval before account creation and catches creation errors. It also supplies a shared fallback password when one is missing. | Validate credentials and create the expert account atomically with approval; never silently use a shared default credential. Test duplicate/conflicting accounts, missing credentials, and injected failure. |
| D13 | P1 | [React routes](../front-end-react/src/app/routes/registry.ts) and sidebar grant superusers admin access that [revenue](../back-end/src/modules/revenue/revenue.controller.ts) and [intake](../back-end/src/modules/expert-applications/expert-applications.controller.ts) endpoints deliberately restrict. Some legacy operations screens attempt expert-only actions. | Preserve separate duties; align UI capabilities with server policy and add an explicit operations project-creation use case. Test all seven roles. |
| D14 | P1 | [Forgot password](../legacy/front-end/pages/forgot-password.html) switches to an email-sent state without making a recovery request; no recovery endpoint is present in the auth module. | Keep the route with an honest unavailable state. Test that submitting never claims delivery or invokes a nonexistent service. |
| D15 | P2 | [HTTP test](../back-end/test/app.e2e-spec.ts) expects `Hello World!`; AppModule does not register that starter controller. It also bypasses bootstrap's prefix/pipes/interceptor/filter configuration. Only [ledger unit tests](../back-end/src/modules/ledger/ledger.service.spec.ts) exist under source. | Share application configuration with the test harness; replace the starter test with contract, permission, and workflow tests. |
| D16 | P1 | [Project creation](../legacy/front-end/pages/post-task.html) offers USD/EUR/GBP, but ledger/wallet state has no currency partition. Monetary descriptions and seed projects use USD. | Implement INR-only accounting and formatting. Reject unsupported currencies; preserve numeric demo values rather than perform FX conversion. |

## Structural work, separate from defects

- Replace all placeholders and reconcile duplicated role pages rather than copying each HTML file into a large TSX component.
- Move business side effects from browser pages into named backend use cases.
- Replace repeated string statuses and anonymous object shapes with explicit contracts.
- Keep explanatory comments about current rules; move long historical narratives into documentation.
- Preserve working safeguards already present: bearer-token verification, public-role signup restrictions, upload limits, wallet ownership checks on wallet routes, and ledger release idempotency.

## Limits and follow-up verification

No runtime exploit, load test, browser parity check, build, or application test was executed for this baseline. Dependencies were absent. A missing literal HTML destination was not found in the inspected static href/src references; dynamic navigation still needs migration tests. SQL files, SRS PDF, and videos do not establish runtime behavior and were not exhaustively audited.

During implementation, record each finding's reproduced result and test path here. Add new findings only with source evidence or a reproduction, and do not mark an entry fixed merely because a file was reorganized.
