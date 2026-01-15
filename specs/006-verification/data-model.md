# Data Model: Verification

**Feature**: 006-verification
**Date**: 2026-01-15

---

## Overview

This feature does not introduce new persistent data structures. It defines the structure of verification test results for documentation and audit purposes.

---

## Entities

### VerificationTest

Represents a single verification check.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier (e.g., "T037", "T038") |
| name | String | Human-readable test name |
| category | Enum | US1-Azure, US2-Claude, US3-GitHub, US4-NetworkPolicy, US5-Health |
| command | String | The kubectl/CLI command to execute |
| expectedResult | String | What the test expects to see |
| timeout | Integer | Maximum seconds to wait for result |

### TestResult

Represents the outcome of executing a VerificationTest.

| Field | Type | Description |
|-------|------|-------------|
| testId | String | Reference to VerificationTest.id |
| status | Enum | PASS, FAIL, SKIP, ERROR |
| actualResult | String | The actual output from the command |
| timestamp | DateTime | When the test was executed |
| duration | Integer | Seconds taken to complete |
| errorMessage | String? | Details if status is FAIL or ERROR |

### VerificationRun

Represents a complete execution of all verification tests.

| Field | Type | Description |
|-------|------|-------------|
| runId | String | Unique identifier for the run (timestamp-based) |
| startTime | DateTime | When verification started |
| endTime | DateTime | When verification completed |
| results | List[TestResult] | All test results |
| overallStatus | Enum | PASS (all pass), FAIL (any fail) |
| environment | String | Target environment (e.g., "dev-aks/claude-agent") |

---

## Relationships

```
VerificationRun (1) ──contains──> (N) TestResult
TestResult (N) ──executes──> (1) VerificationTest
```

---

## Test Categories

| Category | User Story | Tests Included |
|----------|------------|----------------|
| US1-Azure | Azure Workload Identity | T037a (az login), T037b (storage list) |
| US2-Claude | Claude Authentication | T038 (prompt execution) |
| US3-GitHub | GitHub CSI Secrets | T039a (file list), T039b (app-id content) |
| US4-NetworkPolicy | Network Security | T040a (policy count), T040b (DNS resolution) |
| US5-Health | HTTP Server | T041 (health endpoint) |

---

## State Transitions

### TestResult Status

```
PENDING ──execute──> PASS | FAIL | ERROR
                          │
SKIP <──(dependency failed)┘
```

- **PENDING**: Test not yet executed
- **PASS**: Command succeeded, output matches expected
- **FAIL**: Command succeeded, output does not match expected
- **ERROR**: Command failed to execute (timeout, connection error)
- **SKIP**: Test skipped due to dependency failure

---

## Validation Rules

1. **Test Timeout**: Each test has a maximum execution time (default 60s)
2. **Result Capture**: All stdout/stderr must be captured for troubleshooting
3. **Idempotency**: Tests must be re-runnable without side effects
4. **Non-Destructive**: Tests must not modify system state
5. **Order Independence**: While tests have recommended order, each should be independently executable

---

## Exit Codes

Per constitution requirement for distinct exit codes:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | All tests passed | Proceed to Sprint 7 |
| 1 | One or more tests failed | Review failures, troubleshoot |
| 2 | Test execution error | Check pod status, kubectl access |
