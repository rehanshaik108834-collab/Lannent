# W4 Implementation Report

Date: 2026-10-06/07. Scope: W4, the expert vertical flow from the [migration roadmap](06-migration-roadmap.md):
- expert applications and intake (D11/D12 backend in [12](12-d10-d12-implementation.md));
- audit negotiation and funding;
- exact-milestone reports gating approval;
- disputes, verdicts and funded rework;
- contract termination.

Builds on W3 ([14](14-w3-implementation.md)). W5/W6 are being implemented in parallel by another contributor; see their reports.

## Status

The W4 exit criteria are met: an audited project and every verdict and termination scenario pass through the API, and the audited path plus a dispute verdict pass in the browser. D11 and D12 were fixed earlier ([12](12-d10-d12-implementation.md)).

## Backend

### Termination (new)

The use case is [`modules/termination/project-termination.service.ts`](../back-end/src/modules/termination/project-termination.service.ts), its own core module, exposed as `POST /tasks/:id/termination` `{ reason }`.

1. **Who can ask:** the project's client or hired worker. A project nobody was hired on is deleted or cancelled instead (409).
2. **On request:** the request is recorded on the project and the other party is notified. From then on the API refuses new submissions, starting work, revision requests and new milestones (409). Work already submitted still needs approval or a dispute.
3. **While blocked:** if submitted milestones or open disputes remain, the response is `{ state: 'pending', blockingMilestoneIds, activeDisputeIds }`. Nothing is decided automatically.
4. **Finalization:** once nothing blocks, one unit of work:
   - cancels unfinished milestones;
   - refunds the **project escrow actually held** and **all unpaid audit escrow** to the client;
   - closes unfinished engagements;
   - marks the project cancelled, or completed if every milestone was done;
   - records `termination { finalizedAt, projectRefunded, auditRefunded, cancelledMilestoneIds, closedEngagementIds }` once.

   Asking again returns the recorded result.
5. **Re-evaluation:** an approval or verdict re-checks a pending termination after it commits, so the last blocker finishes the contract.

Paid milestones, paid audit fees and earned platform fees are never reversed. The module imports only data modules, the ledger and notifications, so milestones and disputes can call it without a cycle (the architecture test passes).

### Other W4 backend changes

| Change | Why |
| --- | --- |
| `POST /audit-reports` `expertId` optional (must match the actor) | The reviewer is the signed-in expert; the React form no longer sends identity |
| A verdict closes an unfunded arbitration engagement | Previously it stayed "preview sent" forever after the dispute was decided. Funded engagements stay open so the reviewer can file a report and be paid |
| `LOGIN_RATE_LIMIT_PER_MIN` (non-production only) | Browser suites sign in more than 10 accounts a minute. Production stays at 10. The Playwright test backend sets 100 |

## React screens

W4 pages are mapped in [`app/routes/expert-pages.tsx`](../front-end-react/src/app/routes/expert-pages.tsx), separate from the marketplace (`pages.tsx`) and staff (`staff-pages.tsx`) adapters.

| Route | Page |
| --- | --- |
| `/client/post-task` | Now offers a technical audit: pick a reviewer who covers the category and make an opening offer. The project is saved as a draft until the reviewer accepts and the fee is funded |
| `/client/audit-offers` | Client's engagements: offer history, accept or counter, fund with a two-step confirmation, coverage progress, link to reports |
| `/expert/dashboard` | Earnings balance and what needs attention: negotiations, funded work to accept, open dispute cases |
| `/expert/audit-requests` | Assigned engagements with the next step for each |
| `/expert/audit-preview/:id` | The job before accepting (project, milestones, dispute claim), fee negotiation, accept (confirm) or decline with a reason |
| `/expert/report-audit/:id` | Report for one exact milestone (submitted and not yet covered, or the disputed one): verdict, scores 0–5, assessment, findings. Shows whether coverage is complete and what was paid |
| `/expert/reports`, `/shared/reports`, `/project/:id/milestone-reports` | Reports you may read, filtered by project when the URL names one |
| `/reports/:reportId`, `/reports/audits/:reportId` | Read-only report, marked as advisory |
| `/project/:projectId/milestones/:milestoneId/disputes/new` | A party disputes the exact milestone and picks an eligible reviewer |
| `/dispute/:id`, `/expert/report-dispute/:id` | Claim, status, verdict and what it did with the money |
| `/dispute/:id/resolve` | Assigned reviewer only (registry role fixed from `superuser` to `expert`). Each verdict states its financial effect; a two-step confirmation; final |
| `/expert/disputes` | Cases assigned to you |
| `/expert/messages` | The shared messages page; reviewers can talk to the parties of the projects they review |
| `/expert-signup` (public) | Application with the applicant's own password (strength checked) and documents uploaded through the public route |
| `/admin/expert-applications` | Intake approves or rejects after confirmation; compliance is read-only. `/superuser/expert-applications` redirects here |
| `/project/:id/workroom` | Adds "End contract" (reason and two-step confirmation; shows the pending blockers or the final settlement), "Open dispute" on submitted milestones, and a link to reports |

Messages also gained engagement conversations (client/worker ↔ reviewer), and the duplicate "Messages" nav item for experts was removed.

## Evidence

| Check | Result |
| --- | --- |
| `back-end/test/expert-flow.e2e-spec.ts` (new, 6) | **A21 audited:** draft hidden from workers, counter-offer, cannot accept your own offer, only the owner funds (₹350 into audit escrow), reviewer acceptance publishes the project. **Report gate:** approval 409 without the milestone's report; first report leaves the fee pending (1 of 2); second pays ₹315 net (10% commission) once; re-filing pays nothing. **A12:** a non-party gets 403, an unhired project 409; a submitted milestone blocks; new work and revision requests are refused; approving the blocker finalizes, cancelling the unfinished milestone and refunding ₹300; a repeat returns the record. **A10:** an open dispute blocks; a client-favour verdict finalizes, refunding the ₹500 held, and closes the unfunded arbitration engagement. **A22:** an audited project ended before its last report refunds the unpaid ₹200 audit fee and closes the engagement; the expert receives nothing more |
| Mutation check | Removing the post-approval re-evaluation makes A12 fail |
| `front-end-react/src/features/disputes/expert-flow.test.tsx` (7) | Verdict needs a choice, reasoning and confirmation; refused to a non-assigned reviewer; weak application password not sent; valid application carries the chosen password and no confirm field; intake approves only after confirmation; compliance is read-only; ending a contract reports its blockers |
| `front-end-react/tests/expert.spec.ts` (Playwright, 2) | Client, worker and reviewer in separate browsers: audited draft → accept offer → fund → accept engagement → hire → submit → approval refused until the report → report → approve → dispute the second milestone → worker-favour verdict → the client sees it. Six W4 screens and the public application page have no horizontal overflow at 390px and 1280px |

### Validation performed

From `back-end/`: `npx tsc --noEmit` clean, `npm run build` passed, `npx jest --runInBand` 49/49, and `NODE_ENV=test npx jest --config ./test/jest-e2e.json --runInBand` 74/74 (this run included the W5 operations suite, which another contributor is adding).

From `front-end-react/`: `npm run build`, `npm run lint` and `npm run format:check` passed; `npm test` passed 54/54. Browser suite: see below.

The browser suite and W5 are being developed in parallel. A full run that overlapped another contributor's run (shared ports 3101/5174 and `test-results/`) produced spurious failures and was discarded. The clean rerun of `npm run test:e2e` passed **16/16** in 1.1 minutes: 10 W1 authentication journeys, 3 W5 staff journeys, the W3 marketplace journey and both W4 journeys.

## Not in W4

- **W5:** operations reviewer assignment for disputes created without a reviewer (`PATCH /operations/disputes/:id/reviewer`), and on-behalf project creation.
- **W6:** cutover.
- **Expert wallet page:** none exists in the route registry. Experts see their earnings balance on the dashboard; withdrawals can be added with the shared wallet page when a route is assigned.
