# Implementation Plan: Dashboard Observability Enhancements

**Branch**: `010-dashboard-observability` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-dashboard-observability/spec.md`

## Summary

Add four observability features to the ops dashboard: System Health Overview (P1) to monitor all system components at-a-glance, Task Pipeline Visualization (P2) to track tasks through the autonomous dev team workflow, n8n Execution Feed (P3) to monitor workflow executions in real-time, and Blob Storage Browser (P4) to inspect Azure Blob artifacts without CLI tools.

## Technical Context

**Language/Version**: TypeScript 5.5+ (Node.js 20+ backend, browser frontend)
**Primary Dependencies**:
- Backend: Express 4.21, @kubernetes/client-node 0.21, @azure/storage-blob
- Frontend: React 18.3, Vite 5.4, Tailwind CSS 3.4, Radix UI, MSAL
**Storage**: Azure Blob Storage (existing containers: agent-state, agent-spec, agent-plan, agent-verification, agent-review, agent-release)
**Testing**: Jest (backend), Vitest + Playwright (frontend)
**Target Platform**: Web application deployed to AKS (ops-dashboard namespace)
**Project Type**: Web application (backend/ + frontend/)
**Performance Goals**: <2 second page load, real-time updates within 30 seconds
**Constraints**: Must maintain Azure AD authentication, polling-based updates acceptable (no WebSockets for MVP)
**Scale/Scope**: Single-user ops team, up to 100 concurrent tasks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No constitution file exists yet - using default constraints:
- [ ] No new external dependencies without justification
- [ ] All new APIs must be authenticated via Azure AD
- [ ] Follow existing dashboard patterns (services/, api/routes/, components/)
- [ ] Maintain test coverage requirements

## Project Structure

### Documentation (this feature)

```text
specs/010-dashboard-observability/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
dashboard/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── health.ts       # Extend for system health overview
│   │   │   │   ├── storage.ts      # NEW: Blob storage browser API
│   │   │   │   ├── pipeline.ts     # NEW: Task pipeline API
│   │   │   │   └── n8n.ts          # NEW: n8n execution feed API
│   │   │   └── middleware/
│   │   ├── services/
│   │   │   ├── kubernetes.ts       # Extend for component health
│   │   │   ├── blob-storage.ts     # NEW: Azure Blob operations
│   │   │   ├── n8n-client.ts       # NEW: n8n REST API client
│   │   │   └── pipeline-state.ts   # NEW: Task state aggregation
│   │   └── types/
│   │       ├── pipeline.ts         # NEW: Task pipeline types
│   │       ├── storage.ts          # NEW: Blob storage types
│   │       └── n8n.ts              # NEW: n8n execution types
│   └── tests/
│       └── unit/
│           ├── services/
│           └── routes/
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── health-panel.tsx         # Extend for full system health
    │   │   ├── pipeline-board.tsx       # NEW: Kanban pipeline view
    │   │   ├── execution-feed.tsx       # NEW: n8n execution feed
    │   │   ├── storage-browser.tsx      # NEW: Blob storage browser
    │   │   └── ui/                      # Shared UI components
    │   ├── hooks/
    │   │   ├── use-health.ts            # Extend for component health
    │   │   ├── use-pipeline.ts          # NEW: Pipeline state hook
    │   │   ├── use-executions.ts        # NEW: n8n executions hook
    │   │   └── use-storage.ts           # NEW: Blob storage hook
    │   ├── pages/
    │   │   └── dashboard.tsx            # Update layout with new panels
    │   └── services/
    │       └── api.ts                   # Extend with new endpoints
    └── tests/
        ├── unit/
        └── e2e/
```

**Structure Decision**: Extending existing web application structure in `dashboard/`. New services and routes follow existing patterns from kubernetes.ts and health.ts.

## Complexity Tracking

No constitution violations - this feature extends existing patterns without introducing new architectural layers.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| No WebSockets | Polling-based updates | Simplifies deployment, meets 30s update requirement |
| Single dashboard page | Tab/panel navigation | Matches existing UX, avoids routing complexity |
| Azure SDK for storage | Direct blob access | Workload identity already configured |
