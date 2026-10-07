# Migration Roadmap

Status: W0–W5 delivered. W6 functional React serving/legacy compatibility is implemented; see [cutover evidence and remaining quality limits](17-w6-cutover.md). W5 evidence is in [report 16](16-w5-implementation.md); W4 was completed by Claude in [report 15](15-w4-implementation.md).

## Ordered waves

| Wave | Deliverable | Dependencies and exit criteria |
| --- | --- | --- |
| W0: Analysis and documentation | Inventory, defect register, agreed behavior, contracts, screen mapping, acceptance specification | Complete: documentation and runtime baseline recorded; account-validation regressions reproduced before correction |
| W1: React foundation | TypeScript, transport, proxy, validated auth, route registry, shells, public pages, unavailable recovery, test tooling | Complete: D01–D03/D14 regression coverage; seven-role login/refresh/logout; public/auth screens implemented |
| W2: Backend foundation | Typed records/actors, leaf data modules, policy helpers, shared app setup, ledger decomposition, in-memory UoW, INR | Complete: D04–D09/D15/D16 regression coverage; ledger invariants preserved; no browser writes to balances or financial history. Structural deliverables implemented: typed records/actor, leaf/core modules, ledger operation classes; 49 unit/46 HTTP tests pass; see report 13 |
| W3: Marketplace vertical flow | Create project, discovery, proposals/invitations, hiring, workroom, messages, milestones, deliverables, approval, wallets | Complete: unaudited create → hire → submit → approve → payout passes through the API and in the browser, with ownership/rollback tests; audited path is W4 |
| W4: Expert vertical flow | Applications/files/intake, audit negotiation/funding, exact-milestone reports, disputes/rework, termination | Complete: audited project, report-gated approval, verdicts and termination (A10/A12/A21/A22) pass through the API; audited path and a dispute verdict pass in the browser; D11/D12 fixed |
| W5: Supporting/staff flows | Operations, revenue/fee settings, compliance, analytics, settings, on-behalf creation | Delivered: separate staff duties, operations actions, settings/analytics/notifications; 13 staff HTTP and 3 browser cases pass; see report 16 |
| W6: Cutover | React build serving, deep-link fallback, legacy redirect resolver, placeholder removal, legacy retirement | Functional cutover delivered: React serving, 58 legacy mappings, no pending pages/runtime globals; strict whole-backend lint debt remains; see report 17 |

Keep screens in W3 that need expert data incremental: complete the unaudited path in W3 and integrate audited behavior in W4. Test each vertical flow before marking it complete. Do not make a placeholder look complete through static mock data.

## Task definition and ownership

Each implementation task needs one accountable contributor, a domain boundary, linked defect/contract/acceptance IDs, dependencies, and a demonstrable behavior result. Assign work by feature/use case, not by splitting one giant routing or store file between people. This is an assignment convention, not authorization to spawn agents or automatically delegate work.

Use a checklist in each task: contract and behavior specified; regression scenario added; implementation complete; relevant checks pass; documentation updated. Keep independent changes small. Record new findings in the defect register rather than silently expanding scope.

## Legacy screen mapping

The table reconciles all **58** legacy HTML files. Destinations are target routes, not proof those React pages exist. Unless noted otherwise, retain the scaffold's stable URL. `:id` has the meaning described in each row. Grouped/retired screens still need redirect and permission tests.

| Archived source under legacy/front-end/ | React destination | Behavior / consolidation | Wave |
| --- | --- | --- | --- |
| [index.html](../legacy/front-end/index.html) | `/` | Public landing; preserve calls to signup/login | W1 |
| [pages/404.html](../legacy/front-end/pages/404.html) | `*` | Not-found page | W1 |
| [pages/admin-dashboard.html](../legacy/front-end/pages/admin-dashboard.html) | `/admin/revenue` | Merge redundant revenue-admin dashboard | W5 |
| [pages/admin-expert-applications.html](../legacy/front-end/pages/admin-expert-applications.html) | `/admin/expert-applications` | Intake editor; compliance read-only | W4 |
| [pages/admin-fee-config.html](../legacy/front-end/pages/admin-fee-config.html) | `/admin/fee-config` | Revenue-only fee editing | W5 |
| [pages/admin-revenue.html](../legacy/front-end/pages/admin-revenue.html) | `/admin/revenue` | Revenue/compliance analytics | W5 |
| [pages/analytics.html](../legacy/front-end/pages/analytics.html) | `/client/analytics` | Own-client project insights; separate from staff aggregates | W5 |
| [pages/browse-tasks.html](../legacy/front-end/pages/browse-tasks.html) | `/worker/browse` | Open-project discovery | W3 |
| [pages/client-audit-offers.html](../legacy/front-end/pages/client-audit-offers.html) | `/client/audit-offers` | Own audit negotiations and funding | W4 |
| [pages/client-dashboard.html](../legacy/front-end/pages/client-dashboard.html) | `/client/dashboard` | Client overview | W3 |
| [pages/client-my-projects.html](../legacy/front-end/pages/client-my-projects.html) | `/client/projects` | Own projects; safe deletion/termination | W3 |
| [pages/client-wallet.html](../legacy/front-end/pages/client-wallet.html) | `/client/wallet` | Own INR balance/history | W3 |
| [pages/compliance-dashboard.html](../legacy/front-end/pages/compliance-dashboard.html) | `/admin/compliance` | Read-only compliance trail | W5 |
| [pages/dispute.html](../legacy/front-end/pages/dispute.html) | `/project/:projectId/milestones/:milestoneId/disputes/new` | Dispute creation for a real milestone | W4 |
| [pages/expert-audit-preview.html](../legacy/front-end/pages/expert-audit-preview.html) | `/expert/audit-preview/:id` | Assigned audit preview; id is engagement ID | W4 |
| [pages/expert-audit-requests.html](../legacy/front-end/pages/expert-audit-requests.html) | `/expert/audit-requests` | Assigned negotiations/engagements | W4 |
| [pages/expert-dashboard.html](../legacy/front-end/pages/expert-dashboard.html) | `/expert/dashboard` | Expert overview | W4 |
| [pages/expert-dispute-cases.html](../legacy/front-end/pages/expert-dispute-cases.html) | `/expert/disputes` | Assigned arbitration cases | W4 |
| [pages/expert-landing.html](../legacy/front-end/pages/expert-landing.html) | `/expert-landing` | Public expert information | W1 |
| [pages/expert-login.html](../legacy/front-end/pages/expert-login.html) | `/expert-login` | Shared login form with expert context | W1 |
| [pages/expert-messages.html](../legacy/front-end/pages/expert-messages.html) | `/expert/messages` | Shared messaging with expert scope | W4 |
| [pages/expert-report-audit.html](../legacy/front-end/pages/expert-report-audit.html) | `/expert/report-audit/:id or /reports/audits/:reportId` | Expert editor by engagement; participant viewer by report | W4 |
| [pages/expert-report-dispute.html](../legacy/front-end/pages/expert-report-dispute.html) | `/expert/report-dispute/:id` | Read-only dispute report; id is dispute ID; assigned/party viewers | W4 |
| [pages/expert-reports.html](../legacy/front-end/pages/expert-reports.html) | `/expert/reports` | Own engagement/report list | W4 |
| [pages/expert-settings.html](../legacy/front-end/pages/expert-settings.html) | `/settings/expert` | Persist expert profile/preferences | W5 |
| [pages/expert-signup.html](../legacy/front-end/pages/expert-signup.html) | `/expert-signup` | Expert application, not immediate expert account | W4 |
| [pages/forgot-password.html](../legacy/front-end/pages/forgot-password.html) | `/forgot-password` | Honest unavailable recovery state | W1 |
| [pages/hire-gig-workers.html](../legacy/front-end/pages/hire-gig-workers.html) | `/client/hire` | Directory and invitations | W3 |
| [pages/login.html](../legacy/front-end/pages/login.html) | `/login` | Shared token login | W1 |
| [pages/messages.html](../legacy/front-end/pages/messages.html) | `/shared/messages` | Participant-scoped messaging | W3 |
| [pages/milestone-reports.html](../legacy/front-end/pages/milestone-reports.html) | `/project/:projectId/milestone-reports or /shared/reports` | Project report list or permitted cross-project index | W4 |
| [pages/my-proposals.html](../legacy/front-end/pages/my-proposals.html) | `/worker/proposals` | Own proposals | W3 |
| [pages/performance-analytics.html](../legacy/front-end/pages/performance-analytics.html) | `/worker/analytics` | Own worker performance; /analytics remains compatibility alias | W5 |
| [pages/post-task.html](../legacy/front-end/pages/post-task.html) | `/client/post-task` | Atomic project/milestone creation | W3 |
| [pages/profile-settings.html](../legacy/front-end/pages/profile-settings.html) | `/settings/profile` | Client profile/company settings | W5 |
| [pages/project-milestone-board.html](../legacy/front-end/pages/project-milestone-board.html) | `/project/:id/milestone-board` | Shared board with client capabilities | W3 |
| [pages/project-workroom.html](../legacy/front-end/pages/project-workroom.html) | `/project/:id/workroom` | Shared participant workroom | W3 |
| [pages/resolve-dispute.html](../legacy/front-end/pages/resolve-dispute.html) | `/dispute/:id/resolve` | Assigned reviewer only; id is dispute ID | W4 |
| [pages/review-deliverable.html](../legacy/front-end/pages/review-deliverable.html) | `/project/:projectId/milestones/:milestoneId/review` | Exact milestone review; client approval, assigned-expert read view | W3 |
| [pages/signup.html](../legacy/front-end/pages/signup.html) | `/signup` | Client/worker signup only | W1 |
| [pages/staff-settings.html](../legacy/front-end/pages/staff-settings.html) | `/settings/staff` | Own staff profile; identity read-only | W5 |
| [pages/submit-deliverable.html](../legacy/front-end/pages/submit-deliverable.html) | `/project/:projectId/milestones/:milestoneId/submit` | Assigned-worker submission | W3 |
| [pages/superuser-create-task.html](../legacy/front-end/pages/superuser-create-task.html) | `/superuser/create-task` | Explicit on-behalf client selection; no impersonation | W5 |
| [pages/superuser-dashboard.html](../legacy/front-end/pages/superuser-dashboard.html) | `/superuser/dashboard` | Operations overview | W5 |
| [pages/superuser-disputes.html](../legacy/front-end/pages/superuser-disputes.html) | `/superuser/disputes` | Operational read/assignment context; no expert verdict controls | W5 |
| [pages/superuser-escrow.html](../legacy/front-end/pages/superuser-escrow.html) | `/superuser/escrow` | Operations-authorized escrow overview | W5 |
| [pages/superuser-expert-applications.html](../legacy/front-end/pages/superuser-expert-applications.html) | `/admin/expert-applications` | Retire duplicate; superuser receives forbidden state under separate duties | W5 |
| [pages/superuser-tasks.html](../legacy/front-end/pages/superuser-tasks.html) | `/superuser/tasks` | Operational task management | W5 |
| [pages/superuser-users.html](../legacy/front-end/pages/superuser-users.html) | `/superuser/users` | User/status/staff administration | W5 |
| [pages/task-details.html](../legacy/front-end/pages/task-details.html) | `/tasks/:id` | Authorized task detail; id is task ID | W3 |
| [pages/worker-applications.html](../legacy/front-end/pages/worker-applications.html) | `/client/applications` | Own projects proposal review | W3 |
| [pages/worker-dashboard.html](../legacy/front-end/pages/worker-dashboard.html) | `/worker/dashboard` | Worker overview | W3 |
| [pages/worker-invitations.html](../legacy/front-end/pages/worker-invitations.html) | `/worker/invitations` | Own invitation acceptance/decline | W3 |
| [pages/worker-milestone-board.html](../legacy/front-end/pages/worker-milestone-board.html) | `/project/:id/milestone-board` | Merge shared board with worker capabilities | W3 |
| [pages/worker-my-projects.html](../legacy/front-end/pages/worker-my-projects.html) | `/worker/projects` | Assigned projects | W3 |
| [pages/worker-settings.html](../legacy/front-end/pages/worker-settings.html) | `/settings/worker` | Persist worker profile/professional/portfolio data | W5 |
| [pages/worker-wallet.html](../legacy/front-end/pages/worker-wallet.html) | `/worker/wallet` | Shared wallet UI with own-worker scope | W3 |
| [pages/worker-workroom.html](../legacy/front-end/pages/worker-workroom.html) | `/project/:id/workroom` | Merge shared participant workroom | W3 |

## Route compatibility rules

- Preserve scaffold role routes; add `/dashboard`, client/worker analytics, report viewing, and exact project/milestone action routes described above. `/admin/analytics` is financial oversight for revenue/compliance, not the legacy client's insights page.
- On workroom/board/task links, translate legacy `id` to the project/task ID. On submission/review links, `milestoneId` or legacy `id` denotes the milestone; resolve its task, validate any supplied `taskId`, and use both IDs in the target path.
- On resolve/report-dispute links, `disputeId` or `id` denotes the dispute. On audit preview/editor links, `id` denotes the engagement; `reportId` denotes a report and must be resolved separately. Preserve `milestoneId` when editing an exact milestone report.
- A reports index with `taskId` maps to that project's report list; without it, show only the viewer's permitted report index. Ignore legacy `role` query parameters for authority.
- Legacy dispute creation may provide `disputeTargetMilestone` in localStorage; review may provide `selectedMilestone`. Use only a validated ID as a temporary compatibility input, never the object's budget/owner/role. The target React flows pass route IDs and stop creating these global selections.
- Existing scaffold submission/review paths containing only project ID become aliases. Resolve an explicitly supplied milestone query ID or show a selection list of permitted eligible milestones; do not auto-select the first record.
- Missing or ambiguous resource identifiers show an actionable error. Expired identity sends the user through validated login before resolving private resources.
- Use ordinary permission guards for all redirects. A formerly exposed unauthorized button is removed, not recreated as a permission loophole.

## Cutover procedure

1. Build React and NestJS and verify the public/index asset paths with the actual output.
2. Change backend static serving to the React build. Restore appropriate security headers for served HTML; its CSP must match actual assets instead of relying on legacy inline scripts/CDNs.
3. Register `/pages/*.html` and `/index.html` compatibility resolution before the SPA fallback. Fetch/resolve IDs through authorized APIs when necessary.
4. Serve the React entry only for known/unknown client document routes. API errors, Swagger, file requests, and missing JS/CSS/image assets must never return index HTML.
5. Verify deep-link refresh, old links, unknown routes, and all role dashboards. Capture visual comparison at desktop and narrow widths for each screen family.
6. Remove placeholder components and all runtime references to legacy globals. Retire static runtime files only after acceptance; keep Git history and the completed mapping as reference.
7. Update root README/setup instructions and this documentation. Do not overwrite the pre-existing workspace AGENTS.md.

## Completion tracking

W0–W5 reports contain delivered implementation and checks; W6 separates verified functional cutover from outstanding strict backend lint/format debt. No pull request or commit was created. The mapping above records every legacy destination and consolidation/retirement outcome. `cutover.test.ts` verifies all 58 mappings and all 55 implemented registry renderers; the built-server route inventory visits every canonical portal route with an allowed seeded role. Wave reports 10 and 14–17 provide workflow evidence for each family. Resource-specific legacy scenarios cover preserved sign-in destinations and exact milestone/project identity; this is not a claim that every legacy query-string combination was exercised in a browser. A successful build alone does not establish workflow parity.
