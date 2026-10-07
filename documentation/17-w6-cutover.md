# W6 React Cutover

Date: 2026-10-07. Status: functional cutover implemented and verified. Whole-backend strict lint/format debt remains explicitly open; this is not a claim that every migration release gate is closed.

## Runtime and compatibility

NestJS now serves `front-end-react/dist`, with JSON APIs under `/api` and Swagger under `/api-docs`. `back-end/src/http/frontend.ts` owns static serving. A missing React build fails startup with an actionable `build:all` command.

`npm run build:all` from the backend builds production React with same-origin `/api`, then compiles NestJS. This deliberately avoids copying a development-only localhost API override into a cohosted production bundle; local `.env` files are preserved. Separate-origin frontend builds remain possible with an explicit API URL and document CSP connect-origin configuration.

The React shell has no-store caching and a document CSP; hashed `/assets` files have immutable caching. SPA fallback accepts document GET/HEAD requests only. API errors, authenticated file streams, Swagger, non-document requests, and missing assets—including extensionless asset paths—never receive the React entry page.

All 58 former HTML screens have a compatibility mapping in `legacy-map.ts`. The resolver validates identity, ignores role query parameters, resolves milestone/project relationships through authorized APIs, preserves permitted links across sign-in, and rejects missing/ambiguous or inconsistent IDs. It never selects a first cached record or trusts cached owners/budgets. Known consolidations and retired staff paths follow the normal role guards.

Every canonical registry path resolves through marketplace, expert, or staff page adapters. Migration placeholders and `PendingPage` are removed. Password-reset email retains its explicit unavailable state because the external integration remains deferred.

The former static app is archived at `legacy/front-end/` for design/history reference. Neither its HTML nor its Store/Auth/synchronous-XHR runtime is served. Existing workspace `AGENTS.md` remains unchanged as requested.

## Authentication and retired interfaces

- Browser authorization uses one bearer credential and the current active server account. Raw JWT headers, alternative schemes, arbitrary role/user-id headers, and the former development header fallback cannot authenticate requests.
- Legacy `POST /users/login` and browser-facing `POST /notifications` are removed. React uses `/auth/login`; notifications are created internally by workflows and can only be read/marked by authorized actors.
- Swagger describes bearer credentials instead of role/user-id headers. Optional development/test login-budget overrides do not change the production limit.

## Verification

| Check | Result |
| --- | --- |
| Backend build/type checks | Passed |
| Backend unit tests | 51 passed |
| Backend HTTP tests | 80 passed, including staff and static-boundary cases |
| Frontend unit/component tests | 63 passed at this checkpoint, including route reconciliation |
| Frontend route reconciliation | All 55 registry pages implemented; 58 legacy mappings verified |
| Frontend build/type/lint/format | Passed |
| Built-server browser checks | 20/20 complete flows passed; final four cutover cases also passed after alias/mobile assertion changes |
| Scoped backend foundation lint | Passed |
| Whole-backend strict lint | Still fails on existing service/DTO/test `any` and formatting debt; not represented as passing |

The five static-boundary HTTP cases verify cohosted deep links, old URLs, CSP/caching, API/file/Swagger boundaries, missing assets/builds, retired writes, and forged-header/raw-token rejection. Browser checks verify sign-in through old links, reload, exact milestone resolution, inconsistent-ID errors, staff lazy chunks, notifications/mobile layout, API/asset boundaries, Swagger, and unknown pages. A route inventory visits all 55 canonical pages with permitted seeded roles and checks for loading/error states, migration placeholders and runtime errors. Legacy ID aliases are resource-specific: a project query cannot override an engagement/dispute ID, and contradictory aliases produce a useful error. The mobile staff capture waits for account data and was visually inspected at 390px width; it has no horizontal overflow.

Early cutover checks exposed a development `.env` API origin being embedded in the cohosted build; `build:all` now pins `/api`. They also caught selectors that expected generic review/Swagger headings instead of the actual resource/version titles. Those assertions were corrected; functional failures were not ignored. A desktop header selector that hid notification controls was fixed and covered by a browser assertion.

`lint:foundation` checks the typed modules and new operations/serving/bearer boundary. The non-mutating whole-backend `lint:check`/`format:check` expose broader debt; no rule was disabled to hide it. This is a remaining code-quality release gate for teams requiring a completely clean backend lint run. Chromium smoke/flow checks are not a claim of exhaustive cross-browser or pixel-identical Figma parity.

## Run and maintain

From the repository root, install dependencies in both packages. From `back-end/`, preserve/configure `.env`, run `npm run build:all`, then `npm run start:dev`; open port 3000. For hot reload, run Vite separately and use its proxy. Production startup requires a stable JWT secret and CORS allowlist.

Run component/HTTP suites and `npm run test:cutover` from the frontend for all browser flows against the actual built server. The Vite browser runner remains available for development checks. The cutover runner owns port 3103 and its own output folder; it does not use Vite. Keep builds stable during browser runs. Add a registry entry and page implementation together; route coverage must pass. Keep legacy mappings when links remain in circulation.

Verification numbers record the W5/W6 checkpoint. Claude’s subsequent claimed W3/W4 page-verification and audit-recovery changes are independent follow-up work and require their own updated evidence; they were not overwritten.

Data remains seeded and in memory; payments are simulated, reset is for disposable records, and restart durability/database/payment-provider/email integrations remain outside this migration's scope. No deployment, commit or push was performed.
