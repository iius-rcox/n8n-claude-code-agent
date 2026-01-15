# Feature Specification: Verification

**Feature Branch**: `006-verification`
**Created**: 2026-01-15
**Status**: Draft
**Input**: Sprint 6 from sprint-plan-v4.6.2.md - Validate all authentication mechanisms and network connectivity

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Azure Workload Identity Verification (Priority: P1)

As a DevOps engineer, I need to verify that the Claude agent pod can authenticate to Azure services using Workload Identity so that I can confirm the agent has access to storage containers without using static credentials.

**Why this priority**: Azure storage access is the foundational capability that enables all agent operations (persisting state, uploading artifacts, retrieving configurations). Without verified storage access, the agent cannot perform its core functions.

**Independent Test**: Can be fully tested by executing Azure CLI commands inside the running pod to authenticate and list storage containers, delivering immediate confirmation that Workload Identity is functioning correctly.

**Acceptance Scenarios**:

1. **Given** a running Claude agent pod with Workload Identity configured, **When** the pod executes `az login --identity`, **Then** authentication succeeds without prompting for credentials
2. **Given** a successfully authenticated pod, **When** the pod lists storage containers, **Then** all 6 configured containers are visible (agent-state, agent-spec, agent-plan, agent-verification, agent-review, agent-release)
3. **Given** successful storage access, **When** the pod attempts to read/write a test blob, **Then** the operation completes successfully using only the managed identity

---

### User Story 2 - Claude Authentication Verification (Priority: P2)

As a DevOps engineer, I need to verify that the Claude agent pod can successfully communicate with Claude's API so that I can confirm the agent can execute prompts when invoked.

**Why this priority**: Claude API access is the agent's primary function. Without verified Claude authentication, the entire system cannot perform its intended purpose of executing Claude prompts.

**Independent Test**: Can be fully tested by executing a simple Claude prompt inside the running pod and verifying a successful response is returned.

**Acceptance Scenarios**:

1. **Given** a running Claude agent pod with session tokens mounted, **When** the pod executes a test prompt, **Then** Claude responds with the expected output
2. **Given** valid session tokens, **When** the Claude CLI is invoked, **Then** no authentication errors or token expiration messages appear
3. **Given** a successful Claude response, **When** the response is examined, **Then** it contains valid content (not an error message)

---

### User Story 3 - GitHub Credentials Verification via CSI Driver (Priority: P3)

As a DevOps engineer, I need to verify that GitHub App credentials are correctly mounted from Azure Key Vault via the CSI Driver so that the agent can authenticate to GitHub for repository operations.

**Why this priority**: GitHub access enables repository operations (cloning, creating PRs, managing issues). While not required for basic Claude prompts, it is essential for the agent to perform meaningful development work.

**Independent Test**: Can be fully tested by checking that secret files exist at the expected mount path and contain valid credential data.

**Acceptance Scenarios**:

1. **Given** a running Claude agent pod with CSI volume mounted, **When** listing the secrets directory, **Then** GitHub credentials files are present at `/secrets/github/`
2. **Given** mounted credentials, **When** reading the App ID file, **Then** the file contains the expected GitHub App ID value
3. **Given** mounted credentials, **When** examining file permissions, **Then** files are readable by the claude-agent user

---

### User Story 4 - NetworkPolicy Verification (Priority: P4)

As a security engineer, I need to verify that NetworkPolicies are correctly applied so that the agent pod has only the minimum required network access (DNS, Azure services, n8n ingress).

**Why this priority**: NetworkPolicies provide defense-in-depth security. Verification ensures the security hardening from Sprint 5 is functioning as designed.

**Independent Test**: Can be fully tested by checking that all 4 NetworkPolicies exist and that the pod can successfully resolve DNS (proving the allow-dns policy works while default-deny blocks other traffic).

**Acceptance Scenarios**:

1. **Given** the claude-agent namespace, **When** listing NetworkPolicies, **Then** exactly 4 policies are present (default-deny-all, allow-dns, allow-azure-egress, allow-ingress-from-n8n)
2. **Given** default-deny is active, **When** the pod performs DNS resolution, **Then** resolution succeeds (confirming allow-dns policy works)
3. **Given** NetworkPolicies are applied, **When** describing the default-deny policy, **Then** it shows deny all ingress and egress for pods in the namespace

---

### User Story 5 - HTTP Server Health Endpoint Verification (Priority: P5)

As an n8n workflow developer, I need to verify that the Claude agent's HTTP server is running and responding to health checks so that n8n can reliably communicate with the agent.

**Why this priority**: The HTTP server is the integration point between n8n and the Claude agent. Health endpoint verification confirms the service is operational and ready to receive prompt requests.

**Independent Test**: Can be fully tested by making an HTTP request to the health endpoint and verifying a JSON response with healthy status is returned.

**Acceptance Scenarios**:

1. **Given** a running Claude agent pod, **When** requesting the health endpoint, **Then** a JSON response is returned within 1 second
2. **Given** a successful health check, **When** examining the response, **Then** it contains `status: "healthy"` and a timestamp
3. **Given** the HTTP server is running, **When** the pod is ready, **Then** the health endpoint is accessible on port 3000

---

### Edge Cases

- What happens when Workload Identity authentication fails? The az login command returns an error with details about the failure reason (e.g., missing federated credential, incorrect client ID).
- What happens when Claude session tokens are expired? The Claude CLI returns an authentication error, and the verification test fails with a clear indication that tokens need refresh.
- What happens when CSI Driver fails to mount secrets? The pod events show mount errors, and the secrets directory is empty or missing.
- What happens when a NetworkPolicy is missing? The expected policy count differs from 4, and specific traffic may be unexpectedly allowed or blocked.
- What happens when the HTTP server is not running? The health endpoint request times out or returns connection refused.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Verification MUST test Azure Workload Identity authentication from within the running pod
- **FR-002**: Verification MUST confirm access to all 6 storage containers via Workload Identity
- **FR-003**: Verification MUST test Claude CLI authentication with a simple prompt execution
- **FR-004**: Verification MUST confirm Claude responds successfully without authentication errors
- **FR-005**: Verification MUST check that CSI-mounted GitHub credentials exist at the expected path
- **FR-006**: Verification MUST confirm the GitHub App ID secret contains valid data
- **FR-007**: Verification MUST confirm exactly 4 NetworkPolicies are applied to the namespace
- **FR-008**: Verification MUST test DNS resolution to confirm network egress is working
- **FR-009**: Verification MUST test the HTTP health endpoint responds with healthy status
- **FR-010**: Verification MUST provide clear pass/fail results for each test
- **FR-011**: Verification MUST be executable via kubectl exec commands against the running pod
- **FR-012**: Verification MUST document all test outputs for troubleshooting failed tests

### Key Entities

- **Verification Test**: A single check that validates one aspect of the system; has a name, command, expected result, and actual result
- **Test Result**: The outcome of a verification test; includes pass/fail status, output captured, and any error messages
- **Pod**: The running Claude agent container that is the target of all verification tests; must be in Running state before tests execute

### Assumptions

- The Claude agent pod is running and in Ready state (Sprint 5 complete)
- kubectl is configured with access to the dev-aks cluster
- The claude-agent namespace exists with all required resources deployed
- Storage account `iiusagentstore` has all 6 containers created (Sprint 1)
- Key Vault `iius-akv` contains GitHub App credentials (Sprint 2)
- Claude session tokens are valid and not expired (Sprint 3)
- Container image includes all required CLI tools: az, claude, curl (Sprint 4)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 5 verification tests pass on first execution without manual intervention
- **SC-002**: Azure Workload Identity authentication completes within 30 seconds
- **SC-003**: Claude test prompt receives a valid response within 60 seconds
- **SC-004**: CSI-mounted secrets are accessible and contain expected data
- **SC-005**: NetworkPolicy verification confirms exactly 4 policies with correct configurations
- **SC-006**: HTTP health endpoint responds with healthy status within 1 second
- **SC-007**: All test outputs are captured and documented for audit purposes
- **SC-008**: Verification can be re-executed at any time to confirm system health
