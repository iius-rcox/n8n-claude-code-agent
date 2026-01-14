# Feature Specification: Docker Image

**Feature Branch**: `004-docker-image`
**Created**: 2026-01-14
**Status**: Validated
**Input**: Sprint 4 from sprint-plan-v4.6.2.md - Build and push container image with all required tooling and scripts

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Container Image Build (Priority: P1)

As a DevOps engineer, I need a container image that includes all required tools (Azure CLI, GitHub CLI, Claude CLI, Node.js) so that the agent can authenticate and operate within the Kubernetes cluster.

**Why this priority**: Without a properly built container image, no deployment is possible. This is the foundational deliverable that enables all subsequent Kubernetes operations.

**Independent Test**: Can be fully tested by building the image locally and verifying all required tools are present and executable.

**Acceptance Scenarios**:

1. **Given** a Dockerfile exists, **When** I build the image, **Then** the build completes successfully without errors
2. **Given** the image is built, **When** I run a container, **Then** all required CLI tools (az, gh, claude, node, jq, yq) are available in PATH
3. **Given** the image is built, **When** I inspect the running user, **Then** processes run as a non-root user

---

### User Story 2 - HTTP Server with Health Endpoint (Priority: P2)

As the n8n orchestration system, I need an HTTP endpoint to invoke Claude prompts and check agent health so that workflows can reliably communicate with the agent.

**Why this priority**: The HTTP server is the integration point between n8n and the Claude agent. Without it, n8n cannot invoke the agent or monitor its status.

**Independent Test**: Can be fully tested by starting the HTTP server locally and making requests to `/health` and `/run` endpoints.

**Acceptance Scenarios**:

1. **Given** the HTTP server is running, **When** I request `/health`, **Then** I receive a JSON response indicating healthy status
2. **Given** the HTTP server is running, **When** I send a POST to `/run` with a prompt, **Then** Claude executes the prompt and returns the result
3. **Given** the server receives a termination signal, **When** requests are in-flight, **Then** the server completes active requests before shutting down

---

### User Story 3 - Authentication Monitoring (Priority: P3)

As a system administrator, I need the agent to detect authentication failures and notify the team so that expired credentials can be refreshed promptly.

**Why this priority**: Authentication failures cause silent agent failures. Proactive notification enables quick remediation without manual monitoring.

**Independent Test**: Can be fully tested by simulating an auth failure and verifying a notification is sent.

**Acceptance Scenarios**:

1. **Given** the auth check script runs, **When** Claude authentication succeeds, **Then** no notification is sent and exit code is 0
2. **Given** the auth check script runs, **When** Claude authentication fails, **Then** a notification is sent to the configured channel with re-authentication steps
3. **Given** authentication fails, **When** the notification is sent, **Then** it includes clear instructions for credential refresh

---

### User Story 4 - Container Registry Publication (Priority: P4)

As a DevOps engineer, I need the container image published to the Azure Container Registry so that Kubernetes can pull and deploy it.

**Why this priority**: While essential for deployment, this depends on a successful image build (US1). Registry publication is the final step before Kubernetes deployment.

**Independent Test**: Can be fully tested by pushing to the registry and verifying the image tag appears in the repository.

**Acceptance Scenarios**:

1. **Given** the image is built, **When** I push to the container registry, **Then** the push completes successfully
2. **Given** the image is pushed, **When** I query the registry, **Then** the versioned tag is visible
3. **Given** the image is in the registry, **When** Kubernetes pulls the image, **Then** the pull succeeds without authentication errors

---

### Edge Cases

- What happens when the Docker build fails due to network issues? The build should fail with a clear error message and can be retried.
- What happens when the HTTP server receives malformed JSON? The server returns a 400 Bad Request with error details.
- What happens when Claude CLI times out during a prompt? The server returns an error response with timeout indication.
- What happens when the registry push fails due to quota? The push fails with a storage quota error; administrator must clean old images.
- What happens when SIGTERM arrives during a long-running prompt? The server waits for the prompt to complete (up to grace period) before exiting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Container image MUST include Azure CLI for cloud resource authentication
- **FR-002**: Container image MUST include GitHub CLI for repository operations
- **FR-003**: Container image MUST include Claude CLI for AI prompt execution
- **FR-004**: Container image MUST include Node.js runtime for HTTP server
- **FR-005**: Container image MUST include jq and yq for JSON/YAML processing
- **FR-006**: Container MUST run all processes as a non-root user
- **FR-007**: HTTP server MUST expose a `/health` endpoint returning JSON status
- **FR-008**: HTTP server MUST expose a `/run` endpoint accepting prompt requests
- **FR-009**: HTTP server MUST handle SIGTERM gracefully, completing in-flight requests
- **FR-010**: HTTP server MUST track active requests to prevent premature shutdown
- **FR-011**: Auth check script MUST test Claude authentication with a simple prompt
- **FR-012**: Auth check script MUST send notifications on authentication failure
- **FR-013**: Auth check script MUST return distinct exit codes for success (0) and auth failure (57)
- **FR-014**: Notification script MUST format messages with actionable re-authentication steps
- **FR-015**: Container image MUST be tagged with semantic version (v4.6.2)
- **FR-016**: Container image MUST be pushed to Azure Container Registry

### Key Entities

- **Container Image**: The deployable artifact containing all tools and scripts; versioned with semantic tags
- **HTTP Server**: A lightweight server handling health checks and prompt execution; runs as the main container process
- **Auth Check Script**: A shell script that validates Claude authentication and triggers notifications on failure
- **Notification Script**: A shell script that sends formatted alerts to the team communication channel

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Container image builds successfully in under 10 minutes
- **SC-002**: All 6 required CLI tools are executable within the container
- **SC-003**: HTTP server responds to health checks within 1 second
- **SC-004**: HTTP server completes graceful shutdown within 120 seconds
- **SC-005**: Authentication check completes within 30 seconds
- **SC-006**: Notifications are delivered within 10 seconds of auth failure detection
- **SC-007**: Container image is available in registry within 5 minutes of push
- **SC-008**: Container runs as non-root user (UID 1001 - Ubuntu 24.04 has UID 1000 reserved)

## Assumptions

- Azure Container Registry `iiusacr` is accessible and authenticated
- Docker (or compatible builder) is available on the build machine
- Base image `ubuntu:24.04` is available from public registry
- Teams webhook URL is available for notification configuration
- Node.js 20.x LTS is the target runtime version
- Claude CLI npm package is publicly available

## Dependencies

- **Sprint 1 (Azure Infrastructure)**: CSI Driver enabled (for Key Vault mounting)
- **Sprint 2 (GitHub App)**: Credentials stored in Key Vault (for GitHub operations)
- **Sprint 3 (Claude Session)**: Session tokens available (for Claude authentication)
- **Sprint 5 (Kubernetes Deployment)**: Will consume this container image

## Out of Scope

- Kubernetes deployment manifests (Sprint 5)
- Actual prompt execution logic (Sprint 6 verification)
- CronJob scheduling for auth checks (Sprint 7)
- Multi-architecture image builds (arm64)
- Image vulnerability scanning and remediation
