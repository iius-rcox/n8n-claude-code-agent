# Feature Specification: Dashboard Observability Enhancements

**Feature Branch**: `010-dashboard-observability`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "Add observability features to ops dashboard: Task Pipeline Visualization (1), Blob Storage Browser (2), n8n Execution Feed (3), and System Health Overview (7)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - System Health At-a-Glance (Priority: P1)

As an operations team member, I need to see the health status of all system components on a single screen so I can quickly identify issues without running multiple commands or checking different systems.

**Why this priority**: This is the most fundamental observability need - knowing if the system is healthy. Without this, operators waste time checking individual components manually. This provides the foundation for all other observability features.

**Independent Test**: Can be fully tested by loading the dashboard and verifying all component statuses display correctly. Delivers immediate value by replacing manual health checks.

**Acceptance Scenarios**:

1. **Given** a user opens the dashboard, **When** the page loads, **Then** they see a health overview panel showing status of Claude Agent, n8n, Auth Watchdog, Azure Blob Storage, and Claude Authentication
2. **Given** all components are healthy, **When** viewing the health overview, **Then** all indicators show green status with "Healthy" labels
3. **Given** a component is unhealthy (e.g., Claude Agent pod not ready), **When** viewing the health overview, **Then** that component shows red status with descriptive error message
4. **Given** Claude authentication is expiring soon (within 24 hours), **When** viewing the health overview, **Then** the auth status shows yellow warning with time remaining
5. **Given** a user wants more details about a component, **When** they click on a component status, **Then** they see expanded details (pod count, version, last check time)

---

### User Story 2 - Task Pipeline Visibility (Priority: P2)

As an operations team member, I need to see tasks flowing through the autonomous dev team pipeline so I can understand work in progress and identify bottlenecks or stuck tasks.

**Why this priority**: Once health is confirmed, the next most valuable insight is understanding what work is happening. This enables monitoring of the autonomous team's productivity and identifying issues early.

**Independent Test**: Can be tested by submitting a feature request and watching it appear and move through pipeline stages. Delivers value by providing visibility into autonomous work without checking blob storage manually.

**Acceptance Scenarios**:

1. **Given** a user opens the dashboard, **When** navigating to the pipeline view, **Then** they see a Kanban-style board with columns for each phase: Intake, Planning, Implementation, Verification, Review, Release
2. **Given** tasks exist in the system, **When** viewing the pipeline, **Then** each task card shows task ID, title, time in current phase, and current agent (if applicable)
3. **Given** a task moves from one phase to another, **When** viewing the pipeline, **Then** the task card animates to the new column within 30 seconds of the state change
4. **Given** a task has been in a phase longer than expected (over 30 minutes), **When** viewing the pipeline, **Then** that task card is highlighted with a warning indicator
5. **Given** a user clicks on a task card, **When** the detail panel opens, **Then** they see task envelope contents, current phase, history of phase transitions, and links to artifacts

---

### User Story 3 - n8n Execution Monitoring (Priority: P3)

As an operations team member, I need to see n8n workflow executions in real-time so I can monitor what the orchestration system is doing and troubleshoot failed workflows.

**Why this priority**: After understanding overall health and task status, the next level of detail is workflow execution. This helps diagnose why tasks might be stuck or failing.

**Independent Test**: Can be tested by triggering a workflow and seeing it appear in the execution feed. Delivers value by providing workflow visibility without accessing n8n directly.

**Acceptance Scenarios**:

1. **Given** a user opens the dashboard, **When** navigating to the executions view, **Then** they see a live feed of recent n8n workflow executions
2. **Given** workflows are running, **When** viewing the execution feed, **Then** each entry shows workflow name, task ID, status (running/success/failed), duration, and timestamp
3. **Given** a workflow completes, **When** viewing the feed, **Then** the new completion appears within 10 seconds without page refresh
4. **Given** a workflow failed, **When** viewing the feed, **Then** the failed execution is highlighted in red with an error indicator
5. **Given** a user clicks on an execution entry, **When** the detail panel opens, **Then** they see full execution data including input/output and error messages if applicable
6. **Given** a user wants to filter executions, **When** using filter controls, **Then** they can filter by workflow name, status, and time range

---

### User Story 4 - Blob Storage Exploration (Priority: P4)

As an operations team member, I need to browse artifacts in Azure Blob Storage so I can inspect task envelopes, specifications, and other files without using command-line tools.

**Why this priority**: This enables deeper investigation when issues are found via the other panels. Lower priority because it's more of a debugging/inspection tool than real-time monitoring.

**Independent Test**: Can be tested by navigating to storage browser and viewing files. Delivers value by eliminating need for Azure CLI commands to inspect artifacts.

**Acceptance Scenarios**:

1. **Given** a user opens the dashboard, **When** navigating to the storage browser, **Then** they see a list of the 6 agent storage containers
2. **Given** a user selects a container, **When** the container view loads, **Then** they see a hierarchical list of folders (task IDs) and files within
3. **Given** a user selects a text file (YAML, JSON, Markdown), **When** clicking on it, **Then** they see a preview of the file contents with syntax highlighting
4. **Given** a user wants to download a file, **When** clicking the download button, **Then** the file downloads to their local machine
5. **Given** a stuck or orphaned blob needs cleanup, **When** a user clicks delete on a blob, **Then** the system prompts for confirmation and deletes the blob
6. **Given** a blob has an active lease (stuck), **When** a user views the blob, **Then** they see the lease status and have an option to break the lease

---

### Edge Cases

- What happens when Azure Blob Storage is unreachable? The storage browser shows a connection error with retry option, other panels continue to function
- What happens when n8n API is unreachable? The execution feed shows a connection error, other panels continue to function
- What happens when there are no tasks in the system? The pipeline view shows empty columns with a helpful message
- How does the system handle hundreds of tasks? The pipeline view implements pagination/virtualization to maintain performance
- What happens if the user's Azure AD token expires? The dashboard shows an authentication prompt without losing current view state

## Requirements *(mandatory)*

### Functional Requirements

**System Health Overview**
- **FR-001**: System MUST display health status for Claude Agent deployment (pod status, ready state)
- **FR-002**: System MUST display health status for n8n deployment (reachability)
- **FR-003**: System MUST display auth watchdog status (last successful run, next scheduled run)
- **FR-004**: System MUST display Azure Blob Storage connectivity status
- **FR-005**: System MUST display Claude authentication status including expiration time
- **FR-006**: System MUST auto-refresh health status every 30 seconds
- **FR-007**: System MUST provide visual indicators (green/yellow/red) for each component status

**Task Pipeline Visualization**
- **FR-008**: System MUST display tasks in a Kanban-style board with 6 phase columns
- **FR-009**: System MUST show task ID, title, and time in current phase on each card
- **FR-010**: System MUST highlight tasks that have been in a phase longer than 30 minutes
- **FR-011**: System MUST update task positions within 30 seconds of state changes
- **FR-012**: System MUST provide task detail view showing envelope contents and phase history
- **FR-013**: System MUST support clicking through to related artifacts (spec, plan, etc.)

**n8n Execution Feed**
- **FR-014**: System MUST display recent n8n workflow executions in chronological order
- **FR-015**: System MUST show workflow name, associated task ID, status, duration, and timestamp
- **FR-016**: System MUST highlight failed executions visually
- **FR-017**: System MUST update execution feed within 10 seconds of new completions
- **FR-018**: System MUST provide filtering by workflow name, status, and time range
- **FR-019**: System MUST show execution details including input/output data on click

**Blob Storage Browser**
- **FR-020**: System MUST list all 6 agent storage containers
- **FR-021**: System MUST display hierarchical folder/file structure within containers
- **FR-022**: System MUST preview text files (YAML, JSON, Markdown) with syntax highlighting
- **FR-023**: System MUST allow downloading individual files
- **FR-024**: System MUST allow deleting blobs with confirmation prompt
- **FR-025**: System MUST display blob lease status and provide option to break stuck leases
- **FR-026**: System MUST show file metadata (size, last modified, content type)

**Cross-Cutting Requirements**
- **FR-027**: System MUST maintain Azure AD authentication for all backend operations
- **FR-028**: System MUST handle API errors gracefully with user-friendly messages
- **FR-029**: System MUST allow navigation between panels without page reload

### Key Entities

- **Task**: Represents a feature request flowing through the pipeline. Contains task ID, title, current phase, timestamps, and links to artifacts.
- **Task Envelope**: The YAML document in blob storage containing task metadata, status, and phase history.
- **Workflow Execution**: A single run of an n8n workflow, with status, timing, and associated task reference.
- **Component Health**: Status information for a system component including state, version, and diagnostic details.
- **Blob Artifact**: A file in Azure Blob Storage, with container, path, metadata, and optional lease information.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can determine overall system health within 5 seconds of opening the dashboard
- **SC-002**: Operators can identify stuck tasks (in a phase over 30 minutes) without running any commands
- **SC-003**: Operators can view task pipeline state and identify bottlenecks in under 10 seconds
- **SC-004**: Operators can find and view the contents of any blob artifact in under 30 seconds
- **SC-005**: Operators can identify failed n8n executions and view error details in under 15 seconds
- **SC-006**: Dashboard reduces time to diagnose common issues by 75% compared to CLI-based investigation
- **SC-007**: All real-time updates appear within 30 seconds of underlying state changes
- **SC-008**: Dashboard remains responsive (under 2 second load time) with up to 100 tasks in the pipeline

## Assumptions

- The existing ops-dashboard infrastructure (React frontend, Express backend, Azure AD auth) will be extended
- n8n exposes a REST API for querying workflow executions
- Azure Blob Storage can be accessed via the existing workload identity
- The dashboard backend can proxy requests to n8n and Azure services
- Polling-based updates are acceptable; WebSocket real-time updates are not required for MVP
- Users accessing the dashboard have appropriate Azure AD permissions
