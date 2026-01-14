# Feature Specification: Claude Session Tokens

**Feature Branch**: `003-claude-session-tokens`
**Created**: 2026-01-14
**Status**: Draft
**Input**: Sprint 3 from sprint-plan-v4.6.2.md - Capture fresh Claude Max session tokens for Kubernetes secret

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fresh Session Token Capture (Priority: P1)

As a DevOps engineer, I need to capture fresh Claude Max session tokens from my local machine so that the Kubernetes-deployed agent can authenticate with Claude's API.

**Why this priority**: Without valid session tokens, the Claude agent pod cannot communicate with Claude's API. This is the foundational requirement that enables all agent operations.

**Independent Test**: Can be fully tested by running `claude -p "test"` locally after login and verifying a successful response, delivering immediate confirmation that tokens are valid.

**Acceptance Scenarios**:

1. **Given** an expired or missing Claude session, **When** I perform a fresh login using `claude login`, **Then** new session token files are created in the user profile directory
2. **Given** fresh session tokens exist, **When** I run a Claude test prompt, **Then** Claude responds successfully confirming authentication works
3. **Given** a previous session exists, **When** I perform logout followed by login, **Then** the old tokens are replaced with fresh ones

---

### User Story 2 - Session File Verification (Priority: P2)

As a DevOps engineer, I need to verify that all required session files exist and contain valid data before attempting to create Kubernetes secrets.

**Why this priority**: Creating a Kubernetes secret from incomplete or corrupted session files would cause the agent pod to fail at startup. Verification prevents deployment failures.

**Independent Test**: Can be fully tested by listing the session directory and confirming expected files are present with non-zero size.

**Acceptance Scenarios**:

1. **Given** a successful Claude login, **When** I list the session directory, **Then** all required session files are present
2. **Given** session files exist, **When** I check their size, **Then** each file has non-zero content
3. **Given** session files exist, **When** I check file permissions, **Then** files are readable by the current user

---

### User Story 3 - Kubernetes Secret Preparation (Priority: P3)

As a DevOps engineer, I need to generate a Kubernetes secret YAML from the session files so that it can be applied to the cluster during deployment.

**Why this priority**: This is the output format required by Kubernetes. While essential for deployment, it depends on having valid session files first (US1 and US2).

**Independent Test**: Can be fully tested by generating the YAML with `--dry-run` and validating the output contains expected secret structure.

**Acceptance Scenarios**:

1. **Given** valid session files exist, **When** I run the secret generation command with dry-run, **Then** a valid YAML structure is produced
2. **Given** the generated YAML, **When** I validate its structure, **Then** it contains the correct secret name and namespace placeholder
3. **Given** the generated YAML, **When** I inspect the data section, **Then** all session files are included as base64-encoded values

---

### Edge Cases

- What happens when Claude login fails due to network issues? The login command should display an error and the user should retry.
- What happens when the session directory doesn't exist? The user must run `claude login` first; the directory is created automatically.
- What happens when session files are corrupted? The test prompt in US1 will fail, indicating tokens need to be refreshed.
- What happens when disk space is insufficient? File creation will fail with a system error; user must free space.
- What happens when the user lacks write permissions to the profile directory? Login will fail with permission error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support logging out of existing Claude session to force fresh token generation
- **FR-002**: System MUST support logging into Claude Max with interactive authentication
- **FR-003**: System MUST store session tokens in the standard user profile location (`$env:USERPROFILE\.claude` on Windows)
- **FR-004**: System MUST allow verification of Claude authentication via test prompt execution
- **FR-005**: System MUST provide a way to list all files in the session directory
- **FR-006**: System MUST support generating Kubernetes secret YAML from session files
- **FR-007**: System MUST support dry-run mode for secret generation to preview without cluster access
- **FR-008**: Generated secret YAML MUST NOT be committed to version control

### Key Entities

- **Session Token Files**: Authentication credentials stored as files in the user's profile directory; contains tokens required for Claude API access
- **Kubernetes Secret**: A Kubernetes resource that stores sensitive data; will contain base64-encoded session files mounted into agent pods
- **Claude CLI**: The command-line interface tool used to authenticate and interact with Claude; manages session lifecycle

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fresh Claude login completes successfully within 2 minutes of starting authentication flow
- **SC-002**: Test prompt receives valid response from Claude within 10 seconds after login
- **SC-003**: All required session files are present in the profile directory after login
- **SC-004**: Generated Kubernetes secret YAML passes validation and contains all session files
- **SC-005**: Session tokens remain valid for agent operations for at least 24 hours after capture
- **SC-006**: Secret YAML file is excluded from version control via .gitignore

## Assumptions

- Claude Max subscription is active and the user has valid credentials
- Claude CLI is installed locally on the Windows machine
- User has PowerShell access with appropriate permissions
- User profile directory is accessible and writable
- kubectl is available for secret generation (not required for cluster access in this sprint)
- Network connectivity to Claude authentication servers is available

## Dependencies

- **Sprint 1 (Azure Infrastructure)**: Not required for this sprint
- **Sprint 2 (GitHub App)**: Not required for this sprint
- **Sprint 5 (Kubernetes Deployment)**: Will consume the secret YAML produced by this sprint

## Out of Scope

- Automatic token refresh (handled by future CronJob in Sprint 7)
- Cluster deployment of the secret (Sprint 5)
- Token validation from within Kubernetes pods (Sprint 6)
- Multi-user or shared credential management
