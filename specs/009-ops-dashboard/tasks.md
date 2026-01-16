# Tasks: Operations Dashboard

**Input**: Design documents from `/specs/009-ops-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml

**Tests**: Tests are optional - not explicitly requested in spec. Included as minimal coverage for critical paths.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Implementation Approach

**Type**: Hybrid (per plan.md)

- **Scripts**: Dockerfile, K8s manifests, backend API server, frontend build
- **Runbook**: Azure AD app registration, security group setup in quickstart.md

## Path Conventions

Based on plan.md project structure:
- Backend: `dashboard/backend/src/`
- Frontend: `dashboard/frontend/src/`
- Infrastructure: `dashboard/infra/k8s/`
- CLI: `dashboard/cli/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create directory structure per plan.md (`dashboard/backend/`, `dashboard/frontend/`, `dashboard/infra/k8s/`, `dashboard/cli/`)
- [x] T002 Initialize backend Node.js project in `dashboard/backend/package.json` with TypeScript, Express, @kubernetes/client-node
- [x] T003 [P] Initialize frontend Vite+React project in `dashboard/frontend/package.json` with TypeScript, @azure/msal-react
- [x] T004 [P] Configure TypeScript in `dashboard/backend/tsconfig.json` and `dashboard/frontend/tsconfig.json`
- [x] T005 [P] Configure ESLint and Prettier in both backend and frontend
- [x] T006 Install and configure shadcn/ui in `dashboard/frontend/` (Card, Table, Badge, Button, Input, Textarea, Progress, Skeleton, Alert)

**Checkpoint**: Project scaffolding complete, can run `npm install` in both directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation

- [x] T007 Create Express app entry point in `dashboard/backend/src/index.ts` with SIGTERM handler, connection draining, and graceful shutdown (per Constitution V)
- [x] T007a [P] Add /health and /ready endpoints in `dashboard/backend/src/api/routes/health.ts` for backend liveness/readiness probes (returns 200 OK, distinct from /api/health which monitors Claude agent)
- [x] T008 Create Azure AD JWT validation middleware in `dashboard/backend/src/api/middleware/auth.ts`
- [x] T009 [P] Create group membership check in `dashboard/backend/src/api/middleware/auth.ts` (AUTHORIZED_GROUP_ID)
- [x] T010 [P] Create error handling middleware in `dashboard/backend/src/api/middleware/error.ts`
- [x] T011 Create Kubernetes client service in `dashboard/backend/src/services/kubernetes.ts` (loadFromDefault, CoreV1Api, AppsV1Api, BatchV1Api)
- [x] T012 Create environment configuration in `dashboard/backend/src/config.ts` (AZURE_AD_*, CLAUDE_AGENT_*, PORT, HEALTH_POLL_INTERVAL_MS)
- [x] T013 [P] Create API router structure in `dashboard/backend/src/api/routes/index.ts`

### Frontend Foundation

- [x] T014 Configure MSAL in `dashboard/frontend/src/lib/msal-config.ts` per research.md
- [x] T015 Create MsalProvider wrapper in `dashboard/frontend/src/App.tsx`
- [x] T016 [P] Create authenticated route guard component in `dashboard/frontend/src/components/auth-guard.tsx`
- [x] T017 [P] Create API client with bearer token in `dashboard/frontend/src/services/api.ts`
- [x] T018 Create dashboard layout component in `dashboard/frontend/src/pages/dashboard.tsx` (2x2 grid + full-width cards)

### Infrastructure Foundation

- [x] T019 Create Kubernetes namespace manifest in `dashboard/infra/k8s/namespace.yaml`
- [x] T020 [P] Create ServiceAccount manifest in `dashboard/infra/k8s/serviceaccount.yaml`
- [x] T021 [P] Create RBAC (Role + RoleBinding) manifests in `dashboard/infra/k8s/rbac.yaml` per quickstart.md
- [x] T022 [P] Create NetworkPolicy manifests in `dashboard/infra/k8s/networkpolicy.yaml` (default-deny, allow-dns, allow-azure-ad, allow-ingress, allow-claude-agent)

**Checkpoint**: Foundation ready - auth works, K8s client connects, dashboard layout renders

---

## Phase 3: User Story 1 - Token Refresh Workflow (Priority: P1) MVP

**Goal**: One-click token refresh via CLI push script that eliminates manual kubectl commands

**Independent Test**: Click "Refresh Tokens", run CLI command locally, verify full refresh sequence completes

### Backend Implementation for US1

- [x] T023 [US1] Create TokenRefreshOperation entity types in `dashboard/backend/src/types/token-refresh.ts` per data-model.md
- [x] T024 [US1] Create in-memory operation store in `dashboard/backend/src/services/token-refresh.ts` (active operations map)
- [x] T025 [US1] Implement POST /api/credentials/refresh endpoint in `dashboard/backend/src/api/routes/credentials.ts` (creates operation, returns CLI command)
- [x] T026 [US1] Implement POST /api/credentials/push endpoint in `dashboard/backend/src/api/routes/credentials.ts` (validates credentials JSON, triggers refresh)
- [x] T027 [US1] Implement GET /api/credentials/refresh/{operationId} endpoint in `dashboard/backend/src/api/routes/credentials.ts`
- [x] T028 [US1] Implement refresh workflow in `dashboard/backend/src/services/token-refresh.ts` (delete secret, create secret, patch deployment, verify auth)
- [x] T029 [US1] Add credentials validation in `dashboard/backend/src/services/token-refresh.ts` per data-model.md validateCredentials()

### Frontend Implementation for US1

- [x] T030 [US1] Create token-refresh component in `dashboard/frontend/src/components/token-refresh.tsx` with Card layout
- [x] T031 [US1] Add "Refresh Tokens" button that calls POST /api/credentials/refresh
- [x] T032 [US1] Display CLI command with copy-to-clipboard functionality
- [x] T033 [US1] Add multi-step progress indicator using Progress component
- [x] T034 [US1] Implement polling for operation status (GET /api/credentials/refresh/{id})
- [x] T035 [US1] Display success confirmation with timestamp
- [x] T036 [US1] Display failure details with step that failed, error message, and remediation

### CLI Script for US1

- [x] T037 [US1] Create PowerShell push script in `dashboard/cli/push-credentials.ps1` per research.md
- [x] T038 [US1] Add credential file existence check in CLI script
- [x] T039 [US1] Add error handling and exit codes in CLI script

**Checkpoint**: Token refresh workflow complete - operator can refresh tokens in under 2 minutes (SC-001)

---

## Phase 4: User Story 2 - System Health Overview (Priority: P1)

**Goal**: Real-time visibility into Claude agent system health without kubectl commands

**Independent Test**: View dashboard, compare displayed health with `kubectl get pods -n claude-agent`

### Backend Implementation for US2

- [x] T040 [US2] Create HealthStatus entity types in `dashboard/backend/src/types/health.ts` per data-model.md
- [x] T041 [US2] Implement GET /api/health endpoint in `dashboard/backend/src/api/routes/health.ts` (aggregates all components)
- [x] T042 [US2] Implement GET /api/health/pods endpoint in `dashboard/backend/src/api/routes/health.ts`
- [x] T043 [US2] Add pod health mapping logic in `dashboard/backend/src/services/kubernetes.ts` (phase → status mapping per data-model.md)
- [x] T044 [US2] Implement GET /api/auth/status endpoint in `dashboard/backend/src/api/routes/auth.ts` (Claude auth check via exit code)
- [x] T045 [US2] Create Claude agent service in `dashboard/backend/src/services/claude-agent.ts` for auth verification

### Frontend Implementation for US2

- [x] T046 [US2] Create useHealth hook in `dashboard/frontend/src/hooks/use-health.ts` with configurable polling interval (default 30s, read from env/config per FR-011)
- [x] T047 [US2] Create health-panel component in `dashboard/frontend/src/components/health-panel.tsx` with Card layout
- [x] T048 [US2] Display pod status with phase, ready containers, restart count
- [x] T049 [US2] Add color-coded Badge components (green=healthy, red=unhealthy, yellow=pending)
- [x] T050 [US2] Create auth-status component in `dashboard/frontend/src/components/auth-status.tsx`
- [x] T051 [US2] Display authentication status with expiry estimate
- [x] T052 [US2] Add Skeleton loading state for health panel

**Checkpoint**: Health overview complete - operator sees system health within 5 seconds (SC-002)

---

## Phase 5: User Story 3 - Manual Agent Execution (Priority: P2)

**Goal**: Execute ad-hoc Claude prompts without constructing webhook requests

**Independent Test**: Enter test prompt, click Run, verify Claude executes and returns response

### Backend Implementation for US3

- [x] T053 [US3] Create ExecutionRecord entity types in `dashboard/backend/src/types/execution.ts` per data-model.md
- [x] T054 [US3] Implement POST /api/execute endpoint in `dashboard/backend/src/api/routes/claude.ts`
- [x] T055 [US3] Add prompt validation (required, max 100KB) in `dashboard/backend/src/api/routes/claude.ts`
- [x] T056 [US3] Implement Claude agent execution in `dashboard/backend/src/services/claude-agent.ts` (call Claude service, capture exit code, duration)
- [x] T057 [US3] Add execution timeout handling (default 300s) with 504 response
- [x] T058 [US3] Map exit codes to status per data-model.md EXIT_CODE_STATUS

### Frontend Implementation for US3

- [x] T059 [US3] Create agent-executor component in `dashboard/frontend/src/components/agent-executor.tsx` with Card layout
- [x] T060 [US3] Add Textarea for prompt input with character count
- [x] T061 [US3] Add "Run" button with loading state
- [x] T062 [US3] Display execution result with exit code, duration, output
- [x] T063 [US3] Add error display for failures with clear messaging

**Checkpoint**: Manual execution complete - operator can run ad-hoc prompts (SC-005)

---

## Phase 6: User Story 4 - View Recent Executions (Priority: P2)

**Goal**: View execution history for troubleshooting and activity monitoring

**Independent Test**: Trigger several executions, verify they appear in history with correct details

### Backend Implementation for US4

- [x] T064 [US4] Create in-memory execution store in `dashboard/backend/src/services/execution-store.ts` (last 50 records)
- [x] T065 [US4] Implement GET /api/executions endpoint in `dashboard/backend/src/api/routes/claude.ts` with status filter and limit
- [x] T066 [US4] Implement GET /api/executions/{id} endpoint in `dashboard/backend/src/api/routes/claude.ts` (full details)
- [x] T067 [US4] Store execution records from POST /api/execute in execution store

### Frontend Implementation for US4

- [x] T068 [US4] Create execution-history component in `dashboard/frontend/src/components/execution-history.tsx` with Card + Table layout
- [x] T069 [US4] Display execution list with timestamp, exit code, duration, truncated prompt
- [x] T070 [US4] Add status filter dropdown (success, error, auth_failure, timeout)
- [x] T071 [US4] Add click handler to show full execution details in modal/drawer
- [x] T072 [US4] Display full prompt and output in detail view

**Checkpoint**: Execution history complete - operator can view and filter recent executions

---

## Phase 7: User Story 5 - CronJob Management (Priority: P3)

**Goal**: View auth watchdog CronJob status and trigger manual runs

**Independent Test**: View CronJob panel, click "Run Now", verify job is created

### Backend Implementation for US5

- [x] T073 [US5] Create CronJobRun entity types in `dashboard/backend/src/types/cronjob.ts` per data-model.md
- [x] T074 [US5] Implement GET /api/cronjobs endpoint in `dashboard/backend/src/api/routes/k8s.ts` (CronJob status + last 5 runs)
- [x] T075 [US5] Implement POST /api/cronjobs/trigger endpoint in `dashboard/backend/src/api/routes/k8s.ts` (create Job from CronJob template per research.md)
- [x] T076 [US5] Add job listing logic in `dashboard/backend/src/services/kubernetes.ts` (list jobs, map to CronJobRun)

### Frontend Implementation for US5

- [x] T077 [US5] Create cronjob-panel component in `dashboard/frontend/src/components/cronjob-panel.tsx` with Card layout
- [x] T078 [US5] Display CronJob schedule, last schedule time, last successful time
- [x] T079 [US5] Display recent runs table with job name, start time, status, duration
- [x] T080 [US5] Add "Run Now" button with confirmation

**Checkpoint**: CronJob management complete - operator can view and trigger auth checks

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Deployment, documentation, and final touches

### Containerization

- [x] T081 Create backend Dockerfile in `dashboard/backend/Dockerfile` (Node.js 20-alpine, non-root, read-only)
- [x] T082 [P] Create frontend build and nginx Dockerfile in `dashboard/frontend/Dockerfile` (or combine into single container)
- [x] T083 Create combined container Dockerfile in `dashboard/Dockerfile` (serve frontend static + backend API); document semantic version tagging in build args (e.g., --build-arg VERSION=1.0.0)

### Kubernetes Deployment

- [x] T084 Create Deployment manifest in `dashboard/infra/k8s/deployment.yaml` with security context per plan.md
- [x] T085 [P] Create Service manifest in `dashboard/infra/k8s/service.yaml`
- [x] T086 [P] Create Ingress manifest in `dashboard/infra/k8s/ingress.yaml` per quickstart.md
- [x] T087 Create ConfigMap/Secret references for environment variables

### Integration

- [x] T088 Add token-refresh component to dashboard layout
- [x] T089 [P] Add health-panel component to dashboard layout
- [x] T090 [P] Add auth-status component to dashboard layout
- [x] T091 Add agent-executor component to dashboard layout
- [x] T092 [P] Add execution-history component to dashboard layout
- [x] T093 [P] Add cronjob-panel component to dashboard layout

### Final Validation

- [ ] T094 Run quickstart.md validation steps (verify namespace, RBAC, NetworkPolicy)
- [ ] T095 Test full token refresh workflow end-to-end
- [ ] T096 Verify health status updates within 30 seconds (SC-004)
- [ ] T097 Verify dashboard remains responsive during operations (SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (Token Refresh) and US2 (Health) can proceed in parallel
  - US3 (Execution) and US4 (History) can proceed in parallel after US1/US2
  - US5 (CronJob) can proceed after Foundational
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Token Refresh)**: Depends on Foundational - No dependencies on other stories
- **US2 (Health Overview)**: Depends on Foundational - No dependencies on other stories
- **US3 (Manual Execution)**: Depends on Foundational - No dependencies on other stories
- **US4 (Execution History)**: Depends on US3 (execution store must exist)
- **US5 (CronJob)**: Depends on Foundational - No dependencies on other stories

### Within Each User Story

- Backend types before services
- Services before route handlers
- Route handlers before frontend components
- Frontend components before integration

### Parallel Opportunities

- T003, T004, T005, T006 can run in parallel (Setup phase)
- T009, T010, T012, T013 can run in parallel (Backend foundation)
- T016, T017 can run in parallel (Frontend foundation)
- T020, T021, T022 can run in parallel (Infra foundation)
- US1 and US2 can run in parallel (both P1, no dependencies)
- US3 and US5 can run in parallel (independent)
- T082, T085, T086 can run in parallel (Deployment phase)
- T088-T093 component integration can mostly run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Token Refresh) - MVP!
4. Complete Phase 4: User Story 2 (Health Overview) - MVP complete!
5. **STOP and VALIDATE**: Test token refresh and health display
6. Deploy and gather feedback

### Incremental Delivery

1. Setup + Foundational: Foundation ready
2. US1 + US2 (P1): MVP with core functionality
3. US3 + US4 (P2): Add execution capabilities
4. US5 (P3): Add CronJob management
5. Polish: Containerize and deploy

---

## Notes

- [P] tasks = different files/commands, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Runbook steps (Azure AD setup) are in quickstart.md, not scripted
