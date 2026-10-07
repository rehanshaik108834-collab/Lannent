# API and Data Contracts

Status: migration API specification, reconciled with implemented interfaces in reports 11–17. Types below illustrate contracts; use exported source types and DTOs for exact definitions. JSON money is INR, with paise arithmetic internally.

## Transport and identity

Preserve `/api` as the API prefix and `/api-docs` for Swagger. JSON operations retain the existing envelope from [ResponseInterceptor](../back-end/src/common/interceptors/response.interceptor.ts):

```ts
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type Role = 'client' | 'worker' | 'expert' | 'superuser'
  | 'revenue-admin' | 'intake-admin' | 'compliance-admin';

type Actor = { id: string; role: Role; email: string };
```

Send `Authorization: Bearer <token>`. Browser-supplied `role`, `user-id`, and `x-lannent-session` are not identity contracts. Validate the account's current role/status as part of protected request identity resolution; stale token claims must not preserve suspended or revoked permissions.

`POST /auth/login` accepts email/password and returns token, expiration information, safe user data, and a display session inside the envelope. `GET /auth/me` validates the token and reports a real active user; missing/deleted/suspended users must fail authentication. Preserve storage key compatibility, not blind trust in stored JSON.

## Existing endpoint families

These families exist in controllers today; the target permission rules in [workflows](02-workflows-and-permissions.md) apply after migration.

| Family | Existing operations | Target boundary |
| --- | --- | --- |
| `/auth` | Login, me | Public credentials exchange; validated bearer identity |
| `/users` | Signup, legacy login, staff creation, list/detail, profile update/delete, wallet add/deduct/withdraw | Public client/worker signup; own profile; operations administration; ledger-owned financial changes |
| `/tasks` | List/detail/create/update/delete, cancel-draft | Discovery versus private draft/participant views; owning-client actions; explicit operations actions |
| `/proposals` | List/detail/create/update, hire/accept/decline | Worker-authored proposals, client invitations, authorized party actions |
| `/milestones` | List/detail/create/update, submit/approve | Project participants; assigned worker submission; owning-client approval |
| `/audit-requests` | List/detail/preview/create/update, offers/offer acceptance, fund/accept/decline | Owning client and assigned expert; valid negotiation transitions |
| `/audit-reports` | List/detail/create | Participant/oversight reads; assigned-expert report writes |
| `/disputes` | List/detail/create, resolve | Project parties and assigned reviewer; atomic verdict settlement |
| `/transactions` | List/create | Own history or authorized finance/oversight projection; no generic browser writes |
| `/ledger` | Summary, escrow by task | Authorized summary or project-scoped escrow reads |
| `/revenue` | Summary, fee breakdown, timeseries, user/project breakdown, distribution, fee config read/update | Revenue/compliance reads; revenue-only fee changes |
| `/expert-applications` | Public status/create; privileged list/detail/status update | Intake approval; intake/compliance reads; safe public status |
| `/files` | Authenticated upload; public application upload; metadata/download/delete | Authorized attachment/read/delete relationships |
| `/messages` | List/create | Conversation participants; sender derived from actor |
| `/notifications` | List, user read-all | Own inbox/read-state; creation is internal |
| `/audit-log` | List, export | Compliance reads, internal append-only writes |
| `/seed` | Reset | Authorized disposable development/test use only |

Keep existing endpoint naming where possible. A protected endpoint being callable is not proof that its requested record is permitted. Query parameters only narrow the actor's authorized result set.

## Implemented interface changes

| Interface | Contract |
| --- | --- |
| `POST /tasks` | Accept initial `milestones` alongside project fields; derive client identity from actor; create project, milestones, and optional audit engagement atomically |
| `POST /operations/projects` | Superuser-only operation accepting the selected `clientId`; use the same creation rules and record the operations actor |
| `POST /tasks/:id/termination` | New party-authorized operation accepting a reason; request/finalize termination and return pending settlement information |
| `POST /milestones/:id/request-revision` | Explicit owning-client revision action; retain funds and notify the assigned worker |
| `PATCH /users/:id/status` | Explicit operations-only active/suspended transition, separate from self-service profile updates |
| Generic task/milestone/audit/proposal PATCH | Permit ordinary editable metadata only; protected workflow transitions go through named actions |
| `PATCH /users/:id` | Permit actor-owned supported profile/preferences fields; reject balances, computed reputation, status, credentials, and identity changes |
| Generic transaction/notification POST | Browser-facing creation removed; internal services record financial history and workflow notifications |
| Legacy `POST /users/login` | Retired; React uses the token-issuing `/auth/login` route |
| Swagger | Bearer security replaces role/user-id header examples; controller DTOs document callable actions. Further metadata/type cleanup belongs to the tracked backend quality debt |

Do not silently accept a forged actor field and ignore it while performing a sensitive operation. Derive acting identities, validate intentional resource/recipient IDs, and reject conflicting supplied identity fields during compatibility handling.

## Project and termination contracts

Keep `taskId` as the wire/storage relationship key for compatibility. UI route names may use `projectId`; adapters translate naming deliberately.

```ts
type Money = number; // INR rupees at the public boundary, max two decimals
type Currency = 'INR';

type InitialMilestone = {
  title: string;
  description?: string;
  budget: Money;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
};

type CreateProjectInput = {
  title: string;
  description: string;
  category: string;
  budget: Money;
  currency?: Currency;
  deadline?: string;
  skills?: string[];
  auditEnabled?: boolean;
  auditExpertId?: string;
  auditFee?: Money;
  milestones: InitialMilestone[];
};

type TerminationResult = {
  task: Project; // Public project response, including termination state
  state: 'pending' | 'completed';
  pendingMilestoneIds: string[];
  pendingDisputeIds: string[];
  refund: null | { projectAmount: Money; auditAmount: Money };
};
```

`Project` above denotes the complete typed public project response, not an existing exported symbol. Its `termination` metadata records requester, reason, requested/completed timestamps, and state. Keep the ordinary project status until final cancellation; capability checks block new work while termination is pending. Repeated requests return the current/recorded result without another refund.

Initial milestone totals equal budget. Once funded, changing allocations cannot exceed held funds, alter a settled recipient, or rewrite paid amounts. Validate these rules in the server, not only the project wizard.

## Statuses and relationships

| Record | Canonical target statuses |
| --- | --- |
| Project | `draft`, `open`, `in-progress`, `under-review`, `completed`, `cancelled` |
| Milestone | `pending`, `in-progress`, `submitted`, `review`, `revision-needed`, `disputed`, `completed`, `cancelled` |
| Audit engagement | Preserve [AUDIT_STATUS](../back-end/src/modules/audit-requests/audit-request.constants.ts): preview-sent, negotiating, agreed, escrow-funded, in-progress, report-submitted, paid, declined, cancelled |
| Dispute | `open`, `under-investigation`, `resolved` |
| Application | `pending`, `approved`, `rejected` |

Convert legacy `todo` to `pending`, and completion aliases `done`, `approved`, and `audit-passed` to `completed` at the fixture/read compatibility boundary. Preserve audit report verdict separately; `audit-passed` must not falsely imply a worker was paid. Reconcile historical aliases against the seed ledger when building fixtures. Enforce enums through validators and transitions through policies, not Swagger descriptions alone.

For every related request, verify that the milestone belongs to the project, the report belongs to the engagement, the dispute refers to the actual work, and file references belong to an accessible resource. Expert/client/worker names and avatars are server projections rather than financial recipient authority.

## Profile fields

Persist the existing meaningful settings inputs with typed role-specific DTOs:

| Profile | Supported fields |
| --- | --- |
| Shared | Name, avatar, avatar color, phone, phone country code, location, bio |
| Client | Company and company details: name, industry, website, size, location |
| Worker | Job title, experience level, INR hourly rate, availability, skills, languages, portfolio projects |
| Expert | Specialization, canonical category `domains`, availability status/max cases/type |
| Staff | Shared profile fields; own display name; read-only account email |

Portfolio entries retain ID/title/description/URL/optional thumbnail. Normalize empty optional links to absent values; do not persist `#` as a real portfolio URL. Validate nested fields and bounds. Expert UI domain IDs map to the backend's category strings, so discovery and eligibility use one domain vocabulary.

Email, password, role, wallet balance, ratings, completed-project counts, and review counts are not self-service profile inputs. Use the server response to refresh session display data; do not update local storage with an email the server rejected. Status has its dedicated operations endpoint. Preferences have no authority to alter account privileges.

## Files, messages, and money

Use the existing file reference shape `{ id, name, size, mime, url }`. Upload one file in the `file` multipart field to `/files`; anonymous expert applicants use `/files/application`. Download `/files/:id` with bearer credentials and use `Content-Disposition` for filenames. Legacy filename-only references are visibly unavailable. Validate referenced application documents before granting intake access.

Message sender ID/name/avatar comes from the actor/account. Validate receivers against the project's permitted conversation participants. Do not let a user submit another sender's profile as evidence.

Every public amount is INR rupees, finite and at most two-decimal precision; reject unsupported currency codes and invalid/negative values where inappropriate. Convert to integer paise internally. Use ISO timestamps for new workflow events. Money strings such as `$1,100` are display legacy data, not settlement input; normalize proposal bid displays to numeric INR fields during migration. Existing nominal amounts/fee thresholds are retained with no FX conversion.

## Errors and compatibility

Normalize failures into the existing unsuccessful envelope with an actionable message. Preserve `X-Request-Id`; do not add an undocumented response field just to carry it. Use 400 for invalid input/state, 401 for unusable identity, 403 for unauthorized actions, 404 for missing resources, and 409 for conflicting/replayed actions with different intent. File streaming remains bytes, not a JSON envelope.

Generate/update Swagger from real DTOs and keep frontend contracts aligned. Test request/response parity and field persistence. Tightened authorization, removal of browser financial writes, INR-only input, and rejection of protected PATCH fields are intentional compatibility changes, not accidental regressions.
