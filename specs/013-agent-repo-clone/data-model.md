# Data Model: Agent Repository Clone and Real Code Workflow

**Feature**: 013-agent-repo-clone
**Date**: 2026-01-20

## Overview

This feature modifies existing n8n workflow data structures. No new database entities are created. The primary changes are to the task envelope schema and workflow node configurations.

## Modified Entities

### Task Envelope (Azure Blob Storage)

The task envelope stored in `agent-state` container is extended with new fields for repository operations.

**Current Schema** (simplified):
```yaml
task_id: string
status: string
phase: string
repository: string  # GitHub URL - EXISTING but underutilized
phases:
  implementation:
    status: string
    completed_at: datetime
  verification:
    status: string
  review:
    status: string
  release:
    status: string
    pr_url: string  # EXISTING - now populated by agent
```

**Extended Fields** (no schema change, just populated):
```yaml
# Implementation phase additions
phases:
  implementation:
    branch_name: string      # NEW: feat/{task-id}
    build_attempts: number   # NEW: count of build retries (0-3)
    build_output: string     # NEW: last build stdout/stderr (truncated)

# Verification phase additions
phases:
  verification:
    test_output: string      # NEW: actual test results
    test_passed: number      # NEW: count of passing tests
    test_failed: number      # NEW: count of failing tests
    coverage: string         # NEW: coverage percentage if available
```

### Workflow State (n8n Internal)

No changes to n8n's internal data model. Workflow execution data flows through existing n8n mechanisms.

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Task Envelope  │────▶│  Implementation │────▶│  Task Envelope  │
│  (Input)        │     │  Workflow       │     │  (Updated)      │
│                 │     │                 │     │                 │
│ - task_id       │     │ 1. Clone repo   │     │ + branch_name   │
│ - repository    │     │ 2. Create branch│     │ + build_attempts│
│ - spec/plan     │     │ 3. Implement    │     │ + pr_url        │
└─────────────────┘     │ 4. Build        │     └─────────────────┘
                        │ 5. Push + PR    │
                        └─────────────────┘
```

## Validation Rules

### Repository URL
- Must be valid GitHub URL format: `https://github.com/{owner}/{repo}`
- Must be accessible with configured GitHub App tokens
- Validated at implementation phase start

### Branch Name
- Format: `feat/{task-id}`
- Must not already exist (or suffix added)
- Created immediately after clone

### Build Output
- Truncated to 10KB max to fit in blob storage
- Includes both stdout and stderr
- Preserved for debugging failed builds

### PR URL
- Format: `https://github.com/{owner}/{repo}/pull/{number}`
- Must be valid and accessible
- Recorded in release phase status

## State Transitions

### Implementation Phase
```
pending → in_progress (clone started)
        → building (code written, running build)
        → build_failed (build error, retrying)
        → completed (PR created)
        → blocked (3 build failures)
```

### Verification Phase
```
pending → in_progress (clone started)
        → testing (running test suite)
        → completed (tests pass)
        → failed (tests fail, route back to implementation)
```

### Review Phase
```
pending → in_progress (fetching PR diff)
        → completed (review approved)
        → changes_requested (route back to implementation)
```

## Relationships

```
Task Envelope
    │
    ├── repository (GitHub URL)
    │       │
    │       └── Feature Branch (created by agent)
    │               │
    │               └── Pull Request (created by agent)
    │
    ├── spec.md (Azure Blob: agent-spec)
    ├── plan.md (Azure Blob: agent-spec)
    ├── tasks.md (Azure Blob: agent-spec)
    │
    ├── verification-report.md (Azure Blob: agent-verification)
    └── review-report.md (Azure Blob: agent-review)
```

## Migration Notes

No migration required. New fields are additive and optional. Existing task envelopes will work without modification - the new fields simply won't be populated for historical tasks.
