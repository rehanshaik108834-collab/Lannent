# D10–D12 Implementation Report

Date: 2026-10-06. Scope: defects D10 (profile persistence), D11 (intake file access) and D12 (atomic expert approval) from the [defect register](01-current-state-and-defects.md). This work ran alongside the W2 structural refactor ([13-w2-structure.md](13-w2-structure.md)). Repository and type files belong to that refactor; the services, controllers and DTOs below belong to this work.

## D10: profile fields persist or are refused

**Before:** the legacy settings screens sent fields the API stripped silently (`bio`, `phone`, `companyDetails`, worker professional details, expert availability and domains). They then reported "saved". The store also fell back to editing its local cache when the server refused a save.

**Now:** [`users/profile-contract.ts`](../back-end/src/modules/users/profile-contract.ts) lists, per role, every field a profile may store. A field outside the contract returns 400 naming the field, and nothing is saved.

| Role | Profile fields (in addition to `name`, `avatar`, `avatarColor`, `phone`, `phoneCountryCode`, `bio`) |
| --- | --- |
| Client | `company`, `location`, `companyDetails { name, industry, website, size, location }`. `company` follows `companyDetails.name` |
| Worker | `location`, `skills`, `jobTitle`, `experienceLevel`, `hourlyRate` (INR, ≥ 0), `availability` (short text), `languages`, `portfolioProjects[{ id, title, description?, url?, thumbnail? }]` |
| Expert | `location`, `specialization`, `hourlyRate`, `availability { status, maxCases, type }`, `auditDomains` (ids from the settings screen) |
| Staff roles | Common fields only |

Notes:
- **Reviewer matching is unchanged.** `auditDomains` is a stored preference. The `domains` used to match reviewers to project categories are set at approval and are not self-editable here.
- **What others see:** directory entries expose profile details (bio, job title, availability, portfolio and similar) but not phone or email.
- **Fields that stay protected:** identity, status, balance and reputation fields are still rejected if changed (W2 / D07).

**Legacy pages:**
- [`store.js`](../legacy/front-end/js/store.js) gains `saveProfile`, which returns the server's verdict with no local fallback.
- The client, worker, expert and staff settings pages save through it. They show the server's error when a save is refused.
- Their email fields are read-only, since identity changes are deferred.

## D11: intake reads application documents, and only those

**Before:** public application uploads have no uploader and no project. `FilesService.canView` let oversight roles read every file but denied intake, the desk that actually reviews applications.

**Now** ([`files.service.ts`](../back-end/src/modules/files/files.service.ts)):
- **What intake can open:** a file that was uploaded through the public application route (`purpose: expert-application`), has no project and no uploader, and is referenced by an expert application. Intake can open nothing else.
- **Checks when an application is submitted:** each referenced résumé or certificate must be such a public application upload, and not already attached to another application. An application naming a project file is rejected, so it cannot be used to expose that file.
- **Signed-in uploads:** a file that names a project must come from a participant (the client, the hired worker, or an engaged reviewer), and a named milestone must belong to that project. The application purpose is reserved for the public route.
- **Identity:** the files controller now takes identity from `@CurrentActor()` instead of the `user-id`/`role` headers.

## D12: expert approval is atomic and uses the applicant's own password

**Before:** approval marked the application approved first, then tried to create the account. Creation errors were logged and swallowed, and a missing password fell back to the shared `Expert@123`.

**Now** ([`expert-applications.service.ts`](../back-end/src/modules/expert-applications/expert-applications.service.ts)):
- **Applying:**
  - A password is required: 8+ characters with upper, lower, digit and special. It's hashed immediately.
  - The email must not already have an account or an open or approved application.
- **Deciding:**
  - Only intake decides (`approved` / `rejected`). `reviewedBy` is the signed-in admin; a mismatching body value is rejected.
  - A repeated decision returns the record; reversing a decision returns 409.
- **Approval:**
  - The application must still be pending, have a stored password hash, and its email must still be free.
  - Account creation (with the applicant's hash, via `UsersService.createExpertFromApplication`) and the approval record commit in one unit of work.
  - Any failure leaves the application pending with no account. The stored hash is discarded once a decision is recorded, and `accountId` links the application to the account.
- **No default password:** no default or shared password exists anywhere.

**Legacy pages:** the application form and the intake page report the server's answer. They no longer pretend a refused application or approval succeeded locally.

## Evidence

- `back-end/test/profiles-and-intake.e2e-spec.ts` covers A13 (save and reload every supported field, role-mismatch and malformed values refused, nothing saved on refusal, privacy of phone and email), A14 (intake reads a referenced résumé; unreferenced uploads and project files stay forbidden; smuggling a project file into an application is refused; planting files on others' projects is refused) and A15 (password required, duplicate and taken emails, chosen password logs in, the shared default password does not, replay and reversal, email taken after applying, injected failure rolls the account back).
- Each guard was checked by removal: dropping the intake rule or the approval unit of work makes the matching tests fail.

## Validation performed

From `back-end/`, on Node 26.8.1, run against the W2 structural refactor in progress at the time:

```sh
npx tsc --noEmit -p tsconfig.json   # clean
npm run build                       # passed
npx jest --runInBand                # 5 suites, 43 tests passed
NODE_ENV=test npx jest --config ./test/jest-e2e.json --runInBand   # 3 suites, 46 tests passed (5 auth + 24 authorization + 17 D10–D12)
```

One unit run failed once in `milestone-settlement.spec.ts` while the parallel refactor was editing the ledger and audit wiring. The immediate rerun passed 43/43, and the failure was not reproduced. The changed legacy pages and `store.js` were syntax-checked; no browser walkthrough was done.
