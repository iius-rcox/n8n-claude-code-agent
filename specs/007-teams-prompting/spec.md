# Feature Specification: Teams Prompting

**Feature Branch**: `007-teams-prompting`
**Created**: 2026-01-15
**Status**: Draft
**Input**: Sprint 7 from sprint-plan-v4.6.2.md - Enable proactive Teams notifications for Claude reauthentication

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Teams Workflow Webhook Setup (Priority: P1)

As a system administrator, I need to create a Microsoft Teams incoming webhook so that the Claude agent can send notifications to the team when authentication issues are detected.

**Why this priority**: Without a configured Teams webhook, no notifications can be sent. This is the foundational infrastructure that enables all proactive alerting capabilities.

**Independent Test**: Can be fully tested by creating the webhook in Teams, storing the URL in Kubernetes, and sending a test message to verify the channel receives it.

**Acceptance Scenarios**:

1. **Given** access to Microsoft Teams admin console, **When** I create a new incoming webhook workflow, **Then** the workflow is created and returns a webhook URL
2. **Given** a valid webhook URL, **When** I store it in the Kubernetes secret, **Then** the secret is accessible to pods in the claude-agent namespace
3. **Given** the webhook is configured, **When** I send a test notification, **Then** the Teams channel displays the message with proper formatting

---

### User Story 2 - Authentication Watchdog CronJob (Priority: P2)

As a system administrator, I need an automated job that periodically checks Claude authentication status and alerts the team if credentials have expired, so that authentication issues are detected and reported without manual monitoring.

**Why this priority**: The watchdog enables proactive detection of authentication failures. Without it, expired tokens would only be discovered when n8n workflows fail, causing delays and potential data loss.

**Independent Test**: Can be fully tested by deploying the CronJob, triggering it manually, and verifying it correctly detects authentication status and sends appropriate notifications.

**Acceptance Scenarios**:

1. **Given** a deployed CronJob, **When** the scheduled time arrives, **Then** the job executes the authentication check script
2. **Given** valid Claude session tokens, **When** the watchdog runs, **Then** no notification is sent and the job completes with exit code 0
3. **Given** expired Claude session tokens, **When** the watchdog runs, **Then** a Teams notification is sent with re-authentication steps and the job completes with exit code 57
4. **Given** the CronJob fails to start within the deadline, **When** the deadline passes, **Then** the job is skipped and a new job is scheduled at the next interval

---

### User Story 3 - End-to-End n8n Integration (Priority: P3)

As an n8n workflow developer, I need to verify that n8n workflows can successfully invoke the Claude agent via HTTP and receive responses, so that the full integration is confirmed working before production use.

**Why this priority**: While the HTTP server was deployed in Sprint 5, this story validates the complete integration path from n8n through the service to Claude execution. This confirms the entire system is production-ready.

**Independent Test**: Can be fully tested by creating an n8n HTTP Request node that sends a prompt to the Claude agent service and verifying a successful response with valid output.

**Acceptance Scenarios**:

1. **Given** an n8n workflow with an HTTP Request node, **When** it sends a POST to the Claude agent /run endpoint with a valid prompt, **Then** the workflow receives HTTP 200 with a JSON response containing the Claude output
2. **Given** a successful Claude execution, **When** the response is parsed, **Then** it contains `success: true`, `output` with Claude's response, and `exitCode: 0`
3. **Given** a prompt that causes an error, **When** the request completes, **Then** the response contains `success: false` and an appropriate error message

---

### Edge Cases

- What happens when the Teams webhook URL is invalid or expired? The notification script logs the failure and returns a non-zero exit code, but the CronJob still completes.
- What happens when the CronJob runs concurrently? The `concurrencyPolicy: Forbid` setting prevents overlapping executions, skipping the new job if one is already running.
- What happens when the Claude authentication check times out? The script times out after a configured duration (default 30 seconds) and treats it as an authentication failure.
- What happens when Teams is unavailable? The notification fails but the authentication check result is still logged; retry is not automatic.
- What happens when n8n sends a malformed request? The HTTP server returns HTTP 400 with a descriptive error message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support creating a Microsoft Teams incoming webhook workflow
- **FR-002**: System MUST store the Teams webhook URL as a Kubernetes secret in the claude-agent namespace
- **FR-003**: System MUST provide a CronJob that runs authentication checks at a configurable interval (default: every 30 minutes)
- **FR-004**: CronJob MUST detect expired Claude session tokens by executing a test prompt
- **FR-005**: CronJob MUST send a Teams notification when authentication fails, including re-authentication instructions
- **FR-006**: CronJob MUST NOT send a notification when authentication succeeds
- **FR-007**: CronJob MUST use exit code 0 for success and exit code 57 for authentication failure
- **FR-008**: CronJob MUST have `concurrencyPolicy: Forbid` to prevent overlapping executions
- **FR-009**: CronJob MUST have `startingDeadlineSeconds` configured to handle delayed starts
- **FR-010**: CronJob MUST run with the same security context as the main deployment (non-root, read-only filesystem, dropped capabilities)
- **FR-011**: Teams notification MUST include the pod name, timestamp, and a link to refresh steps
- **FR-012**: Teams notification MUST use MessageCard format with proper formatting
- **FR-013**: System MUST support end-to-end testing via n8n HTTP Request to the /run endpoint
- **FR-014**: n8n integration MUST work via the ClusterIP service URL: `http://claude-agent.claude-agent.svc.cluster.local`

### Key Entities

- **Teams Webhook**: An incoming webhook URL that accepts POST requests with MessageCard payloads; stored as Kubernetes secret `teams-webhook`
- **CronJob**: A Kubernetes CronJob named `claude-auth-watchdog` that schedules periodic authentication checks; runs in claude-agent namespace
- **Notification**: A Teams MessageCard sent when authentication fails; contains pod name, timestamp, error details, and remediation link

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Teams webhook receives notifications within 30 seconds of authentication failure detection
- **SC-002**: CronJob executes authentication check every 30 minutes (±5 minutes tolerance for scheduling)
- **SC-003**: Authentication check completes within 30 seconds under normal conditions
- **SC-004**: n8n workflows can invoke Claude agent and receive response within 5 minutes for typical prompts
- **SC-005**: Zero false positive notifications (no alerts when authentication is valid)
- **SC-006**: 100% of authentication failures result in a Teams notification being sent
- **SC-007**: End-to-end n8n integration test completes successfully with valid Claude output

## Assumptions

- Microsoft Teams is available and the user has permissions to create incoming webhooks
- The claude-agent namespace and pod are deployed and running (Sprint 5 complete)
- Claude session tokens may be valid or expired (Sprint 6 verification may need refresh)
- n8n is deployed in the `n8n-prod` namespace with pods labeled `app: n8n`
- NetworkPolicy `allow-ingress-from-n8n` permits traffic from n8n to claude-agent on port 3000
- The notification and authentication check scripts are already present in the container image (Sprint 4)

## Dependencies

- **Sprint 1 (Azure Infrastructure)**: Managed identity for Workload Identity
- **Sprint 4 (Docker Image)**: Container includes `check-auth.sh` and `notify.sh` scripts
- **Sprint 5 (Kubernetes Deployment)**: Deployment running with HTTP server, teams-webhook secret reference exists
- **Sprint 6 (Verification)**: All authentication mechanisms verified working

## Out of Scope

- Automated token refresh (requires manual re-authentication via Claude CLI)
- Multiple notification channels (only Teams supported)
- Custom notification templates (uses predefined MessageCard format)
- Slack or other messaging platform integration
- Metrics collection or monitoring dashboards
- Automatic retry on notification failure
