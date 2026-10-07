# Lannent React frontend

React/TypeScript is the active application. Marketplace, expert, staff, profile, analytics, and notification features use the NestJS API; the static frontend is archived under `../legacy/front-end/`.

## Run locally

Use Node 22.12+ and npm. Install both packages from the repository root:

```sh
npm --prefix front-end-react ci
npm --prefix back-end ci
cd back-end
npm run build:all
npm run start:dev
```

Preserve an existing backend `.env`; otherwise configure one from `.env.example`. Open `http://localhost:3000` for the cohosted built app. Rebuild after frontend edits.

For hot reload, keep the backend running and run `npm run dev` here. Vite proxies `/api` to `http://localhost:3000`. No frontend environment file is required. Set `API_PROXY_TARGET` for another API port. An existing `VITE_API_URL` overrides the proxy; preserve local files and check [.env.example](.env.example).

The backend's `build:all` deliberately builds production React with same-origin `/api`, overriding development localhost settings. A separately hosted build can use `VITE_API_URL=https://your-api.example/api`; configure API CORS and the document CSP's connect origins. `vite preview` only previews an artifact locally.

## Code map

- `src/app/`: providers, portal layout, central route registry, role guards, and legacy URL resolver.
- `src/features/`: auth/public, dashboards, projects, proposals, milestones, wallets, messages, audits, disputes, expert intake/reports, administration, analytics, profiles, and notifications.
- `src/shared/api/`: bearer transport, errors, uploads, authenticated downloads, and token storage.
- `src/shared/types/`, `format/`, `ui/`: account/domain types, INR presentation, and accessible controls.
- `src/styles/base.css`: theme and basic controls; feature styles use CSS Modules.
- `tests/`: Playwright browser journeys; component tests live beside features.

Register a page in `src/app/routes/registry.ts` and its renderer in `pages.tsx`, `expert-pages.tsx`, or `staff-pages.tsx`. Route tests reject missing implementations. Navigation shares the registry's permissions; backend authorization still governs resources and money. Use actor-scoped query keys and clear private caches when identity changes. Cached display fields never prove authentication.

Old `/pages/*.html` links resolve through the React compatibility map. Keep exact resource IDs; never substitute a cached first project. Password-reset email remains explicitly unavailable until an email integration is added.

## Validation

```sh
npm run build          # TypeScript checks and production bundle
npm run lint           # Oxlint and hooks rules; warnings fail
npm run format:check   # Read-only Prettier check
npm test               # Vitest and React Testing Library
npx playwright install chromium
npm run test:e2e       # Browser flows against backend 3101 + Vite 5174
npm run test:staff     # Staff flows on isolated ports 3102/5175
npm run test:cutover   # All browser flows + route inventory on built server 3103
```

Tests use disposable in-memory records, published demo accounts, and fresh servers. Coordinate runs through workspace `shared/`; avoid overlapping runs or rebuilding bundles in use. Separate configurations have separate output folders. No numeric coverage threshold is imposed; test authorization, money, and workflow regressions.

See [onboarding](../documentation/08-contributor-onboarding.md), [staff evidence](../documentation/16-w5-implementation.md), [cutover evidence](../documentation/17-w6-cutover.md), and [roadmap](../documentation/06-migration-roadmap.md).
