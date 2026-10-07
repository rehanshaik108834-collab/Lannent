# W5 Staff and Supporting Flows

Date: 2026-10-07. Status: implemented and verified. W5 was coordinated through the workspace `shared/` protocol while Claude completed W4; staff mappings live in their own adapter.

## Delivered screens

- Operations dashboard, account/profile editing, staff-account creation, active/suspended administration, project oversight and description editing, safe unfunded deletion, escrow overview, project creation on behalf of an explicit client, and dispute-reviewer assignment.
- Revenue summary, fee-type totals, time buckets, per-account earnings, escrow distribution, project cash-flow detail, and all configurable fee bands/rates. Compliance can read revenue; only revenue administrators can edit rates.
- Read-only compliance history with actor/kind/date filters, request IDs, capacity information, and authenticated filtered CSV export.
- Client/worker analytics derived from authorized projects and transaction history.
- Supported profile settings for every role: identity fields remain read-only; role-specific company, professional, portfolio, expert availability, and audit-preference fields persist through the API. Saved own-account names refresh the authenticated display from the server response.
- Header notifications read only the current actor's records; mark-all-read uses the real PATCH endpoint. Errors do not appear as empty successful collections.

Feature files are under `src/features/administration`, `analytics`, `profiles`, and `notifications`; `staff-pages.tsx` maps them to the central route registry. The shared profile form supports own settings and authorized operations editing without trusting a role in the URL. Private queries include actor identity.

## Backend changes

| Contract | Rules |
| --- | --- |
| `POST /operations/projects` | Operations only; explicit active client; initial milestone totals equal the INR budget in paise; project/milestones/audit creation is atomic; audit records the real operator rather than impersonating the client |
| `PATCH /operations/projects/:id` | Operations edits title/description only; status, assignment, allocations and money are not rewritten |
| `PATCH /operations/disputes/:id/reviewer` | Operations assigns an eligible, active expert to an unresolved case; project parties cannot arbitrate; funded/accepted reviewers cannot be replaced; changing a negotiable reviewer resets old offers |
| `DELETE /users/:id` | Existing operations boundary plus a new guard: nonzero balances or project/financial/conversation/review references produce 409; suspend used accounts instead |
| `PATCH /revenue/fee-config` | Validate the entire array/scalar request before changing rates; reject invalid lengths, non-finite/out-of-range values and invalid fixed-fee precision; record actor and changed rates |

Existing role policies, settlement use cases, INR calculations, and separate operations/revenue/intake/compliance responsibilities remain intact. The operations module imports existing core/data modules without adding circular imports or duplicate repositories.

## Evidence

- `back-end/test/staff.e2e-spec.ts`: 13 cases pass, including seven-role read/action restrictions, real operator attribution, active-client/paise allocation checks, injected milestone failure rollback, funded-account deletion refusal, reviewer assignment/funded reassignment refusal, and fee-update atomic validation/audit attribution.
- Frontend profile/fee tests verify supported payloads, read-only identity, draft retention on failed save, and absence of false success. Existing component tests remained green.
- `front-end-react/tests/staff.spec.ts`: 3 journeys pass—on-behalf project creation with forbidden revenue access, fee persistence with compliance history/read-only duties, and profile save/reload/current-name refresh.
- Frontend build/type/lint checks pass. The combined browser run with W1/W3/W4 passed 16 journeys before W6, independently confirmed by Claude's report 15.

W6 subsequently passed all 20 combined browser cases against the built app; see report 17.

Browser work uses separate ports/output folders during parallel activity; never clear another contributor's test artifacts or kill their server. No changes were committed or pushed.
