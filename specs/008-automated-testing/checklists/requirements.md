# Requirements Checklist: Automated Testing

**Feature**: 008-automated-testing
**Generated**: 2026-01-15

## User Story Acceptance

### US1: HTTP Server Unit Tests (P1)
- [ ] Health endpoint returns 200 when healthy
- [ ] Health endpoint returns 503 when shutting down
- [ ] Run endpoint returns success for valid prompts
- [ ] Run endpoint returns 400 for missing prompt
- [ ] Run endpoint returns 400 for oversized prompt
- [ ] Run endpoint handles exit code 57 (auth failure)
- [ ] Run endpoint handles exit code 124 (timeout)

### US2: Shell Script Unit Tests (P2)
- [ ] check-auth.sh exits 0 on auth success
- [ ] check-auth.sh exits 57 on auth failure
- [ ] check-auth.sh calls notify.sh on failure
- [ ] notify.sh sends POST when webhook URL set
- [ ] notify.sh handles missing webhook URL gracefully

### US3: Integration Tests (P3)
- [ ] Full HTTP → CLI → response cycle works
- [ ] Graceful shutdown completes active requests
- [ ] CronJob integration verified

### US4: CI/CD Pipeline (P4)
- [ ] GitHub Actions workflow created
- [ ] Tests run on PR events
- [ ] Test failures block merge
- [ ] Coverage report generated

## Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-001 | Unit tests for HTTP endpoints | [ ] |
| FR-002 | Unit tests for request validation | [ ] |
| FR-003 | Unit tests for response formatting | [ ] |
| FR-004 | Unit tests for graceful shutdown | [ ] |
| FR-005 | Unit tests for check-auth.sh | [ ] |
| FR-006 | Unit tests for notify.sh | [ ] |
| FR-007 | Test runner Node.js 20.x compatible | [ ] |
| FR-008 | Mock external dependencies | [ ] |
| FR-009 | Integration tests for HTTP → CLI | [ ] |
| FR-010 | Test coverage reports | [ ] |
| FR-011 | CI workflow on PRs | [ ] |
| FR-012 | Block merge on test failure | [ ] |
| FR-013 | Tests run without network/credentials | [ ] |
| FR-014 | BATS for shell script tests | [ ] |

## Success Criteria

| ID | Criterion | Target | Status |
|----|-----------|--------|--------|
| SC-001 | Code coverage | ≥80% | [ ] |
| SC-002 | HTTP endpoint tests | All pass | [ ] |
| SC-003 | Shell script tests | All pass | [ ] |
| SC-004 | CI runtime | <5 min | [ ] |
| SC-005 | Merge blocking | Enabled | [ ] |
| SC-006 | Offline execution | Working | [ ] |
| SC-007 | Test determinism | 100% | [ ] |

## Quality Gates

- [ ] Spec reviewed and approved
- [ ] Plan document created
- [ ] Tasks generated from spec
- [ ] Implementation complete
- [ ] All tests passing
- [ ] Coverage threshold met
- [ ] Documentation updated
