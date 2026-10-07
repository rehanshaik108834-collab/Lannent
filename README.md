# Lannent

Lannent connects clients, workers, and expert reviewers through projects, milestones, escrow, reviews, and disputes. React/TypeScript is the active frontend; NestJS is the API and serves the built app. All monetary amounts are INR.

## Start locally

Use Node 22.12+ and npm. From this repository:

```sh
npm --prefix front-end-react ci
npm --prefix back-end ci
cd back-end
# Copy .env.example to .env only if .env does not already exist.
npm run build:all
npm run start:dev
```

Open `http://localhost:3000`. Swagger is at `/api-docs`; API paths start with `/api`. `build:all` builds the frontend with production React and same-origin `/api`, then compiles NestJS. It preserves local `.env` files. Rebuild after frontend changes when using the cohosted app.

For frontend hot reload, keep the API running and run `npm run dev` from `front-end-react/`. Vite proxies `/api` to port 3000. A local `VITE_API_URL` override supports a separate API; see the frontend README for the distinction between that build and `build:all`.

## Code map

- `front-end-react/src/features/`: marketplace, expert, staff, profile, analytics, and notification features.
- `front-end-react/src/app/`: composition, providers, role routes, layouts, and legacy URL resolution.
- `back-end/src/modules/`: HTTP modules, service-only core modules, leaf repository modules, DTOs, and typed records.
- `back-end/src/modules/ledger/`: wallet, funding, payout, and refund operations behind the ledger facade.
- `back-end/src/http/`: React static serving and SPA/asset/API boundaries.
- `documentation/`: behavior, contracts, onboarding, migration mapping, and implementation evidence.
- `legacy/front-end/`: archived static source, never served as the running application.
- `Database/` and `Figma Designs/`: design references.

## Checks

From `back-end/`: `npm run build`, `npm test -- --runInBand`, `NODE_ENV=test npm run test:e2e -- --runInBand`, and `npm run lint:foundation`.

From `front-end-react/`: `npm run build`, `npm run lint`, `npm test`, `npm run format:check`, and `npm run test:e2e`. Install Chromium with `npx playwright install chromium` first. `npm run test:cutover` verifies the cohosted production bundle on port 3103; `npm run test:staff` uses separate ports 3102/5175. Do not overlap browser runs or rebuild their bundles while they are running.

The non-mutating whole-backend `lint:check` and `format:check` expose existing service/DTO lint and formatting debt; they are not recorded as passing. No lint rules were disabled to hide it.

## Demo and deployment limits

Repositories hold seeded records in memory: restarting resets accounts, projects, balances, and sessions without a stable JWT secret. Wallet deposits/withdrawals are demo ledger operations; no payment provider is connected. Password-reset email remains explicitly unavailable.

Production startup requires a stable `JWT_SECRET` (at least 32 characters) and a `CORS_ORIGIN` allowlist. Build before `npm run start:prod`. Serve the React shell, assets, `/api`, and `/api-docs` through the same host by default. Optional `FRONTEND_DIST` and `FRONTEND_CONNECT_ORIGINS` support another artifact location/API origin. Never commit secrets or reset meaningful data.

See [onboarding](documentation/08-contributor-onboarding.md), [W5 implementation](documentation/16-w5-implementation.md), and [React cutover](documentation/17-w6-cutover.md).
