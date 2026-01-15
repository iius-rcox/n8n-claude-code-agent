# Feature Specification: Automated Testing

**Feature Branch**: `008-automated-testing`
**Created**: 2026-01-15
**Status**: Draft
**Input**: User description: "Automated testing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HTTP Server Unit Tests (Priority: P1)

As a developer, I want unit tests for the HTTP server (`server.js`) so that I can verify request handling, validation, and response formatting work correctly before deployment.

**Why this priority**: The HTTP server is the primary interface between n8n and Claude. Bugs here directly impact all workflow executions. Unit tests provide fast feedback during development.

**Independent Test**: Run `npm test` locally and see all server unit tests pass. Tests can run without Kubernetes or Claude CLI installed by mocking `spawnSync`.

**Acceptance Scenarios**:

1. **Given** a GET request to `/health`, **When** server is healthy, **Then** return 200 with `{"status": "healthy", "timestamp": "...", "activeRequests": 0}`
2. **Given** a GET request to `/health`, **When** server is shutting down, **Then** return 503 with `{"status": "shutting_down"}`
3. **Given** a POST request to `/run` with valid prompt, **When** Claude returns successfully, **Then** return 200 with `success: true` and output
4. **Given** a POST request to `/run` without prompt, **When** request is processed, **Then** return 400 with `{"error": "prompt is required"}`
5. **Given** a POST request to `/run` with prompt > 100KB, **When** request is processed, **Then** return 400 with `{"error": "prompt exceeds maximum length"}`
6. **Given** a POST request to `/run`, **When** Claude exits with code 57, **Then** return 200 with `exitCode: 57` and appropriate error message
7. **Given** a POST request to `/run`, **When** Claude times out, **Then** return 200 with `exitCode: 124` and timeout error

---

### User Story 2 - Shell Script Unit Tests (Priority: P2)

As a developer, I want unit tests for shell scripts (`check-auth.sh`, `notify.sh`) so that authentication monitoring and Teams notifications work reliably.

**Why this priority**: These scripts are critical for proactive alerting. Testing them ensures auth failures are detected and reported correctly.

**Independent Test**: Run `bats tests/scripts/` and see all shell script tests pass using mocked `claude` and `curl` commands.

**Acceptance Scenarios**:

1. **Given** `check-auth.sh` runs, **When** Claude auth succeeds (exit 0), **Then** script exits with code 0 and no notification is sent
2. **Given** `check-auth.sh` runs, **When** Claude auth fails, **Then** script calls `notify.sh` and exits with code 57
3. **Given** `notify.sh` is called with title and message, **When** TEAMS_WEBHOOK_URL is set, **Then** POST request is sent to webhook
4. **Given** `notify.sh` is called, **When** TEAMS_WEBHOOK_URL is not set, **Then** script exits gracefully with warning

---

### User Story 3 - Integration Tests (Priority: P3)

As a developer, I want integration tests that verify the complete request flow from HTTP to Claude CLI execution so that I can catch issues in the interaction between components.

**Why this priority**: Unit tests alone may miss integration issues. These tests verify the actual behavior with real (or realistic mock) Claude responses.

**Independent Test**: Run `npm run test:integration` in a Docker container with mocked Claude CLI and verify full request/response cycle.

**Acceptance Scenarios**:

1. **Given** HTTP server is running, **When** valid prompt is sent via HTTP, **Then** Claude CLI is invoked with correct arguments and response is returned
2. **Given** HTTP server is running, **When** SIGTERM is received during request, **Then** current request completes before shutdown
3. **Given** CronJob container starts, **When** check-auth.sh runs, **Then** exit code reflects actual auth status

---

### User Story 4 - CI/CD Pipeline Integration (Priority: P4)

As a DevOps engineer, I want automated tests to run on every pull request so that code quality is enforced before merge.

**Why this priority**: Manual testing is error-prone. CI integration provides automated quality gates.

**Independent Test**: Create a PR and observe GitHub Actions running tests automatically.

**Acceptance Scenarios**:

1. **Given** a PR is opened, **When** tests fail, **Then** PR cannot be merged
2. **Given** a PR is opened, **When** all tests pass, **Then** PR shows green check
3. **Given** tests complete, **When** viewing PR, **Then** test coverage report is available

---

### Edge Cases

- What happens when request body is malformed JSON? → Return 400 with "Invalid JSON"
- What happens when concurrent requests exceed memory? → Body parsing limits prevent this
- What happens when Claude CLI is not installed? → Return 500 with spawn error
- What happens when workdir doesn't exist? → Claude CLI handles this (not server responsibility)
- What happens when Teams webhook returns non-200? → notify.sh logs warning but doesn't fail

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST have unit tests for all HTTP server endpoints (`/health`, `/run`)
- **FR-002**: System MUST have unit tests for request validation (prompt, timeout, workdir)
- **FR-003**: System MUST have unit tests for response formatting (success, error, timeout cases)
- **FR-004**: System MUST have unit tests for graceful shutdown behavior
- **FR-005**: System MUST have unit tests for `check-auth.sh` authentication logic
- **FR-006**: System MUST have unit tests for `notify.sh` Teams notification
- **FR-007**: System MUST have a test runner compatible with Node.js 20.x
- **FR-008**: System MUST mock external dependencies (Claude CLI, curl) in unit tests
- **FR-009**: System MUST have integration tests that verify HTTP → CLI flow
- **FR-010**: System MUST generate test coverage reports
- **FR-011**: System MUST have CI workflow that runs tests on PRs
- **FR-012**: CI workflow MUST block merge on test failures
- **FR-013**: Tests MUST run without network access or real Claude credentials
- **FR-014**: Shell script tests MUST use BATS (Bash Automated Testing System)

### Key Entities

- **Test Suite**: Collection of related tests (unit, integration, e2e)
- **Mock**: Simulated external dependency (Claude CLI, curl, webhook)
- **Fixture**: Pre-defined test data (request bodies, expected responses)
- **Coverage Report**: Summary of code paths exercised by tests

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Unit tests achieve ≥80% code coverage for `server.js`
- **SC-002**: All HTTP endpoint tests pass (health, run, error cases)
- **SC-003**: All shell script tests pass (check-auth.sh, notify.sh)
- **SC-004**: CI pipeline runs tests on every PR within 5 minutes
- **SC-005**: Test failures block PR merge automatically
- **SC-006**: Tests run successfully without network access or credentials
- **SC-007**: Zero flaky tests (100% deterministic results)
