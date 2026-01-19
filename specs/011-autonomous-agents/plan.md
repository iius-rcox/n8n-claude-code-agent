# Implementation Plan: Autonomous Dev Team Agents - Production Ready

**Branch**: `011-autonomous-agents` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-autonomous-agents/spec.md`

## Summary

Build a production-ready autonomous development team consisting of four specialized Claude agents (PM, Dev, QA, Reviewer) orchestrated through n8n workflows. The system accepts feature requests via web form, creates specifications, implements code, verifies quality, reviews changes, and merges PRs with minimal human intervention. The infrastructure layer (Claude HTTP API, Azure Blob storage, Kubernetes deployment) is ~70% complete; this plan focuses on building the n8n orchestration layer and connecting all components.

## Technical Context

**Language/Version**: Node.js 20+ (existing), n8n workflows (JSON/YAML)
**Primary Dependencies**: n8n (workflow orchestration), Azure Blob SDK, GitHub REST API, Teams Webhooks
**Storage**: Azure Blob Storage (iiusagentstore) - 6 containers configured
**Testing**: Jest (80%+ coverage), BATS (shell scripts), n8n workflow testing via manual execution
**Target Platform**: Azure Kubernetes Service (dev-aks), private cluster
**Project Type**: Multi-component (n8n workflows + existing Node.js infrastructure)
**Performance Goals**: 10 concurrent tasks, <2 hours for simple features, <30s escalation trigger
**Constraints**: 80KB context budget per agent, 5-minute execution timeout, blob lease conflicts
**Scale/Scope**: Single AKS cluster, 4 agent types, 6 pipeline phases, 15 n8n workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution template is not yet customized for this project. Applying general software engineering principles:

| Principle | Status | Notes |
|-----------|--------|-------|
| **Modularity** | ✅ PASS | Each workflow is independent, agents are specialized |
| **Testability** | ✅ PASS | Each workflow can be tested in isolation |
| **Observability** | ✅ PASS | Task envelope tracks all state, dashboard for monitoring |
| **Error Handling** | ✅ PASS | Bounded retries, circuit breaker, escalation paths |
| **Security** | ✅ PASS | GitHub App auth, prompt injection guards, security review gate |

No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/011-autonomous-agents/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── task-envelope-schema.yaml
│   ├── agent-runner-api.yaml
│   ├── blob-state-api.yaml
│   └── schema-versioning.md    # Phase 2.5 output
├── checklists/
│   └── requirements.md  # Quality checklist (complete)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Existing Infrastructure (complete)
infra/
├── docker/
│   ├── server.js           # Claude HTTP API wrapper
│   ├── check-auth.sh       # Auth watchdog script
│   └── notify.sh           # Teams notification script
└── k8s/
    ├── deployment.yaml     # Claude agent deployment
    ├── cronjob.yaml        # Auth watchdog CronJob
    └── ...

dashboard/
├── backend/                # Express API for ops-dashboard
└── frontend/               # React dashboard UI

# New Components (to be built)
n8n-workflows/              # NEW: n8n workflow definitions
├── stage-1/
│   ├── feature-request-form.json
│   ├── blob-state-manager.json
│   └── agent-runner.json
├── stage-2/
│   ├── pm-intake.json
│   ├── pm-planning.json
│   └── pm-tasks.json
├── stage-3/
│   ├── dev-implementation.json
│   └── dev-release.json
├── stage-4/
│   ├── qa-verification.json
│   ├── reviewer.json
│   └── feedback-router.json
└── stage-5/
    ├── master-orchestrator.json
    ├── human-checkpoint.json
    ├── task-recovery.json
    └── notification-hub.json

schemas/                    # NEW: JSON schemas for validation
├── task-envelope.schema.json
├── spec-output.schema.json
├── verification-report.schema.json
└── review-feedback.schema.json

agent-prompts/              # NEW: System prompts for each agent role
├── pm-agent.md
├── dev-agent.md
├── qa-agent.md
└── reviewer-agent.md
```

**Structure Decision**: Multi-component structure with n8n workflows stored as JSON files in `n8n-workflows/` directory, organized by implementation stage. This allows version control of workflows and staged rollout.

## Complexity Tracking

> No Constitution violations requiring justification.

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| 4 agent types | Each has distinct expertise and prompt optimization | Single generalist agent - rejected due to prompt pollution |
| 15 n8n workflows | Modular, testable, reusable sub-workflows | Monolithic workflow - rejected due to complexity |
| Blob storage for state | Already deployed, lease mechanism for concurrency | Database - rejected as over-engineering |

---

## Phase Status

| Phase | Status | Artifacts |
|-------|--------|-----------|
| Phase 0: Research | ✅ Complete | [research.md](./research.md) |
| Phase 1: Design | ✅ Complete | [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md) |
| Phase 2: Tasks | ✅ Complete | [tasks.md](./tasks.md) |
| Phase 2.5: Spec Enhancement | ✅ Complete | Gap analysis remediation (see below) |
| Phase 3: Implementation | ⏳ Pending | n8n workflows, schemas, prompts |

### Phase 2.5: Specification Gap Remediation

Following `/speckit.analyze`, the specification was enhanced to address identified gaps:

| Gap | Resolution | Added To |
|-----|------------|----------|
| Missing NFRs | Added 17 NFRs covering availability, latency, durability, scalability | spec.md §NFRs |
| No security model | Added 22 security requirements (SEC-001 to SEC-022) | spec.md §Security |
| Underspecified state machine | Formalized transition guards, idempotency semantics, recovery points | data-model.md §3.4-3.6 |
| Missing observability plan | Added 15 observability requirements (metrics, logging, alerting) | spec.md §Observability |
| Unrealistic success criteria | Rewritten with measurement sources, constraints, and realistic targets | spec.md §Success Criteria |
| No schema versioning | Created comprehensive versioning strategy | contracts/schema-versioning.md |
| Ambiguous clarification flow | Documented resolution flow with Teams integration | spec.md §Operational Procedures |
| PR merge strategy unclear | Defined squash merge, gates, post-merge actions | spec.md §PR Merge Strategy |
| Review responsibilities ambiguous | Added QA vs Reviewer comparison table | spec.md §Review Agent Responsibilities |
| No cost controls | Added 9 cost requirements (COST-001 to COST-009) | spec.md §Cost Controls |
| Schema missing versions | Updated task-envelope-schema.yaml with v1.1.0 metadata | contracts/task-envelope-schema.yaml |

---

## Phase 0: Research Findings

**Status**: ✅ Complete

See [research.md](./research.md) for detailed findings on:
- n8n workflow patterns for Claude integration (HTTP Request node, exit code routing)
- GitHub App token minting implementation (JWT creation, token exchange)
- Azure Blob lease management patterns (acquire/release/break)
- Teams Adaptive Card format for human checkpoints
- Context management strategies (80KB budget allocation)
- n8n sub-workflow patterns (error handling, data flow)

## Phase 1: Design Artifacts

**Status**: ✅ Complete

Generated artifacts:
- [data-model.md](./data-model.md) - Entity definitions, state machine, storage layout
- [contracts/task-envelope-schema.yaml](./contracts/task-envelope-schema.yaml) - JSON Schema for task state
- [contracts/agent-runner-api.yaml](./contracts/agent-runner-api.yaml) - OpenAPI spec for Claude HTTP API
- [contracts/blob-state-api.yaml](./contracts/blob-state-api.yaml) - Sub-workflow contract for blob operations
- [quickstart.md](./quickstart.md) - Developer setup and testing guide

## Phase 2: Task Generation

**Status**: ✅ Complete

See [tasks.md](./tasks.md) for 190 implementation tasks organized across 12 phases:

| Phase | Focus | Tasks | Workflows |
|-------|-------|-------|-----------|
| 1 | Setup | 9 | - |
| 2 | Foundational (Stage 1) | 28 | 3 |
| 3-6 | P1 Stories (US1-US4) | 60 | 7 |
| 7-8 | P2 Quality (US5-US6) | 36 | 3 |
| 9-10 | P2 Resilience (US7-US8) | 30 | 3 |
| 11 | P3 Dashboard (US9) | 14 | - |
| 12 | Polish | 13 | - |

**MVP Path**: Phases 1-6 deliver end-to-end task completion (spec → PR merged)

**Implementation Order**:
1. **Stage 1**: Foundation (Form Trigger, Blob State Manager, Agent Runner)
2. **Stage 2**: PM Agent (Intake, Planning, Tasks workflows)
3. **Stage 3**: Dev Agent (Implementation, Release workflows)
4. **Stage 4**: Quality Agents (QA Verification, Reviewer, Feedback Router)
5. **Stage 5**: Orchestration (Master Orchestrator, Human Checkpoint, Recovery)
