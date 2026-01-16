# Feature Specification: Operations Dashboard

**Feature Branch**: `009-ops-dashboard`
**Created**: 2026-01-16
**Status**: Draft
**Input**: User description: "I think we need a basic UI that wraps all of these daily operations and token refreshes into an easier to use tool"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Token Refresh Workflow (Priority: P1)

An operator needs to refresh Claude session tokens when they expire (exit code 57). Currently this requires running multiple kubectl commands manually. The dashboard provides a single-click token refresh that handles the entire process.

**Why this priority**: Token expiration blocks all Claude agent operations. This is the most frequent and critical daily operation that operators need to perform.

**Independent Test**: Can be fully tested by clicking "Refresh Tokens" button and verifying Claude authentication succeeds afterward. Delivers immediate value by eliminating manual command execution.

**Acceptance Scenarios**:

1. **Given** the dashboard is open and Claude tokens are expired, **When** operator clicks "Refresh Tokens", **Then** the system displays a CLI command for the operator to run locally (after `claude /login`) which pushes credentials to the dashboard and triggers the full refresh sequence (delete old secret, create new secret, restart deployment, verify auth)
2. **Given** a token refresh is in progress, **When** operator views the dashboard, **Then** they see real-time progress of each step (delete, create, restart, verify)
3. **Given** token refresh completes successfully, **When** operator views the result, **Then** they see confirmation message with timestamp and verification output
4. **Given** token refresh fails at any step, **When** operator views the result, **Then** they see which step failed, the error message, and suggested remediation

---

### User Story 2 - System Health Overview (Priority: P1)

An operator wants to quickly see the health status of all Claude agent components without running multiple kubectl commands. The dashboard displays real-time health of pods, services, and authentication status.

**Why this priority**: Understanding system health is essential before performing any operations. Operators need this visibility to diagnose issues and verify the system is operational.

**Independent Test**: Can be fully tested by viewing dashboard and comparing displayed health status with actual kubectl output. Delivers value by providing instant visibility.

**Acceptance Scenarios**:

1. **Given** the dashboard loads, **When** operator views the health panel, **Then** they see pod status (running/pending/failed), replica count, and last restart time
2. **Given** Claude authentication is valid, **When** operator views auth status, **Then** they see "Authenticated" with token expiry estimate
3. **Given** Claude authentication has failed, **When** operator views auth status, **Then** they see "Authentication Failed" with exit code and timestamp of last failure
4. **Given** any component is unhealthy, **When** operator views dashboard, **Then** unhealthy components are visually highlighted (color-coded)

---

### User Story 3 - Manual Agent Execution (Priority: P2)

An operator wants to manually trigger a Claude agent run for testing or ad-hoc tasks without crafting webhook requests. The dashboard provides a simple form to execute prompts.

**Why this priority**: Useful for testing and debugging, but less critical than monitoring and token refresh which are daily necessities.

**Independent Test**: Can be tested by entering a test prompt and verifying Claude executes it successfully. Delivers value by simplifying ad-hoc testing.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** operator enters a prompt and clicks "Run", **Then** the system sends the prompt to Claude agent and displays the response
2. **Given** a prompt is executing, **When** operator views the execution panel, **Then** they see a loading indicator and can cancel if needed
3. **Given** prompt execution completes, **When** operator views the result, **Then** they see the full output, exit code, and execution duration

---

### User Story 4 - View Recent Executions (Priority: P2)

An operator wants to see recent Claude agent executions to understand system activity and troubleshoot issues. The dashboard shows execution history with filtering.

**Why this priority**: Important for troubleshooting but operators can use n8n execution history as an alternative.

**Independent Test**: Can be tested by triggering several executions and verifying they appear in history with correct details.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** operator views execution history, **Then** they see the last 20 executions with timestamp, exit code, and duration
2. **Given** execution history is displayed, **When** operator clicks an execution, **Then** they see full details including prompt, output, and any errors
3. **Given** execution history is displayed, **When** operator filters by exit code (success/error/auth), **Then** only matching executions are shown

---

### User Story 5 - CronJob Management (Priority: P3)

An operator wants to view and manage the authentication watchdog CronJob. The dashboard shows recent job runs and allows manual triggering.

**Why this priority**: The CronJob runs automatically every 30 minutes. Manual management is rarely needed.

**Independent Test**: Can be tested by viewing CronJob status and triggering a manual run.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** operator views CronJob panel, **Then** they see last 5 job runs with status and timestamps
2. **Given** CronJob panel is displayed, **When** operator clicks "Run Now", **Then** a manual auth check job is triggered immediately

---

### Edge Cases

- What happens when the dashboard backend cannot reach the Kubernetes cluster? Dashboard shows connection error with retry option.
- What happens when CLI push sends invalid credentials? Dashboard validates credentials format and shows clear error with instructions to re-run `claude /login`.
- What happens when token refresh succeeds but verification fails? Dashboard shows partial success with specific step that failed.
- What happens when the dashboard loses connection during an operation? Dashboard reconnects and shows last known state with warning.
- What happens when a user authenticates but is not in the authorized group? Dashboard shows "Access Denied" with instructions to request access.
- What happens when CLI push is called without valid session token? Endpoint rejects request with 401 and instructions to initiate refresh from dashboard first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display real-time pod health status (running, pending, failed, unknown)
- **FR-002**: System MUST display Claude authentication status (authenticated, expired, unknown)
- **FR-003**: System MUST provide one-click token refresh that executes the full refresh sequence
- **FR-004**: System MUST show progress feedback during multi-step operations
- **FR-005**: System MUST display clear error messages with suggested remediation steps
- **FR-006**: System MUST allow manual execution of Claude prompts with configurable timeout
- **FR-007**: System MUST display execution history with exit code, duration, and timestamp
- **FR-008**: System MUST allow filtering execution history by status
- **FR-009**: System MUST display CronJob status and recent job history
- **FR-010**: System MUST allow manual triggering of auth check CronJob
- **FR-011**: System MUST auto-refresh health status at configurable intervals (default: 30 seconds)
- **FR-012**: System MUST be deployed as a hosted web application with backend cluster access
- **FR-013**: System MUST authenticate operators via Azure AD SSO
- **FR-014**: System MUST restrict access to members of a designated Azure AD security group
- **FR-015**: System MUST provide a secure endpoint for CLI push of Claude credentials
- **FR-016**: System MUST display a ready-to-run CLI command for operators during token refresh workflow

### Key Entities

- **Health Status**: Represents the current state of a system component (pod, service, authentication). Attributes: component name, status (healthy/unhealthy/unknown), last checked timestamp, details.
- **Token Refresh Operation**: Represents a token refresh workflow execution. Attributes: start time, current step, step statuses, completion status, error details if any.
- **Execution Record**: Represents a Claude agent execution. Attributes: timestamp, prompt (truncated), exit code, duration, output summary.
- **CronJob Run**: Represents an auth watchdog job execution. Attributes: job name, start time, completion time, status, exit code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can complete token refresh in under 2 minutes (vs 5+ minutes with manual commands)
- **SC-002**: Operators can determine system health status within 5 seconds of opening dashboard
- **SC-003**: 95% of token refresh operations succeed on first attempt when credentials are valid
- **SC-004**: Dashboard displays health status updates within 30 seconds of actual state change
- **SC-005**: Operators can execute ad-hoc prompts without needing to construct webhook requests
- **SC-006**: Dashboard remains responsive during long-running operations (no UI freezing)

## Clarifications

### Session 2026-01-16

- Q: Where does the dashboard run? → A: Hosted web app (runs on a server, operators authenticate to cluster via UI)
- Q: How do operators authenticate? → A: Azure AD SSO with group-based access control (only select group members)
- Q: How are Claude credentials provided for token refresh? → A: CLI push script (operator runs command locally after claude /login to send credentials to dashboard)
- Q: What frontend framework? → A: React + shadcn/ui
- Q: Where to host the dashboard? → A: AKS (same cluster as Claude agent)

## Assumptions

- Operators have Azure AD accounts and are members of the designated security group
- Operators have network access to the dashboard web application
- Dashboard deployed in AKS with service account for in-cluster Kubernetes API access
- The existing n8n webhook endpoint and Claude agent service remain the primary execution path
- Token refresh uses a CLI push script that operator runs locally after `claude /login`
- Dashboard is intended for internal operations team use, not end users
- Single operator use at a time is acceptable (no concurrent operation handling required initially)
