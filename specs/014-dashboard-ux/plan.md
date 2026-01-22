# Implementation Plan: Dashboard UX Improvements - Phase 1

**Branch**: `014-dashboard-ux` | **Date**: 2026-01-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-dashboard-ux/spec.md`

## Summary

Implement 5 high-impact dashboard UX improvements to reduce operator friction and prevent system failures:
1. **Stuck Task Actions** (P1) - Add retry/diagnostic/escalation buttons to stuck task cards
2. **Token Expiration Countdown** (P1) - Display countdown timer with proactive warnings before auth token expiry
3. **Task Age Heat Map** (P2) - Color-code task cards by time in phase (green→yellow→orange→red)
4. **Bulk Component Actions** (P2) - Enable multi-select checkbox operations for component management
5. **File Search** (P3) - Real-time fuzzy search filtering in Storage Browser

**Technical Approach**: Frontend-focused feature adding UI components, state management, and API integrations to existing React/TypeScript dashboard. Backend API endpoints for task retry/diagnostics will be implemented alongside frontend changes.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Node.js 20+ (backend)
**Primary Dependencies**:
- Frontend: React 18, Vite 5, Framer Motion 11, Radix UI, TanStack Query
- Backend: Express 4, @azure/storage-blob, @kubernetes/client-node, @azure/identity
**Storage**: Azure Blob Storage (existing task envelopes), Azure AD session management
**Testing**: Vitest (frontend unit), Playwright (E2E), Jest (backend unit)
**Target Platform**: Web dashboard (desktop-first, Chrome/Edge/Firefox)
**Project Type**: Web application (existing dashboard/frontend + dashboard/backend structure)
**Performance Goals**:
- Search filtering: <50ms response time for 1000 blobs
- Token countdown polling: 1 request/minute max
- Task age calculation: <10ms for 100 tasks
- Bulk operations: Real-time per-component status updates
**Constraints**:
- WCAG 2.1 AA contrast ratios for color-coded elements
- No UI lag during search with 1000 blobs
- Timezone-aware time calculations (browser timezone → server timezone)
- Idempotent bulk operations (safe to retry on network failure)
**Scale/Scope**:
- Support 100+ tasks in pipeline simultaneously
- Handle 1000+ blobs per storage container
- Support 20+ components in Health Panel
- Real-time updates via WebSocket (existing)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ **PASS** - No constitution file exists, no violations to check.

This feature extends an existing dashboard application without introducing new architectural complexity. Changes are localized to UI components and supporting backend endpoints.

## Project Structure

### Documentation (this feature)

```text
specs/014-dashboard-ux/
├── plan.md              # This file
├── research.md          # Phase 0 - API patterns, UX libraries
├── data-model.md        # Phase 1 - State management, API contracts
├── quickstart.md        # Phase 1 - Developer setup guide
├── contracts/           # Phase 1 - API endpoint specifications
│   ├── tasks-api.yaml
│   ├── auth-api.yaml
│   └── components-api.yaml
└── tasks.md             # Phase 2 - Created by /speckit.tasks command
```

### Source Code (repository root)

```text
dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── tasks.ts          # NEW: /api/tasks/:id/retry, /diagnostics
│   │   │   ├── auth.ts           # MODIFY: Add expiration timestamp
│   │   │   └── components.ts     # NEW: Bulk restart operations
│   │   ├── services/
│   │   │   ├── taskRetryService.ts      # NEW: Task retry logic
│   │   │   ├── teamsWebhookService.ts   # NEW: Escalation notifications
│   │   │   └── k8sService.ts            # MODIFY: Bulk pod operations
│   │   └── index.ts              # MODIFY: Register new routes
│   └── tests/
│       ├── unit/
│       │   ├── taskRetryService.test.ts
│       │   └── teamsWebhookService.test.ts
│       └── integration/
│           └── tasksApi.test.ts
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── pipeline/
    │   │   │   ├── TaskCard.tsx             # MODIFY: Add age colors, stuck actions
    │   │   │   ├── StuckTaskActions.tsx     # NEW: Action panel component
    │   │   │   ├── DiagnosticModal.tsx      # NEW: "Why Stuck?" modal
    │   │   │   └── TaskAgeBadge.tsx         # NEW: Time-in-phase badge
    │   │   ├── auth/
    │   │   │   ├── TokenRefresh.tsx         # MODIFY: Add countdown timer
    │   │   │   └── CountdownTimer.tsx       # NEW: Expiration countdown
    │   │   ├── health/
    │   │   │   ├── HealthPanel.tsx          # MODIFY: Add checkboxes, bulk toolbar
    │   │   │   ├── BulkActionToolbar.tsx    # NEW: Bulk operations UI
    │   │   │   └── ComponentCheckbox.tsx    # NEW: Multi-select checkbox
    │   │   ├── storage/
    │   │   │   ├── StorageBrowser.tsx       # MODIFY: Add search input
    │   │   │   ├── SearchInput.tsx          # NEW: Fuzzy search component
    │   │   │   └── FileTree.tsx             # MODIFY: Filter by search query
    │   │   └── shared/
    │   │       └── Toast.tsx                # MODIFY: Add token expiry notifications
    │   ├── hooks/
    │   │   ├── useTaskAge.ts                # NEW: Calculate time-in-phase
    │   │   ├── useTokenExpiration.ts        # NEW: Poll expiration status
    │   │   ├── useBulkActions.ts            # NEW: Manage bulk selection state
    │   │   └── useFileSearch.ts             # NEW: Fuzzy search filtering
    │   ├── services/
    │   │   ├── tasksApi.ts                  # NEW: Retry/diagnostics API calls
    │   │   ├── authApi.ts                   # MODIFY: Fetch expiration timestamp
    │   │   └── componentsApi.ts             # NEW: Bulk restart operations
    │   └── types/
    │       ├── task.ts                      # MODIFY: Add stuck detection types
    │       ├── component.ts                 # MODIFY: Add bulk action types
    │       └── auth.ts                      # MODIFY: Add expiration types
    └── tests/
        ├── unit/
        │   ├── useTaskAge.test.ts
        │   ├── useTokenExpiration.test.ts
        │   └── useFileSearch.test.ts
        └── e2e/
            ├── stuckTaskActions.spec.ts
            ├── tokenExpiration.spec.ts
            ├── taskAgeHeatMap.spec.ts
            ├── bulkActions.spec.ts
            └── fileSearch.spec.ts
```

**Structure Decision**: Web application structure (Option 2 from template). This feature extends the existing `dashboard/` directory with new components, hooks, and API endpoints. No new top-level directories required.

## Complexity Tracking

Not applicable - no constitution violations to justify.

## Phase 0: Research & Design Decisions

Research tasks to resolve before implementation:

### R1: Task Retry Patterns
**Question**: How should task retry operations work with existing n8n workflows?
**Research Focus**:
- Investigate n8n workflow restart/resume APIs
- Determine if tasks can resume from checkpoint or must restart from beginning
- Identify error recovery patterns in autonomous agent pipeline
- Document retry failure handling (what happens if GitHub token still expired?)

**Deliverable**: `research.md` section documenting:
- n8n workflow restart mechanism
- Checkpoint/resume capabilities (if any)
- Recommended retry strategy
- Failure mode handling

### R2: Teams Webhook Integration
**Question**: What is the Teams webhook URL format and payload structure for escalations?
**Research Focus**:
- Locate existing Teams webhook configuration (assumed to exist per spec assumptions)
- Document Teams Adaptive Card format for task escalation notifications
- Identify retry/fallback behavior if webhook unavailable
- Determine escalation routing (which Teams channel?)

**Deliverable**: `research.md` section documenting:
- Teams webhook URL (or environment variable name)
- Payload format with example JSON
- Error handling strategy

### R3: AKS/K8s Bulk Operations
**Question**: Can we safely restart multiple pods simultaneously via Kubernetes API?
**Research Focus**:
- Review @kubernetes/client-node bulk operation patterns
- Determine if rolling restart is needed or simultaneous restart acceptable
- Identify proper RBAC permissions required for pod restart
- Document partial failure handling (some pods restart, others fail)

**Deliverable**: `research.md` section documenting:
- K8s API bulk restart pattern (code examples)
- Required service account permissions
- Partial failure response format

### R4: Fuzzy Search Algorithm
**Question**: Which fuzzy matching algorithm provides best UX for blob path search?
**Research Focus**:
- Evaluate fuzzy matching libraries (fuse.js, match-sorter, or custom)
- Benchmark performance with 1000 blobs
- Determine substring vs. fuzzy matching trade-offs
- Test case-insensitive matching accuracy

**Deliverable**: `research.md` section documenting:
- Recommended library/algorithm
- Performance benchmarks
- Code examples

### R5: Token Expiration Polling
**Question**: Where does token expiration timestamp come from?
**Research Focus**:
- Investigate MSAL token cache structure
- Determine if expiration timestamp already available in auth state
- Document polling interval vs. accuracy trade-off
- Identify long-lived token detection method

**Deliverable**: `research.md` section documenting:
- Token expiration data source
- Polling implementation pattern
- Long-lived vs. session token differentiation

---

**Phase 0 Output**: `research.md` with all 5 research sections completed

## Phase 1: Data Model & Contracts

### Data Model Design

Create `data-model.md` with the following entity definitions:

#### Frontend State Models

**StuckTask**:
```typescript
interface StuckTask {
  id: string;
  phase: TaskPhase;
  stuckSince: Date;
  stuckDuration: number; // milliseconds
  lastError?: {
    message: string;
    phase: string;
    timestamp: Date;
    logs: string[];
  };
  actions: {
    retry: () => Promise<RetryResult>;
    showDiagnostics: () => void;
    escalate: () => Promise<EscalationResult>;
  };
}
```

**TokenExpiration**:
```typescript
interface TokenExpiration {
  method: 'session' | 'long-lived';
  expiresAt?: Date; // undefined for long-lived
  remainingMs?: number;
  urgencyLevel: 'safe' | 'warning' | 'critical'; // >30m / 10-30m / <10m
}
```

**TaskAge**:
```typescript
interface TaskAge {
  taskId: string;
  phase: TaskPhase;
  enteredPhaseAt: Date;
  timeInPhaseMs: number;
  colorTier: 'green' | 'yellow' | 'orange' | 'red'; // <1h / 1-4h / 4-12h / >12h
  formattedDuration: string; // "45m", "3h 20m", "2d"
}
```

**BulkActionState**:
```typescript
interface BulkActionState {
  selectedComponentIds: string[];
  operation?: 'restart' | 'viewLogs' | 'delete';
  results: Map<string, ComponentOperationResult>;
  inProgress: boolean;
}

interface ComponentOperationResult {
  componentId: string;
  status: 'pending' | 'success' | 'failure';
  message?: string;
}
```

**FileSearchState**:
```typescript
interface FileSearchState {
  query: string;
  filteredBlobs: BlobItem[];
  matchCount: number;
  totalCount: number;
}
```

#### Backend API Contracts

Generate OpenAPI specifications in `contracts/` directory:

**contracts/tasks-api.yaml**:
```yaml
POST /api/tasks/{id}/retry:
  description: Retry a stuck task from last checkpoint
  parameters:
    - name: id
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Retry initiated
      content:
        application/json:
          schema:
            type: object
            properties:
              status:
                type: string
                enum: [retrying, success, failed]
              message: string
              executionId: string
    400:
      description: Task not in stuck state
    404:
      description: Task not found

GET /api/tasks/{id}/diagnostics:
  description: Retrieve diagnostic information for stuck task
  parameters:
    - name: id
      in: path
      required: true
      schema:
        type: string
  responses:
    200:
      description: Diagnostic data
      content:
        application/json:
          schema:
            type: object
            properties:
              taskId: string
              phase: string
              lastError:
                type: object
                properties:
                  message: string
                  timestamp: string (ISO 8601)
                  logs: array of string
              stuckSince: string (ISO 8601)

POST /api/tasks/{id}/escalate:
  description: Escalate task to on-call team via Teams webhook
  parameters:
    - name: id
      in: path
      required: true
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            reason: string (optional)
  responses:
    200:
      description: Escalation sent
      content:
        application/json:
          schema:
            type: object
            properties:
              escalated: boolean
              notificationId: string
```

**contracts/auth-api.yaml**:
```yaml
GET /api/auth/status:
  description: Get authentication status including expiration
  responses:
    200:
      description: Auth status
      content:
        application/json:
          schema:
            type: object
            properties:
              authenticated: boolean
              method:
                type: string
                enum: [session, long-lived]
              expiresAt: string (ISO 8601) | null
              user:
                type: object
                properties:
                  email: string
```

**contracts/components-api.yaml**:
```yaml
POST /api/components/bulk-restart:
  description: Restart multiple components simultaneously
  requestBody:
    content:
      application/json:
        schema:
          type: object
          properties:
            componentIds:
              type: array
              items: string
  responses:
    200:
      description: Bulk restart initiated
      content:
        application/json:
          schema:
            type: object
            properties:
              results:
                type: array
                items:
                  type: object
                  properties:
                    componentId: string
                    status: string (pending | success | failure)
                    message: string (optional)

GET /api/components/logs:
  description: Fetch logs for multiple components
  parameters:
    - name: componentIds
      in: query
      required: true
      schema:
        type: array
        items: string
  responses:
    200:
      description: Component logs
      content:
        application/json:
          schema:
            type: object
            additionalProperties:
              type: array
              items: string (log lines)
```

### Quickstart Guide

Generate `quickstart.md` with developer setup instructions:

```markdown
# Dashboard UX Improvements - Developer Quick start

## Prerequisites

- Node.js 20+ installed
- Access to Azure AD (MSAL) credentials
- Azure Blob Storage access
- AKS cluster access (for K8s API testing)

## Backend Setup

1. Install dependencies:
   ```bash
   cd dashboard/backend
   npm install
   ```

2. Configure environment variables (`.env`):
   ```
   AZURE_STORAGE_ACCOUNT=iiusagentstore
   AZURE_TENANT_ID=...
   AZURE_CLIENT_ID=...
   K8S_CLUSTER=dev-aks
   TEAMS_WEBHOOK_URL=https://...
   ```

3. Run backend in dev mode:
   ```bash
   npm run dev
   ```

4. Run backend tests:
   ```bash
   npm test
   ```

## Frontend Setup

1. Install dependencies:
   ```bash
   cd dashboard/frontend
   npm install
   ```

2. Configure environment variables (`.env.local`):
   ```
   VITE_API_URL=http://localhost:3001
   VITE_AZURE_AD_CLIENT_ID=...
   VITE_AZURE_AD_TENANT_ID=...
   ```

3. Run frontend in dev mode:
   ```bash
   npm run dev
   ```

4. Run frontend tests:
   ```bash
   npm test                # Unit tests
   npm run test:e2e       # E2E tests (requires backend running)
   ```

## Testing Individual Features

### Stuck Task Actions
1. Navigate to Pipeline Board with test task in stuck state (>30 min in phase)
2. Verify action panel displays with 3 buttons
3. Click "Retry Task" - check console for API call
4. Click "Why Stuck?" - verify modal opens with diagnostics

### Token Expiration Countdown
1. Authenticate with session token method (not long-lived)
2. Navigate to Token Refresh panel
3. Verify countdown timer displays
4. Wait until <10 minutes remaining - verify red color + "Refresh Now" button

### Task Age Heat Map
1. Create test tasks with varying ages (mock data or real)
2. Verify color coding: green (<1h), yellow (1-4h), orange (4-12h), red (>12h)
3. Verify time-in-phase badge displays on each card

### Bulk Component Actions
1. Navigate to Health Panel with multiple components
2. Select 2+ components via checkboxes
3. Verify bulk action toolbar appears
4. Click "Restart All" - verify confirmation dialog
5. Confirm - verify simultaneous restart API calls

### File Search
1. Navigate to Storage Browser with container selected
2. Type search query (e.g., task ID)
3. Verify real-time filtering of file tree
4. Verify match count display
5. Test Ctrl+K shortcut - verify focus moves to search input
```

---

**Phase 1 Output**:
- `data-model.md` with entity definitions
- `contracts/tasks-api.yaml`, `contracts/auth-api.yaml`, `contracts/components-api.yaml`
- `quickstart.md` with setup instructions

## Phase 2: Task Generation

**Not included in `/speckit.plan` command output** - this phase is handled by `/speckit.tasks` command.

The tasks will be generated based on the data model and contracts defined above, following this implementation sequence:

1. Backend API endpoints (tasks, auth, components)
2. Frontend hooks (useTaskAge, useTokenExpiration, useBulkActions, useFileSearch)
3. Frontend components (StuckTaskActions, CountdownTimer, BulkActionToolbar, SearchInput)
4. Component modifications (TaskCard, TokenRefresh, HealthPanel, StorageBrowser)
5. Integration testing (E2E tests for each user story)

## Agent Context Update

After Phase 1 completion, run:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will update `CLAUDE.md` with new technologies introduced by this feature (if any). Current feature uses existing tech stack - no new dependencies added beyond standard React patterns.

---

**Plan Status**: ✅ Ready for Phase 0 Research
**Next Command**: Agent will begin Phase 0 research tasks R1-R5
