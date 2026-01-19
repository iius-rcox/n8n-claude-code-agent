# Tasks: Dashboard Observability Enhancements

**Input**: Design documents from `/specs/010-dashboard-observability/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in this feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

This is a web application with `dashboard/backend/` and `dashboard/frontend/` structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add dependencies and configuration for new features

- [ ] T001 Add @azure/storage-blob dependency to dashboard/backend/package.json
- [ ] T002 [P] Add yaml parsing dependency to dashboard/backend/package.json
- [ ] T003 [P] Add n8n configuration to dashboard/backend/src/config.ts (N8N_API_URL, N8N_API_KEY env vars)
- [ ] T004 [P] Add storage configuration to dashboard/backend/src/config.ts (AZURE_STORAGE_ACCOUNT env var)
- [ ] T005 Create shared types file dashboard/backend/src/types/observability.ts with common interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create core services that multiple user stories depend on

**⚠️ CRITICAL**: User Story 2, 3, and 4 all need the blob storage service. User Story 3 needs n8n client.

- [ ] T006 Create BlobStorageService class in dashboard/backend/src/services/blob-storage.ts with listContainers, listBlobs, getBlob methods
- [ ] T007 Create N8nClient class in dashboard/backend/src/services/n8n-client.ts with getExecutions, getExecution methods
- [ ] T008 [P] Create pipeline types in dashboard/backend/src/types/pipeline.ts (TaskEnvelope, TaskSummary, PhaseState)
- [ ] T009 [P] Create storage types in dashboard/backend/src/types/storage.ts (StorageContainer, StorageBlob, BlobContentResponse)
- [ ] T010 [P] Create n8n types in dashboard/backend/src/types/n8n.ts (N8nExecution, ExecutionFilters, ExecutionListResponse)
- [ ] T011 Update dashboard/backend/src/api/routes/index.ts to import and mount new routers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - System Health At-a-Glance (Priority: P1) 🎯 MVP

**Goal**: Display health status of all system components (Claude Agent, n8n, Auth Watchdog, Azure Blob Storage, Claude Authentication) on a single screen

**Independent Test**: Load dashboard and verify all 5 component statuses display with green/yellow/red indicators. Click a component to see expanded details.

### Implementation for User Story 1

- [ ] T012 [US1] Add n8n health check method to dashboard/backend/src/services/kubernetes.ts (HTTP GET to n8n healthz endpoint)
- [ ] T013 [US1] Add storage health check method to dashboard/backend/src/services/blob-storage.ts (test container connectivity)
- [ ] T014 [US1] Extend GET /api/health in dashboard/backend/src/api/routes/health.ts to include n8n and storage components
- [ ] T015 [US1] Update HealthStatus interface in dashboard/backend/src/api/routes/health.ts to include 'storage' and 'n8n' component types
- [ ] T016 [US1] Add N8nDetails and StorageDetails interfaces to dashboard/frontend/src/services/api.ts
- [ ] T017 [US1] Extend health-panel.tsx component in dashboard/frontend/src/components/health-panel.tsx to display all 5 component types
- [ ] T018 [US1] Add expandable detail view for each component in dashboard/frontend/src/components/health-panel.tsx
- [ ] T019 [US1] Add warning status (yellow) for auth expiring within 24 hours in dashboard/frontend/src/components/health-panel.tsx

**Checkpoint**: User Story 1 complete - operators can see all system health at-a-glance

---

## Phase 4: User Story 2 - Task Pipeline Visibility (Priority: P2)

**Goal**: Kanban-style board showing tasks flowing through 6 pipeline phases with stuck task highlighting

**Independent Test**: View pipeline board, see tasks in correct columns, stuck tasks (>30 min in phase) highlighted with warning

### Implementation for User Story 2

- [ ] T020 [US2] Create PipelineStateService in dashboard/backend/src/services/pipeline-state.ts to parse task envelopes from blob storage
- [ ] T021 [US2] Add getTaskEnvelopes method to PipelineStateService that lists and parses YAML from agent-state container
- [ ] T022 [US2] Add calculateTimeInPhase and isStuck helper methods to PipelineStateService
- [ ] T023 [US2] Create GET /api/pipeline route in dashboard/backend/src/api/routes/pipeline.ts returning PipelineResponse
- [ ] T024 [US2] Create GET /api/pipeline/tasks/:taskId route in dashboard/backend/src/api/routes/pipeline.ts for task details
- [ ] T025 [US2] Add pipeline API functions to dashboard/frontend/src/services/api.ts (getPipeline, getTaskDetail)
- [ ] T026 [US2] Create use-pipeline hook in dashboard/frontend/src/hooks/use-pipeline.ts with 30s polling
- [ ] T027 [US2] Create pipeline-board.tsx component in dashboard/frontend/src/components/pipeline-board.tsx with 6 Kanban columns
- [ ] T028 [US2] Create TaskCard component within pipeline-board.tsx showing taskId, title, timeInPhase, agent
- [ ] T029 [US2] Add stuck task highlighting (warning indicator for tasks >30 min in phase) to TaskCard
- [ ] T030 [US2] Create TaskDetailPanel component for click-to-expand showing envelope contents and phase history
- [ ] T031 [US2] Add PipelineBoard to dashboard/frontend/src/pages/dashboard.tsx layout

**Checkpoint**: User Story 2 complete - operators can visualize task pipeline and identify stuck tasks

---

## Phase 5: User Story 3 - n8n Execution Monitoring (Priority: P3)

**Goal**: Real-time feed of n8n workflow executions with filtering and detail view

**Independent Test**: View execution feed, see recent executions with status badges, filter by workflow/status, click to see details

### Implementation for User Story 3

- [ ] T032 [US3] Add getWorkflows method to N8nClient in dashboard/backend/src/services/n8n-client.ts
- [ ] T033 [US3] Create GET /api/executions route in dashboard/backend/src/api/routes/n8n.ts with query filters
- [ ] T034 [US3] Create GET /api/executions/:id route in dashboard/backend/src/api/routes/n8n.ts for execution details
- [ ] T035 [US3] Create GET /api/executions/workflows route in dashboard/backend/src/api/routes/n8n.ts for workflow list
- [ ] T036 [US3] Add execution API functions to dashboard/frontend/src/services/api.ts (getExecutions, getExecution, getWorkflows)
- [ ] T037 [US3] Create use-executions hook in dashboard/frontend/src/hooks/use-executions.ts with 10s polling
- [ ] T038 [US3] Create execution-feed.tsx component in dashboard/frontend/src/components/execution-feed.tsx
- [ ] T039 [US3] Add ExecutionRow component showing workflowName, taskId, status, duration, timestamp
- [ ] T040 [US3] Add status badge styling (green=success, red=error, yellow=running) to ExecutionRow
- [ ] T041 [US3] Create ExecutionFilters component with workflow name, status, and time range dropdowns
- [ ] T042 [US3] Create ExecutionDetailPanel for click-to-expand showing input/output data and error messages
- [ ] T043 [US3] Add ExecutionFeed to dashboard/frontend/src/pages/dashboard.tsx layout

**Checkpoint**: User Story 3 complete - operators can monitor n8n executions in real-time

---

## Phase 6: User Story 4 - Blob Storage Exploration (Priority: P4)

**Goal**: Browse Azure Blob Storage containers and files with preview, download, and delete capabilities

**Independent Test**: Navigate to storage browser, browse containers, view file contents with syntax highlighting, download a file, delete with confirmation

### Implementation for User Story 4

- [ ] T044 [US4] Add getBlobContent method to BlobStorageService in dashboard/backend/src/services/blob-storage.ts
- [ ] T045 [US4] Add generateDownloadUrl method to BlobStorageService (SAS URL generation)
- [ ] T046 [US4] Add deleteBlob method to BlobStorageService with confirmation requirement
- [ ] T047 [US4] Add breakLease method to BlobStorageService for stuck blob recovery
- [ ] T048 [US4] Create GET /api/storage/containers route in dashboard/backend/src/api/routes/storage.ts
- [ ] T049 [US4] Create GET /api/storage/containers/:container/blobs route in dashboard/backend/src/api/routes/storage.ts
- [ ] T050 [US4] Create GET /api/storage/containers/:container/blobs/:blobPath route for content preview
- [ ] T051 [US4] Create GET /api/storage/containers/:container/blobs/:blobPath/download route for SAS URL
- [ ] T052 [US4] Create DELETE /api/storage/containers/:container/blobs/:blobPath route with confirm body
- [ ] T053 [US4] Create DELETE /api/storage/containers/:container/blobs/:blobPath/lease route for lease break
- [ ] T054 [US4] Add storage API functions to dashboard/frontend/src/services/api.ts (getContainers, getBlobs, getBlobContent, downloadBlob, deleteBlob, breakLease)
- [ ] T055 [US4] Create use-storage hook in dashboard/frontend/src/hooks/use-storage.ts with navigation state
- [ ] T056 [US4] Create storage-browser.tsx component in dashboard/frontend/src/components/storage-browser.tsx
- [ ] T057 [US4] Create ContainerList component showing 6 agent containers
- [ ] T058 [US4] Create BlobList component with hierarchical folder/file display
- [ ] T059 [US4] Create FilePreview component with syntax highlighting for YAML, JSON, Markdown
- [ ] T060 [US4] Add download button functionality to FilePreview
- [ ] T061 [US4] Add delete button with confirmation dialog to BlobList
- [ ] T062 [US4] Add lease status indicator and break lease button to BlobList
- [ ] T063 [US4] Add StorageBrowser to dashboard/frontend/src/pages/dashboard.tsx layout

**Checkpoint**: User Story 4 complete - operators can browse and manage blob storage artifacts

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Dashboard layout integration and error handling improvements

- [ ] T064 Update dashboard.tsx layout to organize 4 panels with tabs or grid in dashboard/frontend/src/pages/dashboard.tsx
- [ ] T065 [P] Add error boundary component for graceful panel failures in dashboard/frontend/src/components/error-boundary.tsx
- [ ] T066 [P] Add loading skeleton components for each new panel type
- [ ] T067 Add error recovery UI (retry buttons) for API failures in each panel
- [ ] T068 [P] Update dashboard/backend/.env.example with new environment variables (N8N_API_URL, N8N_API_KEY, AZURE_STORAGE_ACCOUNT)
- [ ] T069 Run quickstart.md validation - verify local development setup works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 can start after Phase 2 (minimal dependencies)
  - US2 requires T006 (BlobStorageService)
  - US3 requires T007 (N8nClient)
  - US4 requires T006 (BlobStorageService)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Requires BlobStorageService ✅
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Requires N8nClient ✅
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Requires BlobStorageService ✅

### Within Each User Story

- Backend service methods before API routes
- API routes before frontend API functions
- Frontend API functions before hooks
- Hooks before components
- Components before dashboard integration

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different config sections)
- T008, T009, T010 can run in parallel (different type files)
- After Phase 2: US1, US2, US3, US4 can all proceed in parallel (different services, routes, components)
- Within US4: T048-T053 are different route files, some parallelism possible

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all type definitions together:
Task: T008 "Create pipeline types in dashboard/backend/src/types/pipeline.ts"
Task: T009 "Create storage types in dashboard/backend/src/types/storage.ts"
Task: T010 "Create n8n types in dashboard/backend/src/types/n8n.ts"
```

## Parallel Example: User Stories After Foundation

```bash
# With multiple developers, launch all stories in parallel:
Developer A: User Story 1 (T012-T019) - Health Overview
Developer B: User Story 2 (T020-T031) - Pipeline Board
Developer C: User Story 3 (T032-T043) - Execution Feed
Developer D: User Story 4 (T044-T063) - Storage Browser
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T011)
3. Complete Phase 3: User Story 1 (T012-T019)
4. **STOP and VALIDATE**: Test health panel shows all 5 components
5. Deploy/demo if ready - **Delivers SC-001**: "Operators can determine overall system health within 5 seconds"

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Health) → Test independently → Deploy (MVP!)
3. Add US2 (Pipeline) → Test independently → Deploy
4. Add US3 (Executions) → Test independently → Deploy
5. Add US4 (Storage) → Test independently → Deploy
6. Each story adds observability value without breaking previous features

### Task Counts

| Phase | Tasks | Parallel |
|-------|-------|----------|
| Phase 1: Setup | 5 | 3 |
| Phase 2: Foundational | 6 | 3 |
| Phase 3: US1 Health | 8 | 0 |
| Phase 4: US2 Pipeline | 12 | 0 |
| Phase 5: US3 Executions | 12 | 0 |
| Phase 6: US4 Storage | 20 | 0 |
| Phase 7: Polish | 6 | 3 |
| **Total** | **69** | **9** |

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- [US#] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Error handling is built into each component (FR-028)
- All APIs authenticated via Azure AD (FR-027)
