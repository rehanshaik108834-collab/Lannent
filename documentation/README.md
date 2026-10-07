# Lannent Documentation

Status: W0–W5 delivered; React functional cutover is implemented in W6, with passing functional evidence and remaining backend lint debt documented in [report 17](17-w6-cutover.md). Earlier implementation reports are historical checkpoints.

Lannent connects clients and gig workers through projects, milestone delivery, escrow, and expert review. Operations, revenue, intake, and compliance staff have separate responsibilities.

## Goal

Replace the entire static frontend with React and TypeScript; preserve familiar screens and legitimate workflows; make frontend and NestJS backend code modular and understandable; fix integration, authorization, financial, and workflow defects. Keep in-memory repositories. Adopt INR as the single currency when implementing the migration.

## Reading order

| Document | Read it to understand |
| --- | --- |
| [Current state and defects](01-current-state-and-defects.md) | What exists, evidence behind findings, and priority corrections |
| [Workflows and permissions](02-workflows-and-permissions.md) | Actors, business rules, project lifecycle, disputes, and termination |
| [React architecture](03-react-architecture.md) | Feature ownership, components, routing, state, API access, and styles |
| [Backend architecture](04-backend-architecture.md) | Dependency direction, repositories, use cases, and atomic operations |
| [API and data contracts](05-api-and-data-contracts.md) | Existing interfaces, planned changes, errors, statuses, files, and INR |
| [Migration roadmap](06-migration-roadmap.md) | Ordered work and the destination of every legacy screen |
| [Testing and acceptance](07-testing-and-acceptance.md) | Required regression scenarios and completion gates |
| [Contributor onboarding](08-contributor-onboarding.md) | Running today's project and contributing to the planned architecture |
| [Decisions and deferred features](09-decisions-and-deferred-features.md) | Agreed product decisions, implementation defaults, and exclusions |

New contributors should start with onboarding, workflows, and the architecture document for their area. Migration implementers should read the defect register and contracts before changing behavior.

## Next work

[Codex: next steps and remaining work](codex_next_steps_and_remaining_work.md) records the latest verification checkpoint, the default browser-runner fix, backend quality debt, final acceptance work, and separately deferred integrations.

## Implementation progress

[W1 implementation report](10-w1-implementation.md) records delivered code, defect coverage, validation, and the next wave. The [W2 implementation report](11-w2-implementation.md) does the same for backend authorization, atomic settlement and INR, including the API contract changes frontend work must use. The [D10–D12 report](12-d10-d12-implementation.md) covers the profile contract, intake file access, and atomic expert approval.

The [W2 structural report](13-w2-structure.md) covers typed records, repository ownership, core/data module dependencies, ledger operations, and combined validation. Earlier reports are historical checkpoints; use this report for the subsequent structural state. The [W3 report](14-w3-implementation.md) covers the React marketplace screens, atomic project creation, and their evidence. The [W4 report](15-w4-implementation.md) covers the expert screens, contract termination, and their evidence.

[W5 staff/supporting flows](16-w5-implementation.md) and [W6 cutover](17-w6-cutover.md) describe current runtime, verification, and remaining quality limits.

## Repository map

Paths in this documentation are relative to the Git repository, `40_Lannent/`.

- `legacy/front-end/`: archived static application and workflow reference; never served.
- `front-end-react/`: active React/TypeScript application and built frontend.
- `back-end/`: NestJS REST API, in-memory repositories, seed fixtures, and tests.
- `Database/`: SQL design references; these are not the running storage layer.
- `Figma Designs/`: design reference.
- `documentation/`: this specification and future maintenance guides.

The enclosing workspace's `AGENTS.md` is an existing contributor guide and must remain unchanged by this documentation work.

## Terminology

| Term | Meaning |
| --- | --- |
| Project / task | A client-funded engagement; existing API paths and stored records use `tasks` and `taskId` |
| Milestone | A budgeted piece of project work, submitted and settled independently |
| Project escrow | Money held for worker milestone payments |
| Audit escrow | Separate money held for an expert engagement |
| Technical audit | Expert assessment; the client still decides deliverable acceptance |
| Dispute audit | Expert assessment and arbitration of a contested milestone |
| Actor | The authenticated account performing an operation, established by the server |
| Use case | A named operation that validates permissions and coordinates domain changes |
| Target | Intended behavior after implementation; not a claim about current code |

## Maintaining these documents

Keep current observations separate from intended behavior. Link a defect to its correction and regression test. Update contracts, workflows, and onboarding in the same pull request as the corresponding implementation. Mark roadmap work complete only after its acceptance criteria pass.

The initial analysis used source inspection. Dependencies were subsequently installed and baseline/final builds and tests were run for W1; results are recorded in the implementation report. The SRS PDF and videos were not audited. Existing Markdown explanations and source code informed this specification; the decisions document resolves changes agreed with the project owner.
