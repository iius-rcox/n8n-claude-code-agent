# Tasks: Dashboard UX Improvements - Phase 1

**Feature**: 014-dashboard-ux
**Input**: Design documents from `/specs/014-dashboard-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story (P1, P2, P3) to enable independent implementation and testing of each story.

**Tests**: Not requested in feature specification - omitting test tasks per template guidance.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

This is a web application with separate backend and frontend:
- Backend: `dashboard/backend/src/`
- Frontend: `dashboard/frontend/src/`
- Shared types may exist in both locations

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions shared across all user stories

- [X] T001 Create TypeScript type definitions for StuckTask, TaskError, RetryResult in dashboard/frontend/src/types/task.ts
- [X] T002 [P] Create TypeScript type definitions for TokenExpiration, TokenStatus in dashboard/frontend/src/types/auth.ts
- [X] T003 [P] Create TypeScript type definitions for TaskAge, AgeCategory in dashboard/frontend/src/types/task.ts
- [X] T004 [P] Create TypeScript type definitions for BulkActionState, Component in dashboard/frontend/src/types/component.ts
- [X] T005 [P] Create TypeScript type definitions for FileSearchState, BlobItem in dashboard/frontend/src/types/storage.ts
- [X] T006 Create constants file with timing thresholds and age categories in dashboard/frontend/src/constants/thresholds.ts
- [X] T007 [P] Create utility functions for duration formatting and component ID parsing in dashboard/frontend/src/utils/formatting.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend API infrastructure and services that MUST be complete before ANY user story frontend work can begin

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

### Backend Services

- [X] T008 Create n8n client service for workflow retry operations in dashboard/backend/src/services/n8nClient.ts
- [X] T009 [P] Create Teams webhook service for escalation notifications in dashboard/backend/src/services/teamsWebhookService.ts
- [X] T010 [P] Create Kubernetes service for pod operations in dashboard/backend/src/services/k8sService.ts
- [X] T011 [P] Create Azure Blob Storage service extensions for task envelope operations in dashboard/backend/src/services/blobStorageClient.ts

### Backend API Routes

- [X] T012 Implement POST /api/tasks/:id/retry endpoint in dashboard/backend/src/routes/tasks.ts
- [X] T013 [P] Implement GET /api/tasks/:id/diagnostics endpoint in dashboard/backend/src/routes/tasks.ts
- [X] T014 [P] Implement POST /api/tasks/:id/escalate endpoint in dashboard/backend/src/routes/tasks.ts
- [X] T015 [P] Implement GET /api/auth/status endpoint in dashboard/backend/src/routes/auth.ts
- [X] T016 [P] Implement POST /api/components/bulk-restart endpoint in dashboard/backend/src/routes/components.ts
- [X] T017 [P] Implement POST /api/components/logs endpoint in dashboard/backend/src/routes/components.ts
- [X] T018 [P] Implement GET /api/storage/:container/search endpoint in dashboard/backend/src/routes/storage.ts

### Backend Integration

- [X] T019 Register new routes in Express app in dashboard/backend/src/index.ts
- [X] T020 Add request validation middleware for new endpoints in dashboard/backend/src/middleware/validation.ts
- [X] T021 Add error handling middleware for API errors in dashboard/backend/src/middleware/errorHandler.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Resolve Stuck Tasks (Priority: P1) 🎯 MVP

**Goal**: Enable operators to resolve stuck tasks directly from the dashboard with retry/diagnostic/escalation actions

**Independent Test**: Navigate to Pipeline Board with stuck task visible. Click "Retry Task" button. Verify task progresses or displays diagnostic information.

### Frontend Hooks

- [X] T022 [P] [US1] Create useStuckTasks hook for stuck task detection and actions in dashboard/frontend/src/hooks/useStuckTasks.ts
- [X] T023 [P] [US1] Create useTaskDiagnostics hook for fetching diagnostic data in dashboard/frontend/src/hooks/useTaskDiagnostics.ts

### Frontend Services

- [X] T024 [US1] Implement tasksApi service with retry/diagnostics/escalate functions in dashboard/frontend/src/services/tasksApi.ts

### Frontend Components

- [X] T025 [P] [US1] Create StuckTaskActions component with three action buttons in dashboard/frontend/src/components/pipeline/StuckTaskActions.tsx
- [X] T026 [P] [US1] Create DiagnosticModal component for "Why Stuck?" view in dashboard/frontend/src/components/pipeline/DiagnosticModal.tsx
- [X] T027 [P] [US1] Create TaskRetryButton component with loading states in dashboard/frontend/src/components/pipeline/TaskRetryButton.tsx

### Frontend Integration

- [ ] T028 [US1] Modify TaskCard component to detect stuck state and display StuckTaskActions in dashboard/frontend/src/components/pipeline/TaskCard.tsx
- [ ] T029 [US1] Add pulse animation CSS for stuck task cards in dashboard/frontend/src/components/pipeline/TaskCard.css
- [ ] T030 [US1] Update Toast component to handle escalation confirmation messages in dashboard/frontend/src/components/shared/Toast.tsx

**Checkpoint**: User Story 1 should be fully functional - operators can retry, diagnose, and escalate stuck tasks

---

## Phase 4: User Story 2 - Track Token Expiration (Priority: P1)

**Goal**: Display countdown timer for session token expiration with proactive warnings before failure occurs

**Independent Test**: View Token Refresh panel with session token having <30 minutes remaining. Verify countdown timer displays with color-coded urgency.

### Frontend Hooks

- [X] T031 [P] [US2] Create useTokenExpiration hook with 60-second polling in dashboard/frontend/src/hooks/useTokenExpiration.ts
- [X] T032 [P] [US2] Create useCountdown hook for real-time countdown calculation in dashboard/frontend/src/hooks/useCountdown.ts

### Frontend Services

- [X] T033 [US2] Extend authApi service with token status endpoint in dashboard/frontend/src/services/authApi.ts

### Frontend Components

- [X] T034 [P] [US2] Create CountdownTimer component with color-coded urgency levels in dashboard/frontend/src/components/auth/CountdownTimer.tsx
- [X] T035 [P] [US2] Create ExpirationWarning component for critical threshold alerts in dashboard/frontend/src/components/auth/ExpirationWarning.tsx

### Frontend Integration

- [ ] T036 [US2] Modify TokenRefresh component to display CountdownTimer in dashboard/frontend/src/components/auth/TokenRefresh.tsx
- [ ] T037 [US2] Add toast notification at 5-minute threshold suggesting long-lived token in dashboard/frontend/src/components/auth/TokenRefresh.tsx
- [ ] T038 [US2] Implement "Refresh Now" button with navigation to Session Refresh tab in dashboard/frontend/src/components/auth/TokenRefresh.tsx

**Checkpoint**: User Story 2 should be independently functional - countdown timer prevents authentication failures

---

## Phase 5: User Story 3 - Identify Aging Tasks Visually (Priority: P2)

**Goal**: Apply color-coded heat map to task cards based on time in current phase for quick visual identification

**Independent Test**: View Pipeline Board with tasks of varying ages. Verify cards show green/yellow/orange/red borders based on time in phase.

### Frontend Hooks

- [ ] T039 [US3] Create useTaskAge hook for calculating time-in-phase in dashboard/frontend/src/hooks/useTaskAge.ts

### Frontend Components

- [ ] T040 [P] [US3] Create TaskAgeBadge component for displaying duration in dashboard/frontend/src/components/pipeline/TaskAgeBadge.tsx
- [ ] T041 [P] [US3] Create age-based color utilities in dashboard/frontend/src/utils/ageColors.ts

### Frontend Integration

- [ ] T042 [US3] Modify TaskCard component to apply age-based border colors in dashboard/frontend/src/components/pipeline/TaskCard.tsx
- [ ] T043 [US3] Add TaskAgeBadge to TaskCard header in dashboard/frontend/src/components/pipeline/TaskCard.tsx
- [ ] T044 [US3] Implement pulse animation for stale tasks (>12h) in dashboard/frontend/src/components/pipeline/TaskCard.css

**Checkpoint**: User Story 3 should be independently functional - visual heat map enables quick task age identification

---

## Phase 6: User Story 4 - Restart Multiple Failing Components (Priority: P2)

**Goal**: Enable bulk restart operations on multiple selected components to reduce recovery time from minutes to seconds

**Independent Test**: Select multiple unhealthy components via checkboxes in Health Panel. Click "Restart All". Verify all selected components restart simultaneously.

### Frontend Hooks

- [ ] T045 [US4] Create useBulkActions hook for managing selection state in dashboard/frontend/src/hooks/useBulkActions.ts

### Frontend Services

- [ ] T046 [US4] Implement componentsApi service with bulk-restart and logs endpoints in dashboard/frontend/src/services/componentsApi.ts

### Frontend Components

- [ ] T047 [P] [US4] Create ComponentCheckbox component for multi-select in dashboard/frontend/src/components/health/ComponentCheckbox.tsx
- [ ] T048 [P] [US4] Create BulkActionToolbar component with action buttons in dashboard/frontend/src/components/health/BulkActionToolbar.tsx
- [ ] T049 [P] [US4] Create BulkRestartConfirmation modal component in dashboard/frontend/src/components/health/BulkRestartConfirmation.tsx
- [ ] T050 [P] [US4] Create BulkLogsModal component for tabbed log view in dashboard/frontend/src/components/health/BulkLogsModal.tsx

### Frontend Integration

- [ ] T051 [US4] Modify HealthPanel component to add checkboxes to component cards in dashboard/frontend/src/components/health/HealthPanel.tsx
- [ ] T052 [US4] Add BulkActionToolbar to HealthPanel header in dashboard/frontend/src/components/health/HealthPanel.tsx
- [ ] T053 [US4] Implement per-component status indicators during bulk operations in dashboard/frontend/src/components/health/HealthPanel.tsx
- [ ] T054 [US4] Add auto-clear selection after successful bulk operation in dashboard/frontend/src/components/health/HealthPanel.tsx

**Checkpoint**: User Story 4 should be independently functional - bulk operations reduce recovery time significantly

---

## Phase 7: User Story 5 - Search Storage Files Quickly (Priority: P3)

**Goal**: Enable real-time fuzzy search filtering in Storage Browser to reduce file discovery time from minutes to seconds

**Independent Test**: Open Storage Browser, type task ID into search field. Verify tree filters to show only matching files in real-time.

### Frontend Hooks

- [ ] T055 [US5] Create useFileSearch hook with debounced substring matching in dashboard/frontend/src/hooks/useFileSearch.ts

### Frontend Components

- [ ] T056 [P] [US5] Create SearchInput component with Ctrl+K keyboard shortcut in dashboard/frontend/src/components/storage/SearchInput.tsx
- [ ] T057 [P] [US5] Create SearchMatchCount component for displaying results in dashboard/frontend/src/components/storage/SearchMatchCount.tsx
- [ ] T058 [P] [US5] Create highlightMatch utility for marking matched text in dashboard/frontend/src/utils/searchHighlight.ts

### Frontend Integration

- [ ] T059 [US5] Modify StorageBrowser component to add SearchInput at top in dashboard/frontend/src/components/storage/StorageBrowser.tsx
- [ ] T060 [US5] Modify FileTree component to filter by search query in dashboard/frontend/src/components/storage/FileTree.tsx
- [ ] T061 [US5] Add match highlighting to file/folder names in FileTree in dashboard/frontend/src/components/storage/FileTree.tsx
- [ ] T062 [US5] Implement keyboard shortcut handler (Ctrl+K/Cmd+K) in dashboard/frontend/src/components/storage/StorageBrowser.tsx

**Checkpoint**: User Story 5 should be independently functional - search enables rapid file discovery

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories, accessibility, and documentation

- [ ] T063 [P] Add WCAG 2.1 AA contrast validation for color-coded elements in dashboard/frontend/src/utils/accessibility.ts
- [ ] T064 [P] Add comprehensive JSDoc comments to all custom hooks in dashboard/frontend/src/hooks/
- [ ] T065 [P] Add API error boundary component for graceful degradation in dashboard/frontend/src/components/shared/ErrorBoundary.tsx
- [ ] T066 [P] Update quickstart.md with feature-specific testing instructions in specs/014-dashboard-ux/quickstart.md
- [ ] T067 [P] Add performance monitoring for search operations in dashboard/frontend/src/utils/performanceMonitor.ts
- [ ] T068 Security audit for API endpoints (rate limiting, input validation) in dashboard/backend/src/middleware/
- [ ] T069 Add loading skeletons for async data fetching in dashboard/frontend/src/components/shared/Skeleton.tsx
- [ ] T070 Run quickstart.md validation to verify all setup steps work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1) can start after Foundational
  - User Story 2 (P1) can start after Foundational
  - User Story 3 (P2) can start after Foundational
  - User Story 4 (P2) can start after Foundational
  - User Story 5 (P3) can start after Foundational
  - **User stories can proceed in parallel if team capacity allows**
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - fully independent
- **User Story 2 (P1)**: No dependencies on other stories - fully independent
- **User Story 3 (P2)**: No dependencies on other stories - fully independent
- **User Story 4 (P2)**: No dependencies on other stories - fully independent
- **User Story 5 (P3)**: No dependencies on other stories - fully independent

### Within Each User Story

**General pattern for all stories:**
1. Hooks first (data fetching, state management)
2. Services next (API integration)
3. Components in parallel (UI elements)
4. Integration last (wire components into existing pages)

**User Story 1 (Stuck Tasks):**
- T022, T023 hooks can run in parallel
- T024 service depends on hooks
- T025, T026, T027 components can run in parallel after T024
- T028, T029, T030 integration depends on all components

**User Story 2 (Token Expiration):**
- T031, T032 hooks can run in parallel
- T033 service depends on hooks
- T034, T035 components can run in parallel after T033
- T036, T037, T038 integration depends on all components

**User Story 3 (Task Age Heat Map):**
- T039 hook first
- T040, T041 can run in parallel after T039
- T042, T043, T044 integration depends on T040, T041

**User Story 4 (Bulk Actions):**
- T045 hook first
- T046 service depends on T045
- T047, T048, T049, T050 components can run in parallel after T046
- T051, T052, T053, T054 integration depends on all components

**User Story 5 (File Search):**
- T055 hook first
- T056, T057, T058 can run in parallel after T055
- T059, T060, T061, T062 integration depends on all components

### Parallel Opportunities

**Phase 1 (Setup):** All tasks marked [P] can run in parallel:
- T002, T003, T004, T005 (type definitions)
- T007 (utilities)

**Phase 2 (Foundational):** All tasks marked [P] can run in parallel:
- T009, T010, T011 (backend services)
- T013, T014, T015, T016, T017, T018 (backend routes)

**Across User Stories:** Once Foundational phase completes, all 5 user stories can start in parallel:
- Developer A: User Story 1 (T022-T030)
- Developer B: User Story 2 (T031-T038)
- Developer C: User Story 3 (T039-T044)
- Developer D: User Story 4 (T045-T054)
- Developer E: User Story 5 (T055-T062)

**Within User Stories:** Tasks marked [P] with same story label can run in parallel:
- US1: T022 + T023, T025 + T026 + T027
- US2: T031 + T032, T034 + T035
- US3: T040 + T041
- US4: T047 + T048 + T049 + T050
- US5: T056 + T057 + T058

---

## Parallel Example: User Story 1 (Stuck Tasks)

```bash
# Launch all hooks for User Story 1 together:
Task: "Create useStuckTasks hook for stuck task detection and actions in dashboard/frontend/src/hooks/useStuckTasks.ts"
Task: "Create useTaskDiagnostics hook for fetching diagnostic data in dashboard/frontend/src/hooks/useTaskDiagnostics.ts"

# After hooks complete, launch all components together:
Task: "Create StuckTaskActions component with three action buttons in dashboard/frontend/src/components/pipeline/StuckTaskActions.tsx"
Task: "Create DiagnosticModal component for 'Why Stuck?' view in dashboard/frontend/src/components/pipeline/DiagnosticModal.tsx"
Task: "Create TaskRetryButton component with loading states in dashboard/frontend/src/components/pipeline/TaskRetryButton.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T021) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T022-T030)
4. Complete Phase 4: User Story 2 (T031-T038)
5. **STOP and VALIDATE**: Test both P1 stories independently
6. Deploy/demo MVP with stuck task resolution + token tracking

**Rationale**: Both P1 stories address critical operator pain points blocking productivity. User Story 1 unblocks stuck tasks, User Story 2 prevents authentication failures. Together they form a minimal viable feature set.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **Deploy/Demo (MVP: Stuck task resolution!)**
3. Add User Story 2 → Test independently → **Deploy/Demo (MVP+: Token tracking!)**
4. Add User Story 3 → Test independently → Deploy/Demo (Heat map visualization)
5. Add User Story 4 → Test independently → Deploy/Demo (Bulk operations)
6. Add User Story 5 → Test independently → Deploy/Demo (Complete feature set)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. **Week 1**: Entire team completes Setup (Phase 1) + Foundational (Phase 2) together
2. **Week 2**: Once Foundational is done, split into parallel tracks:
   - **Track A** (Senior Dev): User Story 1 (P1) - Stuck Tasks
   - **Track B** (Senior Dev): User Story 2 (P1) - Token Expiration
   - **Track C** (Mid Dev): User Story 3 (P2) - Task Age Heat Map
   - **Track D** (Mid Dev): User Story 4 (P2) - Bulk Actions
   - **Track E** (Junior Dev): User Story 5 (P3) - File Search
3. Stories complete and integrate independently
4. Integration testing happens as stories complete

---

## Task Count Summary

- **Phase 1 (Setup)**: 7 tasks
- **Phase 2 (Foundational)**: 14 tasks (CRITICAL - blocks all stories)
- **Phase 3 (User Story 1 - P1)**: 9 tasks
- **Phase 4 (User Story 2 - P1)**: 8 tasks
- **Phase 5 (User Story 3 - P2)**: 6 tasks
- **Phase 6 (User Story 4 - P2)**: 10 tasks
- **Phase 7 (User Story 5 - P3)**: 8 tasks
- **Phase 8 (Polish)**: 8 tasks

**Total**: 70 tasks

### Breakdown by User Story

- **US1** (Stuck Tasks): 9 tasks - independently testable
- **US2** (Token Expiration): 8 tasks - independently testable
- **US3** (Task Age Heat Map): 6 tasks - independently testable
- **US4** (Bulk Actions): 10 tasks - independently testable
- **US5** (File Search): 8 tasks - independently testable

### Parallel Opportunities

- **Setup phase**: 5 tasks can run in parallel
- **Foundational phase**: 7 tasks can run in parallel
- **User stories**: All 5 stories can proceed in parallel after Foundational
- **Within stories**: 2-4 tasks per story can run in parallel

### Suggested MVP Scope

**Minimum Viable Product**: User Story 1 + User Story 2 (17 tasks + Foundation = 38 tasks total)
- Addresses both critical P1 pain points
- Enables operators to resolve stuck tasks and prevent auth failures
- Can be completed in 1-2 weeks with 2-3 developers
- Delivers immediate operational value

---

## Notes

- All [P] tasks = different files, no dependencies within phase
- All [Story] labels map to specific user stories for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No test tasks included - not requested in feature specification
- Backend APIs (Phase 2) must be fully functional before starting frontend stories
- Use TanStack Query for all API data fetching in frontend hooks
- Follow existing dashboard patterns for component structure and styling
