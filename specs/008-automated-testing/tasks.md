# Tasks: Automated Testing

**Input**: Design documents from `/specs/008-automated-testing/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature IS about implementing tests. All tasks create test infrastructure.

**Organization**: Tasks are grouped by user story (HTTP server tests, shell script tests, integration tests, CI/CD pipeline) to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Implementation Approach

**Type**: Scripts

**Rationale**: Per Constitution VI, CI/CD pipeline steps MUST be scripted. This feature creates repeatable test automation that runs in GitHub Actions.

---

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Initialize test project structure and dependencies

- [x] T001 Create package.json with Jest, supertest dependencies in repository root
- [x] T002 Create jest.config.js with coverage settings in repository root
- [x] T003 [P] Create tests/ directory structure per plan.md
- [x] T004 [P] Create tests/mocks/ directory for shared mock utilities
- [x] T005 [P] Create tests/fixtures/ directory for test data

**Checkpoint**: Test infrastructure ready - dependencies installed, directories created

---

## Phase 2: Foundational (Server Testability)

**Purpose**: Modify server.js to be testable (export without auto-start)

**CRITICAL**: Server must be testable before any US1 tests can run

- [x] T006 Modify infra/docker/server.js to export server and handlers
- [x] T007 Add conditional server.listen() in infra/docker/server.js (only when run directly)
- [x] T008 Create tests/mocks/spawnSync.js with Jest mock patterns from research.md

**Checkpoint**: Foundation ready - server.js is testable with mocked spawnSync

---

## Phase 3: User Story 1 - HTTP Server Unit Tests (Priority: P1)

**Goal**: Unit tests for all HTTP server endpoints with ≥80% coverage

**Independent Test**: Run `npm test` and see all server tests pass with mocked spawnSync

### Implementation for User Story 1

- [x] T009 [P] [US1] Create tests/unit/server.test.js base structure with Jest setup
- [x] T010 [P] [US1] Create tests/fixtures/http-responses.json from contracts/test-fixtures.json
- [x] T011 [US1] Implement /health endpoint tests (healthy, shutting down) in tests/unit/server.test.js
- [x] T012 [US1] Implement /run endpoint success tests (valid prompt) in tests/unit/server.test.js
- [x] T013 [US1] Implement /run validation tests (missing prompt, oversized, invalid timeout) in tests/unit/server.test.js
- [x] T014 [US1] Implement /run exit code tests (code 57 auth failure, code 124 timeout) in tests/unit/server.test.js
- [x] T015 [US1] Implement error case tests (404, invalid JSON, shutdown rejection) in tests/unit/server.test.js
- [x] T016 [US1] Implement graceful shutdown tests in tests/unit/server.test.js
- [x] T017 [US1] Add npm script "test" to package.json running Jest with coverage
- [x] T018 [US1] Verify ≥80% code coverage for infra/docker/server.js

**Checkpoint**: US1 complete - HTTP server unit tests pass with ≥80% coverage

---

## Phase 4: User Story 2 - Shell Script Unit Tests (Priority: P2)

**Goal**: BATS tests for check-auth.sh and notify.sh

**Independent Test**: Run `bats tests/scripts/` and see all shell tests pass

### Implementation for User Story 2

- [x] T019 [P] [US2] Create tests/scripts/test_helper/ directory for BATS libraries
- [x] T020 [P] [US2] Create tests/scripts/check-auth.bats with setup/teardown
- [x] T021 [P] [US2] Create tests/scripts/notify.bats with setup/teardown
- [x] T022 [US2] Create tests/mocks/claude-mock.sh for stubbing Claude CLI
- [x] T023 [US2] Create tests/mocks/curl-mock.sh for stubbing curl
- [x] T024 [US2] Implement check-auth.sh success path test (exit 0, no notification) in tests/scripts/check-auth.bats
- [x] T025 [US2] Implement check-auth.sh failure path test (exit 57, notification sent) in tests/scripts/check-auth.bats
- [x] T026 [US2] Implement check-auth.sh timeout test in tests/scripts/check-auth.bats
- [x] T027 [US2] Implement notify.sh success path test (HTTP 200) in tests/scripts/notify.bats
- [x] T028 [US2] Implement notify.sh missing webhook test in tests/scripts/notify.bats
- [x] T029 [US2] Add npm script "test:scripts" to package.json running BATS

**Checkpoint**: US2 complete - Shell script tests pass with mocked commands

---

## Phase 5: User Story 3 - Integration Tests (Priority: P3)

**Goal**: Verify HTTP → CLI flow with realistic mocks

**Independent Test**: Run `npm run test:integration` and see HTTP flow tests pass

### Implementation for User Story 3

- [x] T030 [P] [US3] Create tests/integration/http-flow.test.js base structure
- [x] T031 [US3] Implement full request/response cycle test in tests/integration/http-flow.test.js
- [x] T032 [US3] Implement graceful shutdown integration test (SIGTERM handling) in tests/integration/http-flow.test.js
- [x] T033 [US3] Implement concurrent request handling test in tests/integration/http-flow.test.js
- [x] T034 [US3] Add npm script "test:integration" to package.json

**Checkpoint**: US3 complete - Integration tests verify HTTP → CLI flow

---

## Phase 6: User Story 4 - CI/CD Pipeline Integration (Priority: P4)

**Goal**: GitHub Actions workflow that runs all tests on PRs

**Independent Test**: Create a PR and observe tests running automatically

### Implementation for User Story 4

- [x] T035 [P] [US4] Create .github/workflows/ directory if not exists
- [x] T036 [US4] Create .github/workflows/test.yml with Node.js setup
- [x] T037 [US4] Add Jest test step to .github/workflows/test.yml
- [x] T038 [US4] Add BATS test step to .github/workflows/test.yml
- [x] T039 [US4] Add coverage reporting step to .github/workflows/test.yml
- [x] T040 [US4] Configure workflow to run on push and pull_request events
- [x] T041 [US4] Add npm script "test:all" combining Jest and BATS

**Checkpoint**: US4 complete - CI pipeline runs all tests on PRs

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T042 [P] Update quickstart.md with verified test commands
- [x] T043 [P] Add .gitignore entries for coverage/ and node_modules/
- [x] T044 Validate all success criteria from spec.md (SC-001 through SC-007)
- [x] T045 Run full test suite: `npm run test:all`

**Checkpoint**: Sprint 8 complete - All tests pass, CI configured, coverage ≥80%

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (package.json, jest.config.js)
- **Phase 3 (US1)**: Depends on Phase 2 (testable server.js)
- **Phase 4 (US2)**: Can start after Phase 1 (independent of US1)
- **Phase 5 (US3)**: Depends on Phase 2 (testable server.js)
- **Phase 6 (US4)**: Can start after Phase 1 (creates CI workflow)
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (HTTP Server Tests)**: Depends on Phase 2 - Requires testable server.js
- **US2 (Shell Script Tests)**: Independent - Only needs BATS and mocks
- **US3 (Integration Tests)**: Depends on Phase 2 - Requires testable server.js
- **US4 (CI/CD Pipeline)**: Independent - Creates workflow file

### Parallel Opportunities

- T003, T004, T005 can run in parallel (directory creation)
- T009, T010 can run in parallel (different files)
- T019, T020, T021 can run in parallel (BATS setup)
- T022, T023 can run in parallel (mock scripts)
- US2 and US4 can start in parallel after Phase 1
- US1 and US3 can start in parallel after Phase 2

---

## Parallel Example: User Story 1 Setup

```bash
# Launch in parallel (different files):
Task: "Create tests/unit/server.test.js base structure"
Task: "Create tests/fixtures/http-responses.json from contracts"
```

---

## Parallel Example: User Story 2 Setup

```bash
# Launch in parallel (BATS files independent):
Task: "Create tests/scripts/test_helper/ directory"
Task: "Create tests/scripts/check-auth.bats"
Task: "Create tests/scripts/notify.bats"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (~5 tasks)
2. Complete Phase 2: Foundational (~3 tasks)
3. Complete Phase 3: US1 HTTP Server Tests (~10 tasks)
4. **STOP**: Run `npm test` - all server tests pass with ≥80% coverage
5. Merge/deploy if coverage is acceptable

### Incremental Delivery

1. Setup + Foundational → Test infrastructure ready
2. Add US1 → HTTP server tests working
3. Add US2 → Shell script tests working (can parallelize with US3)
4. Add US3 → Integration tests working
5. Add US4 → CI pipeline runs all tests automatically
6. Polish → All success criteria validated

### Parallel Team Strategy

With multiple developers:
1. All: Complete Setup + Foundational
2. Developer A: US1 (HTTP Server Tests)
3. Developer B: US2 (Shell Script Tests)
4. Developer C: US4 (CI Pipeline)
5. After US1: Developer A → US3 (Integration Tests)
6. All: Polish and validate

---

## Notes

- [P] tasks = different files/commands, no dependencies
- [Story] label maps task to specific user story
- Tests ARE the feature - no separate "verify tests fail first" step
- Commit after each task or logical group
- Follow research.md patterns for mocking (jest.mock, bats-mock)
- Reference contracts/test-fixtures.json for HTTP test cases
- Reference contracts/shell-test-cases.md for BATS test cases

### Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T018 | SC-001 (≥80% coverage for server.js) |
| T011-T016 | SC-002 (All HTTP endpoint tests pass) |
| T024-T028 | SC-003 (All shell script tests pass) |
| T036-T040 | SC-004, SC-005 (CI runs in <5 min, blocks merge) |
| All mock tasks | SC-006 (Tests run without network/credentials) |
| All tests | SC-007 (Zero flaky tests) |
