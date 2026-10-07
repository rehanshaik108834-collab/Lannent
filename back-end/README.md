# Lannent API

NestJS/TypeScript API with typed, seeded in-memory repositories. The server also hosts the built React app; the former static frontend is archived under `legacy/front-end/`.

```sh
npm ci
# Preserve an existing .env; otherwise copy .env.example and configure it.
npm run build:all
npm run start:dev
```

Open port 3000 for the app or `/api-docs` for Swagger. JSON endpoints use `/api` and an Authorization bearer token. Public signup, login, and expert applications are explicit exceptions. Role/user-id headers cannot authenticate a caller.

`build:all` builds React in production mode with `/api`, then compiles NestJS. A missing frontend build fails startup with instructions. `npm run build` compiles only the API. Production requires `JWT_SECRET` and `CORS_ORIGIN` before `npm run start:prod`.

Feature `.module.ts` files own HTTP composition; `.core.module.ts` files compose services; `.data.module.ts` files own each repository exactly once. Actor policies protect records as well as routes. Use ledger operations for all balance/history writes and the unit of work for coupled changes. `operations/` contains explicit project-on-behalf and reviewer-assignment actions, preserving the operator's identity.

Run `npm test -- --runInBand`, `NODE_ENV=test npm run test:e2e -- --runInBand`, and `npm run lint:foundation`. `lint:check` and `format:check` are read-only whole-repository checks, with existing debt documented in the cutover report. Avoid the mutating `lint`/`format` scripts during parallel work.

Data resets on restart. Upload bytes live on disk while metadata lives in memory. `/seed/reset` is only for disposable development/test records. No database or real payment gateway is added by this migration.
