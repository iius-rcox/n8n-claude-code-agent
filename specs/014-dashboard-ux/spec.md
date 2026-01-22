# Feature Specification: Dashboard UX Improvements - Phase 1

**Feature Branch**: `014-dashboard-ux`
**Created**: 2026-01-21
**Status**: Draft
**Input**: User description: "1, 3, 4, 7, 8" (Selected high-impact UX improvements from comprehensive dashboard review)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resolve Stuck Tasks (Priority: P1)

As a dashboard operator monitoring the autonomous dev team pipeline, I need to resolve tasks that get stuck in phases so that work continues flowing through the system without manual intervention in external tools.

**Why this priority**: Live production testing revealed 2-3 stuck tasks with no resolution path - this is the #1 operator pain point blocking productivity. Operators must currently leave the dashboard to investigate and fix stuck tasks in n8n or Azure portal.

**Independent Test**: Navigate to Pipeline Board with stuck tasks visible. Click "Retry Task" button on a stuck task card. Verify task progresses to next phase or displays diagnostic information. Feature delivers immediate value by unblocking operators.

**Acceptance Scenarios**:

1. **Given** a task has been stuck in Implementation phase for over 30 minutes, **When** the operator views the Pipeline Board, **Then** the task card displays a highlighted action panel with "Retry Task", "Why Stuck?", and "Escalate" buttons
2. **Given** an operator clicks "Retry Task" on a stuck task, **When** the retry action executes, **Then** the system attempts to continue the task from its last checkpoint and shows real-time progress feedback
3. **Given** an operator clicks "Why Stuck?" on a stuck task, **When** the diagnostic modal opens, **Then** it displays the last error message, failed phase, timestamp, and relevant log excerpts
4. **Given** an operator clicks "Escalate" on a stuck task, **When** the escalation completes, **Then** the system notifies the on-call team and marks the task as "Awaiting Human Review"
5. **Given** a task becomes stuck (>30 minutes in single phase), **When** the stuck state is detected, **Then** the task card auto-expands and pulses to draw operator attention

---

### User Story 2 - Track Token Expiration (Priority: P1)

As a dashboard operator responsible for system uptime, I need to know when authentication tokens will expire so that I can proactively renew them before they cause agent failures.

**Why this priority**: Authentication failures (exit code 57) block all agent operations. Currently no warning before expiry - operators only discover expired tokens after failures occur, causing cascading issues.

**Independent Test**: View the Token Refresh panel when tokens have less than 30 minutes until expiry. Verify countdown timer displays with color-coded urgency and "Refresh Now" button. Delivers immediate preventive value.

**Acceptance Scenarios**:

1. **Given** a session token has 25 minutes remaining, **When** the operator views the Token Refresh panel, **Then** a countdown timer displays showing "25m remaining" with yellow color coding
2. **Given** a session token has less than 10 minutes remaining, **When** the countdown updates, **Then** the timer displays in red and shows a prominent "Refresh Now" button
3. **Given** a long-lived token is active, **When** the operator views the Token Refresh panel, **Then** no countdown displays (long-lived tokens never expire)
4. **Given** a token countdown reaches 5 minutes remaining, **When** the threshold is crossed, **Then** a toast notification appears suggesting the user switch to long-lived token method
5. **Given** an operator clicks "Refresh Now", **When** the action triggers, **Then** the system navigates to the Session Refresh tab with the token input focused

---

### User Story 3 - Identify Aging Tasks Visually (Priority: P2)

As a dashboard operator monitoring task throughput, I need to quickly identify which tasks have been in their current phase the longest so that I can prioritize investigation efforts.

**Why this priority**: Current task cards all look identical regardless of age. Operators must click into each task detail to check time in phase. Visual heat map enables 90% faster identification of problematic tasks.

**Independent Test**: View Pipeline Board with tasks of varying ages. Verify cards show color gradient from green (recent) to red (old). Can be tested independently and delivers immediate visual clarity without requiring other features.

**Acceptance Scenarios**:

1. **Given** a task has been in its current phase for less than 1 hour, **When** the operator views the Pipeline Board, **Then** the task card displays with green border and badge showing duration
2. **Given** a task has been in its current phase for 1-4 hours, **When** the operator views the Pipeline Board, **Then** the task card displays with yellow border
3. **Given** a task has been in its current phase for 4-12 hours, **When** the operator views the Pipeline Board, **Then** the task card displays with orange border
4. **Given** a task has been in its current phase for over 12 hours, **When** the operator views the Pipeline Board, **Then** the task card displays with red border and pulses to draw attention
5. **Given** multiple tasks in a column, **When** the operator scans the Pipeline Board, **Then** cards are visually distinguishable by age at a glance without reading text

---

### User Story 4 - Restart Multiple Failing Components (Priority: P2)

As a dashboard operator troubleshooting system health issues, I need to restart multiple failed pods simultaneously so that I can recover from cluster-wide issues quickly.

**Why this priority**: Health Panel currently requires clicking into each component individually to restart. When multiple pods fail (observed: 3 auth-watchdog pods), operators waste time on repetitive actions. Bulk operations reduce recovery time from minutes to seconds.

**Independent Test**: Select multiple unhealthy components via checkboxes in Health Panel. Click "Restart All" bulk action. Verify all selected components restart simultaneously. Delivers standalone value for mass operations.

**Acceptance Scenarios**:

1. **Given** 3 auth-watchdog pods are showing "Failed" status, **When** the operator selects their checkboxes, **Then** a bulk action toolbar appears showing "3 selected"
2. **Given** multiple components are selected, **When** the operator clicks "Restart All", **Then** a confirmation dialog displays listing the components to be restarted
3. **Given** the operator confirms bulk restart, **When** the action executes, **Then** all selected components restart simultaneously and show "Restarting..." status
4. **Given** bulk restart completes, **When** components finish restarting, **Then** success indicators display and the selection clears automatically
5. **Given** the operator selects components and clicks "View Logs", **When** the action triggers, **Then** a tabbed view opens showing logs from all selected components

---

### User Story 5 - Search Storage Files Quickly (Priority: P3)

As a dashboard operator investigating task failures, I need to quickly find specific task envelope files across storage containers so that I can review task state without manually browsing folder trees.

**Why this priority**: Storage Browser currently requires manual tree navigation to find files among hundreds of blobs across 6 containers. Search reduces discovery time from 2-3 minutes to 5-10 seconds. Lower priority than operational blockers but high efficiency gain.

**Independent Test**: Open Storage Browser, type task ID into search field. Verify tree filters to show only matching files. Delivers standalone search value without requiring other features.

**Acceptance Scenarios**:

1. **Given** operator knows a task ID (e.g., "TASK-001"), **When** they type "TASK-001" into the search field, **Then** the file tree filters to show only blobs containing "TASK-001" in their path
2. **Given** operator searches for "envelope.json", **When** the search executes, **Then** all task envelope files across all containers display in filtered tree
3. **Given** search results are displayed, **When** the operator clears the search, **Then** the full tree structure restores immediately
4. **Given** operator searches with no matches, **When** the search completes, **Then** a message displays "0 of [total] files match" with suggestion to try different terms
5. **Given** operator uses keyboard shortcut Ctrl+K, **When** the shortcut triggers, **Then** focus moves to the storage search field instantly

---

### Edge Cases

- What happens when an operator retries a stuck task but the underlying issue (e.g., expired GitHub token) hasn't been resolved?
- How does the system handle bulk restart when some components fail to restart but others succeed?
- What happens if token countdown reaches zero while operator is actively working on a command?
- How does task age heat map handle tasks that move between phases (does color reset)?
- What happens when storage search query contains special characters or regex patterns?
- How does the system handle stuck task escalation if Teams webhook is unavailable?
- What happens when bulk actions are triggered on components in different namespaces or clusters?

## Requirements *(mandatory)*

### Functional Requirements

#### Stuck Task Actions (US1)

- **FR-001**: System MUST detect when a task remains in a single phase for more than 30 minutes and mark it as "stuck"
- **FR-002**: System MUST display an action panel on stuck task cards with three buttons: "Retry Task", "Why Stuck?", and "Escalate"
- **FR-003**: System MUST auto-expand stuck task cards and apply pulse animation to draw operator attention
- **FR-004**: When operator clicks "Retry Task", system MUST attempt to continue the task from its last known checkpoint via backend API
- **FR-005**: When operator clicks "Why Stuck?", system MUST display a modal showing last error message, failed phase name, stuck timestamp, and log excerpts
- **FR-006**: When operator clicks "Escalate", system MUST send notification to on-call team and update task status to "Awaiting Human Review"
- **FR-007**: System MUST show real-time progress feedback (spinner, status updates) during retry attempts
- **FR-008**: System MUST display error messages in user-friendly language if retry or escalation actions fail

#### Token Expiration Countdown (US2)

- **FR-009**: System MUST calculate remaining time until token expiration for session-based authentication method
- **FR-010**: System MUST display countdown timer in Token Refresh panel showing time remaining in human-readable format (e.g., "25m", "2h 15m")
- **FR-011**: System MUST color-code countdown timer: green (>30 min), yellow (10-30 min), red (<10 min)
- **FR-012**: System MUST show "Refresh Now" button when countdown drops below 30 minutes
- **FR-013**: When countdown reaches 5 minutes, system MUST display toast notification suggesting switch to long-lived token method
- **FR-014**: System MUST hide countdown timer when long-lived token method is active (tokens never expire)
- **FR-015**: When operator clicks "Refresh Now", system MUST navigate to Session Refresh tab and focus token input field
- **FR-016**: System MUST poll token expiration status every 60 seconds to keep countdown accurate

#### Task Age Heat Map (US3)

- **FR-017**: System MUST calculate time elapsed since task entered its current phase
- **FR-018**: System MUST apply color-coded border to task cards: green (<1h), yellow (1-4h), orange (4-12h), red (>12h)
- **FR-019**: System MUST display time-in-phase badge on each task card in top-right corner
- **FR-020**: System MUST apply pulse animation to task cards with red borders (>12h in phase)
- **FR-021**: System MUST reset color coding when task transitions to a new phase
- **FR-022**: System MUST format time-in-phase badge in human-readable duration (e.g., "45m", "3h 20m", "2d")

#### Bulk Component Actions (US4)

- **FR-023**: System MUST display checkbox on each component card in Health Panel
- **FR-024**: When one or more checkboxes are selected, system MUST display bulk action toolbar showing count of selected components
- **FR-025**: Bulk action toolbar MUST provide three buttons: "Restart All", "View Logs", "Delete"
- **FR-026**: When operator clicks "Restart All", system MUST display confirmation dialog listing all components to be restarted
- **FR-027**: After confirmation, system MUST send restart commands to all selected components simultaneously
- **FR-028**: System MUST display "Restarting..." status on each selected component during restart operation
- **FR-029**: System MUST show success/failure indicators for each component after restart completes
- **FR-030**: When operator clicks "View Logs", system MUST open tabbed view with logs from all selected components
- **FR-031**: System MUST clear selection automatically after successful bulk operation completion
- **FR-032**: System MUST handle partial failures gracefully (some components restart successfully, others fail)

#### File Search (US5)

- **FR-033**: System MUST provide search input field at top of Storage Browser panel
- **FR-034**: System MUST filter file tree in real-time as operator types search query
- **FR-035**: System MUST perform case-insensitive fuzzy matching on blob paths
- **FR-036**: System MUST display count of matching files (e.g., "12 of 458 files match")
- **FR-037**: System MUST highlight matching text within file/folder names in filtered tree
- **FR-038**: When search query is cleared, system MUST restore full tree structure immediately
- **FR-039**: When no results match, system MUST display helpful message: "0 of [total] files match. Try different search terms."
- **FR-040**: System MUST respond to keyboard shortcut Ctrl+K (Cmd+K on Mac) to focus search field
- **FR-041**: System MUST search across all blobs in currently selected container only (not across multiple containers)

### Key Entities

- **Stuck Task**: A task that has remained in the same pipeline phase (Intake, Planning, Implementation, Verification, Review) for more than 30 minutes without progressing, indicating a potential failure or blocker requiring operator intervention
- **Task Card**: Visual representation of a single task in the Pipeline Board, displaying task ID, title, status, phase, priority, and action buttons
- **Authentication Token**: Credential used by Claude agents to authenticate with Claude API, available in two types: session tokens (expire after time period) and long-lived tokens (never expire)
- **Component**: A system element monitored in the Health Panel, including pod deployments, authentication services, CronJobs, storage accounts, and n8n workflows
- **Blob**: A file stored in Azure Blob Storage containers, including task envelopes, specifications, plans, verification reports, and review artifacts
- **Bulk Action**: An operation applied simultaneously to multiple selected components, reducing repetitive manual tasks

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can identify stuck tasks visually within 5 seconds of viewing Pipeline Board (down from 1-2 minutes clicking through cards)
- **SC-002**: Operators can retry stuck tasks directly from dashboard in under 10 seconds (eliminating need to navigate to n8n or Azure portal)
- **SC-003**: Zero authentication failures occur due to expired tokens without prior warning (currently unpredictable outages)
- **SC-004**: Operators can restart 3+ failed components in under 15 seconds (down from 2-3 minutes of repetitive actions)
- **SC-005**: Operators can locate specific task files in storage within 10 seconds using search (down from 2-3 minutes manual browsing)
- **SC-006**: 90% of stuck task retry attempts either successfully continue the task or provide actionable diagnostic information
- **SC-007**: Operator satisfaction with "ability to resolve issues quickly" improves from baseline to 8+/10 rating
- **SC-008**: Mean time to resolution (MTTR) for stuck tasks decreases by 60% from current baseline
- **SC-009**: Support escalations for stuck tasks reduce by 50% (operators self-service resolution increases)
- **SC-010**: Zero critical system issues are missed due to delayed token expiration awareness

## Assumptions *(mandatory)*

- Backend API endpoints already exist for task retry operations, or will be implemented as part of this feature
- Teams webhook integration for escalation notifications is already configured and accessible
- Token expiration timestamps are available from the authentication service backend
- Health Panel component restart operations connect to existing Kubernetes API or Azure management APIs
- Storage Browser already has access to full blob metadata including paths and names
- Task phase transition timestamps are already being tracked in the task envelope data structure
- Dashboard operators have necessary permissions to restart pods and escalate tasks
- Bulk operations on components are idempotent (safe to retry if network fails mid-operation)

## Dependencies *(mandatory)*

### Internal Dependencies

- Backend API must provide `/api/tasks/:id/retry` endpoint for stuck task retry operations
- Backend API must provide `/api/tasks/:id/diagnostics` endpoint returning error logs and failure context
- Backend API must provide Teams webhook integration for task escalation notifications
- Authentication service must expose token expiration timestamp via existing `/api/auth/status` endpoint
- Health Panel must have access to component restart APIs (Kubernetes or Azure Resource Manager)
- Storage Browser must continue to receive full blob list from backend `/api/storage/:container/blobs` endpoint

### External Dependencies

- Azure AD (MSAL) for authentication token management
- Azure Kubernetes Service (AKS) API for pod restart operations
- Azure Blob Storage API for file search operations
- Microsoft Teams webhook for escalation notifications
- WebSocket connection to backend for real-time task status updates

### Technical Constraints

- Search filtering must handle up to 1000 blobs in a container without UI lag (performance threshold)
- Token countdown polling must not exceed 1 request per minute to avoid backend load
- Bulk restart operations must provide per-component status updates (no all-or-nothing UX)
- Task age calculations must account for timezone differences between server and browser
- Color-coded task borders must meet WCAG 2.1 AA contrast ratios for accessibility

## Scope Boundaries *(mandatory)*

### In Scope

- Visual detection of stuck tasks (color coding, pulse animation, auto-expand)
- Three-button action panel for stuck tasks (Retry, Why Stuck, Escalate)
- Modal dialog showing diagnostic information when "Why Stuck?" is clicked
- Countdown timer for session token expiration with color-coded urgency levels
- Proactive toast notification at 5 minutes before token expiry
- Color-coded task card borders based on time in current phase (heat map)
- Time-in-phase badge displayed on each task card
- Checkbox selection for multiple components in Health Panel
- Bulk action toolbar with Restart All, View Logs, and Delete operations
- Confirmation dialogs for destructive bulk operations
- Real-time fuzzy search filtering in Storage Browser file tree
- Keyboard shortcut (Ctrl+K) to focus storage search field
- Match count display during search (e.g., "12 of 458 files match")

### Out of Scope

- Automatic remediation of stuck tasks without operator involvement (future enhancement)
- Predictive alerts for tasks likely to become stuck based on historical patterns
- Automatic token renewal without operator action (requires backend changes)
- Cross-container search in Storage Browser (search limited to currently selected container)
- Scheduling bulk operations to run at future times
- Audit logging of bulk operations (assumed to be handled by backend)
- Bulk operations across multiple AKS clusters or Azure subscriptions
- Machine learning models to predict optimal retry strategies for stuck tasks
- Integration with external incident management systems beyond Teams (e.g., PagerDuty, ServiceNow)
- Mobile-responsive optimizations for these features (desktop-first dashboard)

## Open Questions

None remaining. All requirements are clear and testable.
