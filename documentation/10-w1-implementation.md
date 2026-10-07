# W1 Implementation Report

Date: 2026-10-06. Scope: W0 runtime baseline and W1 React foundation from the [migration roadmap](06-migration-roadmap.md). W2–W6 remain pending.

## Delivered

- Replaced the active JSX scaffold with strict TypeScript. Application composition, providers, route policy, layouts, public/auth features, transport, and account types have separate responsibilities.
- Added functional landing, expert information, login, expert-context login, client/worker signup, not-found, and honest unavailable password-recovery pages. Preserved the neutral palette and split-panel authentication layout; scoped feature styles with CSS Modules.
- Centralized portal URLs, allowed roles, navigation, and dashboard destinations. Preserved existing paths and reserved explicit project/milestone/report paths for later pages. Internal return URLs are checked against the authenticated role.
- Added a responsive portal shell with current account, navigation, and logout. Domain pages visibly state that they are unavailable; no mock dashboards or balances imply completed functionality. The old, unwired notification component was removed; a live notification feature remains future work.
- Added `/api` proxying, a typed envelope-aware transport, status/request-ID errors, bearer-only identity, multipart handling, and authorized file downloads. Missing files and external download URLs fail explicitly. Legacy filename-only attachments are unavailable.
- Replaced cached-session trust with `/auth/me` verification. Loading, retryable connection failure, rejected credentials, logout, cross-tab account changes, and stale requests have separate behavior. Private query caches clear when accounts change or sign out.
- Fixed backend token validation to consult current account status/role. Suspended, deleted, unknown-role, malformed, and expired credentials fail validation. Password hashes remain excluded from auth responses.
- Added Vitest/Testing Library, Playwright, strict type checks, hooks lint rules, and Prettier. Reused shared backend prefix/validation/envelope/error configuration in HTTP tests and fixed Jest's handling of the installed JWT module.

## Baseline and defect evidence

Baseline commit: `64ff265` (`Add front-end-react`). Dependencies were installed with `npm ci` in both applications before implementation.

| Check | Before W1 | After W1 |
| --- | --- | --- |
| Backend build | Passed | Passed |
| Backend unit suite | 13 ledger tests passed | 18 tests passed, including five authentication cases |
| Backend HTTP suite | Failed loading installed JWT ESM module; starter test obsolete | Five real authentication HTTP tests passed |
| Frontend build | Passed JSX scaffold | Passed strict type checks and production bundle |
| Frontend lint | Three warnings | Passed with warnings treated as failures |
| Frontend unit/component suite | Not configured | 33 tests passed |
| Chromium browser suite | Not configured | Ten journeys passed |

The five new backend authentication unit cases were run before the fix: four failed and one passed. The failures demonstrated continued access after suspension/deletion, stale roles, and malformed subject acceptance. All five now pass. The existing ledger suite remains intact.

D01/D02 are covered by default/configured API-base, headers, multipart, envelope, invalid path, authenticated download, filename, delayed blob revocation, and 403/404 tests. D03 has provider, backend unit, HTTP, and browser coverage. D14 is covered by a recovery screen with no email form/request or fabricated delivery. D13's route/navigation mismatch is corrected, but its operations project-creation use case remains W5 work. Legacy pages were not rewritten in this wave.

## Validation performed

Environment: Node 26.8.1, npm 11.19.0, local macOS. Frontend tooling requires Node 22.12+.

From `back-end/`:

```sh
npm run build
npm test -- --runInBand
NODE_ENV=test npm run test:e2e -- --runInBand
```

From `front-end-react/`:

```sh
npm run build
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

Browser journeys use isolated contexts and disposable backend state on port 3101, with Vite on 5174. Each of the seven roles signs in, refreshes, and signs out. Additional checks cover signup, forged cached identity, authorized return paths, staff-route denial, recovery, not-found, and mobile overflow. Landing/mobile and login/mobile/desktop screenshots were inspected; generated screenshots remain ignored under `test-results/`.

No full domain-flow or cross-browser acceptance claim is made. Financial authorization, settlement, INR, intake, audit, dispute, and termination requirements remain in their planned waves. Existing backend warnings about an ephemeral development JWT secret and Node's experimental localStorage did not fail checks.

## Run and extend

Start NestJS using `npm run start:dev` in `back-end/`, then `npm run dev` in `front-end-react/`. Open Vite's URL. No frontend environment file is required for the default local API; see [frontend setup](../front-end-react/README.md).

Add business features under `src/features/`, register routes centrally, and replace their pending renderers in `src/app/App.tsx`. Add actor-scoped queries and server-side ownership checks together. Frontend role guards are navigation controls, not resource authorization.

Next: W2 backend foundation—typed actors/records, ownership policies, data-module dependency cleanup, ledger use cases and atomic in-memory mutations, plus INR. Use the defect register and acceptance matrix to drive regression tests before extending marketplace screens. React production hosting, deep-link compatibility, and removal of all pending pages belong to W6.
