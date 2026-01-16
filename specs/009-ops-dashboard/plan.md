# Implementation Plan: Operations Dashboard

**Branch**: `009-ops-dashboard` | **Date**: 2026-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-ops-dashboard/spec.md`

## Summary

Build an operations dashboard for Claude agent management deployed in AKS. The dashboard provides system health monitoring, one-click token refresh via CLI push, manual agent execution, execution history viewing, and CronJob management. Frontend uses React + shadcn/ui; backend uses Node.js with in-cluster Kubernetes API access. Authentication via Azure AD SSO with group-based access control.

## Technical Context

**Language/Version**: Node.js 20 LTS (backend), TypeScript 5.x (frontend/backend)
**Primary Dependencies**: React 18, shadcn/ui, @azure/msal-react (auth), @kubernetes/client-node (K8s API)
**Storage**: In-memory for session state; execution history from n8n API or K8s events
**Testing**: Jest (unit), Playwright (E2E), React Testing Library (components)
**Target Platform**: AKS (Linux containers), modern browsers (Chrome, Edge, Firefox)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Health status visible within 5 seconds, token refresh under 2 minutes
**Constraints**: Must run in-cluster, Azure AD group restriction, no persistent database required
**Scale/Scope**: Single operator use, internal operations team (~5-10 users)

## Implementation Approach

**Type**: Hybrid

**Rationale**: The dashboard is a persistent web application (needs scripts for deployment, health checks, CI/CD) but initial AKS setup is one-time (runbook). Per Constitution VI, we script the repeatable parts (container build, deployment manifests, API endpoints) and document one-time setup in quickstart.md.

**Artifacts**:
- **Scripts**: Dockerfile, K8s manifests, backend API server, frontend build
- **Runbook**: Azure AD app registration, security group setup, initial deployment in quickstart.md

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Spec-First Development | PASS | spec.md completed with measurable success criteria |
| II. Security by Default | PASS | Azure AD SSO + group restriction, in-cluster service account, no hardcoded secrets |
| III. Phase Gates | PASS | Following specify → plan → tasks → implement sequence |
| IV. Infrastructure as Code | PASS | K8s manifests version-controlled, semantic versioning for images |
| V. Automation & Observability | PASS | Health endpoint required, graceful shutdown, Teams integration |
| VI. Pragmatic Automation | PASS | Hybrid approach: scripts for repeated tasks, runbook for one-time setup |

**Network Security**:
- Dashboard namespace will have default-deny NetworkPolicy
- Explicit ingress from authorized sources only
- TLS termination at ingress

**Identity & Access**:
- Azure AD SSO with MSAL
- Group-based authorization
- Service account for K8s API access (in-cluster)
- CLI push endpoint secured with session tokens

**Container Security**:
- Non-root execution
- Read-only root filesystem
- Drop all capabilities
- Seccomp RuntimeDefault

## Project Structure

### Documentation (this feature)

```text
specs/009-ops-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI spec)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
dashboard/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── k8s.ts
│   │   │   │   ├── claude.ts
│   │   │   │   └── credentials.ts
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       └── error.ts
│   │   ├── services/
│   │   │   ├── kubernetes.ts
│   │   │   ├── claude-agent.ts
│   │   │   └── token-refresh.ts
│   │   └── index.ts
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── health-panel.tsx
│   │   │   ├── token-refresh.tsx
│   │   │   ├── agent-executor.tsx
│   │   │   ├── execution-history.tsx
│   │   │   └── cronjob-panel.tsx
│   │   ├── pages/
│   │   │   └── dashboard.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── hooks/
│   │   │   └── use-health.ts
│   │   ├── lib/
│   │   │   └── msal-config.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   ├── unit/
│   │   └── e2e/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
│
├── infra/
│   └── k8s/
│       ├── namespace.yaml
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── serviceaccount.yaml
│       ├── rbac.yaml
│       └── networkpolicy.yaml
│
└── cli/
    └── push-credentials.ps1    # CLI script for operators
```

**Structure Decision**: Web application with separate frontend (React SPA) and backend (Node.js API). The `dashboard/` directory keeps this feature isolated from existing `infra/` code. CLI script provided for credential push workflow.

## Complexity Tracking

> No Constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
