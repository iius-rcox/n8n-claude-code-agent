# Data Model: Automated Testing

**Feature**: 008-automated-testing
**Date**: 2026-01-15

## Overview

This feature involves minimal data entities as tests primarily operate on request/response structures and mock data. The entities below represent test fixtures and mock configurations.

## Entities

### TestFixture

Represents a pre-defined input/output pair for testing.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Unique identifier for the fixture |
| input | object | Request body or input data |
| expectedOutput | object | Expected response or output |
| exitCode | number | Expected exit code (0, 57, 124, etc.) |

**Example**:
```json
{
  "name": "valid-prompt-success",
  "input": {
    "prompt": "test prompt"
  },
  "expectedOutput": {
    "success": true,
    "exitCode": 0
  },
  "exitCode": 0
}
```

### MockConfig

Configures mock behavior for external dependencies.

| Field | Type | Description |
|-------|------|-------------|
| command | string | Command to mock (claude, curl) |
| args | string[] | Expected arguments pattern |
| returnValue | object | Value to return when called |
| exitCode | number | Exit code to simulate |

**Example**:
```json
{
  "command": "claude",
  "args": ["-p", "*"],
  "returnValue": {
    "stdout": "Mock Claude response",
    "stderr": "",
    "status": 0
  },
  "exitCode": 0
}
```

### TestResult

Represents the outcome of a test execution.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Test name |
| suite | string | Test suite (unit, integration, scripts) |
| status | enum | passed, failed, skipped |
| duration | number | Execution time in ms |
| error | string? | Error message if failed |

## Relationships

```
TestSuite (1) ─────────────> (*) TestFixture
    │
    └──────────────────────> (*) MockConfig
```

- A test suite contains multiple fixtures
- A test suite uses multiple mock configurations
- Fixtures and mocks are independent (no direct relationship)

## State Transitions

Tests have simple state transitions:

```
pending → running → passed
                  → failed
                  → skipped
```

## Validation Rules

| Entity | Rule |
|--------|------|
| TestFixture | `name` must be unique within suite |
| TestFixture | `exitCode` must be valid (0, 1, 57, 124) |
| MockConfig | `command` must be known command |
| MockConfig | `exitCode` must match returnValue.status |
