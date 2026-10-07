# Contributor Onboarding

## What exists now

The Git repository is `40_Lannent/` inside the enclosing workspace. React is the active application served by NestJS. Marketplace, expert and staff/supporting flows are implemented; see reports 14–17 for current scope and verification. The old static code is archived under `legacy/front-end/`.

Read [workflows](02-workflows-and-permissions.md) before changing business behavior, then the relevant [frontend](03-react-architecture.md) or [backend](04-backend-architecture.md) guide. Use [defects](01-current-state-and-defects.md) to understand why a migration change is needed.

## Prerequisites and current setup

Use Node 22.12 or newer for the frontend tooling and npm with the checked-in lockfiles. W1 was built and tested on Node 26.8.1/npm 11.19.0. Install using `npm ci`, not arbitrary dependency upgrades.

From the enclosing workspace:

```sh
cd 40_Lannent
npm --prefix front-end-react ci
npm --prefix back-end ci
cd back-end
# Copy .env.example only when .env is absent; preserve existing configuration.
npm run build:all
npm run start:dev
```

Copy `.env.example` only when `.env` is absent; preserve any existing local configuration. The API defaults to port 3000 and serves the built React app at `http://localhost:3000`. Swagger is at `http://localhost:3000/api-docs`; JSON endpoints start with `/api`. Do not open the HTML files through `file://`.

In a second terminal, from the enclosing workspace:

```sh
cd 40_Lannent/front-end-react
npm ci
npm run dev
```

Open the URL Vite prints. Public, marketplace, expert, profile and staff screens use real API data. `/api` is proxied to port 3000, and requests use bearer credentials. An environment file is optional.

### Environment settings

| Setting | Current purpose |
| --- | --- |
| `NODE_ENV` | Development/test/production behavior; reset requires disposable mode |
| `PORT` | Backend listening port, default 3000 |
| `JWT_SECRET` | Bearer signing secret; stable local value avoids token invalidation across process restarts; production requires one |
| `JWT_EXPIRES_IN` | Token lifetime, default 12h |
| `CORS_ORIGIN` | Production allowlist; development accepts loopback HTTP origins |
| `TRUST_PROXY` | Proxy trust configuration; set only for the actual hosting topology |
| `RATE_LIMIT_PER_MIN` | Global request-rate ceiling |
| `FRONTEND_DIST` | Optional path to a React build; default sibling `front-end-react/dist` |
| `FRONTEND_CONNECT_ORIGINS` | Optional explicit API origins permitted by the document CSP |
| `VITE_API_URL` | Optional API base override; defaults to `/api` |
| `API_PROXY_TARGET` | Vite server proxy target; defaults to `http://localhost:3000` |

Use [the tracked example](../back-end/.env.example) as the source of configuration descriptions. Never commit local secrets. `POST /seed/reset` resets records and uploaded files; use it only on disposable development/test data with the authorized operations account.

Production requires the documented JWT secret and CORS configuration. `build:all` forces a same-origin `/api` production bundle; standalone frontend builds may use their local override. Never overwrite existing `.env` files.

## Frontend checks

Run `npm run build`, `npm run lint`, `npm run format:check`, and `npm test` from `front-end-react/`. Install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. Browser tests launch disposable servers on ports 3101 and 5174. `npm run test:cutover` runs the complete browser suite and route inventory on the built server at port 3103, with separate artifacts. Coordinate runs and avoid rebuilding a bundle while tests use it. See the [frontend README](../front-end-react/README.md) for the code map and deployment distinction.

## Seeded demonstration accounts

These are explicitly published demonstration credentials from [seed.data.ts](../back-end/src/modules/seed/seed.data.ts), not a substitute for production account provisioning.

| Role | Email | Demo password |
| --- | --- | --- |
| Client | `client@gmail.com` | `Password@123` |
| Worker | `worker@gmail.com` | `Password@123` |
| Expert | `expert@gmail.com` | `Password@123` |
| Superuser | `super@gmail.com` | `Superadmin@123` |
| Revenue admin | `admin@gmail.com` | `Admin@123` |
| Intake admin | `intake@gmail.com` | `Intake@123` |
| Compliance admin | `compliance@gmail.com` | `Compliance@123` |

In-memory state resets across process restarts. File metadata and bytes have different lifecycles; an old upload reference may no longer resolve. A restart can also invalidate tokens when a temporary signing secret is regenerated. These are current demo limitations, not database defects to solve in this migration.

## Naming and comments

Use two-space indentation. Backend Prettier uses single quotes and trailing commas; keep frontend formatting consistent as TypeScript files are added.

| Kind | Convention |
| --- | --- |
| React component/page | PascalCase file and symbol: `MilestoneCard.tsx`, `ProjectWorkroomPage.tsx` |
| Hook | `use` prefix: `useProjectMilestones.ts` |
| Function/variable | camelCase: `approveMilestone`, `milestoneId` |
| Backend file | Kebab-case with responsibility: `approve-milestone.use-case.ts`, `tasks.repository.ts` |
| Types | PascalCase: `Actor`, `Milestone`, `TerminationResult` |
| Constants | Established uppercase pattern: `AUDIT_STATUS`, `ROLES` |
| Tests | Backend `*.spec.ts`; frontend `*.test.ts(x)`; browser `*.spec.ts` in the browser-test directory |

Use `projectId` in new UI route/state names and map it deliberately to existing API `taskId`. Prefer `actor`, `clientId`, `workerId`, and `expertId` over ambiguous `user` when the distinction matters.

Comment an operation's purpose and rules, not every line:

```ts
/**
 * Approves submitted work for the owning client.
 * Requires exact-milestone audit coverage when enabled and no active dispute.
 * Commits payout and progress together; repeats return the recorded result.
 */
```

Comments must match current code. Put lengthy historical bug explanations in the defect register. Name policies precisely: permission to view a record is not permission to move its funds.

## How to add a feature in the target architecture

1. Write the user behavior and authorized actors in workflows/decisions. Identify affected acceptance scenarios.
2. Define input/output and validation in contracts and backend DTOs. Add a typed response projection instead of returning a raw repository record.
3. Place business policy and side effects in a named use case. Use repositories for data access and the ledger for money. Add a regression test for the important behavior/failure.
4. Add the feature API adapter and query/mutation hook. A page composes domain components and shared controls; it does not own server settlement logic.
5. Register the route/capabilities/navigation in the single route registry. Verify unauthorized direct calls as well as hidden UI actions.
6. Run relevant checks from [testing](07-testing-and-acceptance.md), update documentation, and include evidence in the pull request.

Example: adding a client revision action belongs to the milestone feature. Its request names a milestone and reason; the server confirms ownership/state, retains escrow, updates revision state, and notifies the assigned worker after commit. The frontend waits for success and refreshes milestone/project data. It does not refund money or construct a workflow notification itself.

## Debugging and reviewing changes

- Trace React page → hook → API adapter → transport → controller → use case → policy/ledger/repository.
- Inspect status/envelope and request ID before assuming a network failure is an empty list.
- A 401 concerns identity; a 403 concerns permissions. Do not fix either by sending another user's role header.
- Compare profile reload results with submitted fields; a toast alone is not proof of persistence.
- Compare actual escrow with a requested refund; project budget is not refundable balance.
- For a stale UI, inspect query keys/invalidation and account switching before introducing another global store.

Commit history has informal descriptive subjects rather than enforced Conventional Commit prefixes. Prefer specific action-oriented subjects. PRs describe changed behavior, linked defect/task IDs, checks/results, and screenshots for visual changes. Keep refactors scoped; do not mark roadmap items complete without behavior evidence.
