# Data Model: Autonomous Dev Team Agents

**Branch**: `011-autonomous-agents` | **Date**: 2026-01-19
**Purpose**: Entity definitions, state machines, and storage schemas

## Table of Contents

1. [Entity Overview](#1-entity-overview)
2. [Task Envelope](#2-task-envelope)
3. [State Machine](#3-state-machine)
4. [Agent Artifacts](#4-agent-artifacts)
5. [Storage Layout](#5-storage-layout)

---

## 1. Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                              │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │FeatureRequest│ ──────creates────▶ ┌─────────────┐
    │  (Form Input)│                    │TaskEnvelope │
    └──────────────┘                    │  (State)    │
                                        └──────┬──────┘
                                               │
                       ┌───────────────────────┼───────────────────────┐
                       │                       │                       │
                       ▼                       ▼                       ▼
               ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
               │  spec.md    │         │  plan.md    │         │  tasks.md   │
               │ (SpecKit)   │         │ (SpecKit)   │         │ (SpecKit)   │
               └─────────────┘         └─────────────┘         └─────────────┘
                                               │
                                               ▼
                       ┌───────────────────────┼───────────────────────┐
                       │                       │                       │
                       ▼                       ▼                       ▼
               ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
               │PullRequest  │         │Verification │         │ReviewReport │
               │ (GitHub)    │◀────────│Report       │─────────│             │
               └─────────────┘         └─────────────┘         └─────────────┘
```

| Entity | Storage | Format | Lifespan |
|--------|---------|--------|----------|
| Task Envelope | `agent-state` | YAML | Task lifetime |
| Specification | `agent-spec` | Markdown (SpecKit) | Permanent |
| Plan | `agent-spec` | Markdown (SpecKit) | Permanent |
| Tasks | `agent-spec` | Markdown (SpecKit) | Permanent |
| Verification Report | `agent-verification` | Markdown | Per PR cycle |
| Review Report | `agent-review` | Markdown | Per PR cycle |
| GitHub Token Cache | `agent-state` | YAML | 1 hour |

---

## 2. Task Envelope

The Task Envelope is the central state object that tracks a feature through its entire lifecycle.

### 2.1 Schema Definition

```yaml
# task-envelope.yml
# Location: agent-state/{task_id}/task-envelope.yml

# ─────────────────────────────────────────────────────────────────────────────
# IDENTITY
# ─────────────────────────────────────────────────────────────────────────────
task_id: "FEAT-20260119-abc123"    # Format: FEAT-{YYYYMMDD}-{random6}
created_at: "2026-01-19T10:30:00Z"
created_by: "form"                  # form | api | manual
repository: "https://github.com/ii-us/target-repo"

# ─────────────────────────────────────────────────────────────────────────────
# REQUEST (immutable after creation)
# ─────────────────────────────────────────────────────────────────────────────
request:
  title: "Add user authentication"
  description: |
    As a user, I want to log in with my email and password
    so that I can access my personalized dashboard.
  priority: "high"                  # low | medium | high | critical
  acceptance_criteria: |
    - Users can register with email/password
    - Users can log in and receive a session token
    - Invalid credentials return appropriate error

# ─────────────────────────────────────────────────────────────────────────────
# CURRENT STATE
# ─────────────────────────────────────────────────────────────────────────────
status: "in_progress"               # See State Machine below
phase: "implementation"             # intake | planning | implementation | verification | review | release
current_agent: "dev"                # pm | dev | qa | reviewer | none

# ─────────────────────────────────────────────────────────────────────────────
# PHASE PROGRESS
# ─────────────────────────────────────────────────────────────────────────────
phases:
  intake:
    status: "completed"
    started_at: "2026-01-19T10:30:00Z"
    completed_at: "2026-01-19T10:35:00Z"
    agent_invocations: 1
    output_path: "agent-spec/FEAT-xxx/spec.md"

  planning:
    status: "completed"
    started_at: "2026-01-19T10:35:00Z"
    completed_at: "2026-01-19T10:42:00Z"
    agent_invocations: 1
    output_paths:
      - "agent-spec/FEAT-xxx/plan.md"
      - "agent-spec/FEAT-xxx/tasks.md"

  implementation:
    status: "in_progress"
    started_at: "2026-01-19T10:42:00Z"
    current_task: 2                 # 1-indexed task from tasks.md
    total_tasks: 4
    pr_url: "https://github.com/ii-us/target-repo/pull/42"
    branch: "feat/FEAT-20260119-abc123"
    commits: ["abc1234", "def5678"]

  verification:
    status: "pending"

  review:
    status: "pending"

  release:
    status: "pending"

# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK LOOPS
# ─────────────────────────────────────────────────────────────────────────────
feedback_loops:
  verification:
    cycle_count: 0
    max_cycles: 3
    history: []

  review:
    cycle_count: 0
    max_cycles: 2
    history: []

# ─────────────────────────────────────────────────────────────────────────────
# ERROR TRACKING
# ─────────────────────────────────────────────────────────────────────────────
errors:
  - timestamp: "2026-01-19T10:40:00Z"
    phase: "planning"
    exit_code: 124
    message: "Timeout during codebase analysis"
    resolution: "Retried with reduced scope"

# ─────────────────────────────────────────────────────────────────────────────
# ESCALATIONS
# ─────────────────────────────────────────────────────────────────────────────
escalations:
  - timestamp: "2026-01-19T10:33:00Z"
    phase: "intake"
    reason: "needs_clarification"
    questions:
      - "Should authentication support SSO?"
      - "What session timeout is required?"
    resolved_at: "2026-01-19T10:34:00Z"
    resolution: "User provided clarification via Teams"

# ─────────────────────────────────────────────────────────────────────────────
# METADATA
# ─────────────────────────────────────────────────────────────────────────────
updated_at: "2026-01-19T10:45:00Z"
version: 7                          # Incremented on each update
lease_holder: null                  # Set during active operations
```

### 2.2 Field Constraints

| Field | Type | Constraints |
|-------|------|-------------|
| `task_id` | string | `^FEAT-\d{8}-[a-z0-9]{6}$` |
| `status` | enum | See State Machine |
| `phase` | enum | `intake\|planning\|implementation\|verification\|review\|release` |
| `priority` | enum | `low\|medium\|high\|critical` |
| `current_task` | integer | 1 to `total_tasks` |
| `cycle_count` | integer | 0 to `max_cycles` |
| `version` | integer | Monotonically increasing |

---

## 3. State Machine

### 3.1 Task Status States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TASK STATUS STATE MACHINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   PENDING   │
                              │ (initial)   │
                              └──────┬──────┘
                                     │
                           form submitted / task created
                                     │
                                     ▼
                              ┌─────────────┐
                              │ IN_PROGRESS │◀─────────────────┐
                              │             │                  │
                              └──────┬──────┘                  │
                                     │                         │
              ┌──────────────────────┼──────────────────────┐  │
              │                      │                      │  │
              ▼                      ▼                      ▼  │
       ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
       │   BLOCKED   │        │  ESCALATED  │        │   PAUSED    │
       │(recoverable)│        │(needs human)│        │(user action)│
       └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
              │                      │                      │
              │                      │                      │
              │    human resolved    │    human resolved    │
              └──────────────────────┴──────────────────────┘
                                     │
                                     ▼
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
       │  COMPLETED  │        │   FAILED    │        │  CANCELLED  │
       │  (terminal) │        │  (terminal) │        │  (terminal) │
       └─────────────┘        └─────────────┘        └─────────────┘
```

### 3.2 Status Definitions

| Status | Description | Next Possible States |
|--------|-------------|---------------------|
| `pending` | Task created, not yet started | `in_progress` |
| `in_progress` | Actively being worked on | `blocked`, `escalated`, `paused`, `completed`, `failed` |
| `blocked` | Temporary blocker (lease, auth) | `in_progress`, `failed` |
| `escalated` | Requires human decision | `in_progress`, `failed`, `cancelled` |
| `paused` | User-requested pause | `in_progress`, `cancelled` |
| `completed` | Successfully finished | (terminal) |
| `failed` | Unrecoverable error | (terminal) |
| `cancelled` | User cancelled | (terminal) |

### 3.3 Phase Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE TRANSITION FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌────────┐     ┌──────────┐     ┌────────────────┐
  │ INTAKE │────▶│ PLANNING │────▶│ IMPLEMENTATION │
  └────────┘     └──────────┘     └───────┬────────┘
       │                                  │
       │ needs_clarification              │
       ▼                                  │
  ┌────────────┐                          │
  │ ESCALATED  │                          │
  │ (human)    │                          │
  └────────────┘                          │
                                          ▼
                              ┌──────────────────────┐
                              │    VERIFICATION      │
                              └───────────┬──────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                        ▼                 ▼                 ▼
                   ┌─────────┐      ┌──────────┐     ┌───────────┐
                   │ PASSED  │      │  FAILED  │     │ MAX_RETRY │
                   └────┬────┘      └────┬─────┘     └─────┬─────┘
                        │                │                 │
                        │                │ cycle < 3       │ cycle >= 3
                        │                └────────┐        │
                        │                         ▼        ▼
                        │                 ┌────────────────────┐
                        │                 │ IMPLEMENTATION     │
                        │                 │ (with feedback)    │
                        │                 └────────────────────┘
                        │
                        ▼
                   ┌──────────┐
                   │  REVIEW  │
                   └────┬─────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
         ┌────────┐ ┌────────┐ ┌───────────┐
         │APPROVED│ │CHANGES │ │ MAX_RETRY │
         └───┬────┘ └───┬────┘ └─────┬─────┘
             │          │            │
             │          │ cycle < 2  │ cycle >= 2
             │          └────────┐   │
             │                   ▼   ▼
             │           ┌────────────────────┐
             │           │ IMPLEMENTATION     │
             │           │ (with feedback)    │
             │           └────────────────────┘
             │
             ▼
        ┌─────────┐
        │ RELEASE │
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │COMPLETED│
        └─────────┘
```

### 3.4 Formal Transition Rules

#### Status Transitions

| From | To | Trigger | Guard | Idempotency |
|------|----|---------| ------|-------------|
| `pending` | `in_progress` | Task processor picks up task | `phase = intake`, no lease held | Safe: No-op if already `in_progress` |
| `in_progress` | `blocked` | Transient failure detected | `exit_code ∈ {23, 124}`, retries < max | Safe: State preserved, retry counter incremented |
| `blocked` | `in_progress` | Blocker resolved | Lease available, retry backoff elapsed | Safe: Restarts from last checkpoint |
| `in_progress` | `escalated` | Human intervention needed | Retry limit exceeded OR security issue | Safe: No-op if already `escalated` |
| `escalated` | `in_progress` | Human resolved | Resolution provided, task not stale | **NOT idempotent**: Resolution consumed on first transition |
| `in_progress` | `paused` | User requests pause | User action via dashboard | Safe: Preserves current state |
| `paused` | `in_progress` | User resumes | User action via dashboard | Safe: Resumes from pause point |
| `in_progress` | `completed` | Release phase succeeds | `phase = release`, PR merged | Safe: Terminal state |
| `in_progress` | `failed` | Unrecoverable error | Max retries on non-transient error | Safe: Terminal state |
| `*` | `cancelled` | User cancels | User action, task not completed | Safe: Terminal state, resources cleaned |

#### Phase Transitions

| From Phase | To Phase | Guard (ALL must be true) | Side Effects |
|------------|----------|--------------------------|--------------|
| `intake` | `planning` | spec.md exists AND `needs_clarification = false` | PM Agent released |
| `intake` | (escalated) | `needs_clarification = true` | Teams notification queued |
| `planning` | `implementation` | plan.md exists AND tasks.md exists AND task_count > 0 | Task counter initialized |
| `implementation` | `verification` | `current_task = total_tasks` AND PR exists AND CI passing | QA Agent invoked |
| `verification` | `review` | `recommendation = "approve"` | Reviewer Agent invoked |
| `verification` | `implementation` | `recommendation = "request_changes"` AND `cycle_count < 3` | Feedback routed to Dev, counter++ |
| `verification` | (escalated) | `recommendation = "request_changes"` AND `cycle_count >= 3` | Teams notification, task paused |
| `review` | `release` | `assessment = "approve"` AND no blocking comments | Merge eligibility confirmed |
| `review` | `implementation` | `assessment = "request_changes"` AND `cycle_count < 2` | Feedback routed to Dev, counter++ |
| `review` | (escalated) | `assessment = "request_changes"` AND `cycle_count >= 2` | Teams notification, task paused |
| `release` | (completed) | PR merged successfully | Task finalized, notifications sent |

### 3.5 Idempotency & Concurrency Semantics

#### Optimistic Locking
All task envelope updates use optimistic locking via the `version` field:

```yaml
# Update precondition
UPDATE task_envelope
SET status = 'in_progress', version = version + 1
WHERE task_id = 'FEAT-xxx' AND version = expected_version
```

If `expected_version` doesn't match, update fails with `VERSION_MISMATCH` error. Caller must re-read and retry.

#### Lease-Based Mutual Exclusion
State-modifying operations MUST hold a blob lease:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LEASE ACQUISITION PROTOCOL                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Workflow starts         Acquire lease         Modify state
       │                      │                     │
       ▼                      ▼                     ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │ Read        │      │ PUT blob    │      │ PUT blob    │
  │ current     │─────▶│ ?comp=lease │─────▶│ with new    │
  │ state       │      │ acquire     │      │ state       │
  └─────────────┘      └─────────────┘      └──────┬──────┘
                             │                     │
                       Lease ID returned           │
                             │                     ▼
                             │              ┌─────────────┐
                             │              │ PUT blob    │
                             └─────────────▶│ ?comp=lease │
                                            │ release     │
                                            └─────────────┘

  Lease duration: 60 seconds
  Retry on conflict: 3 attempts with 5s backoff
  Force break: Only via manual intervention or Task Recovery workflow
```

#### Idempotent Operations

| Operation | Idempotent? | Implementation |
|-----------|-------------|----------------|
| Create task | Yes | Check existence first, return existing task_id |
| Update status | Yes (mostly) | Version check prevents duplicate updates |
| Upload artifact | Yes | Content-addressable: same content = same result |
| Trigger notification | No | Deduplicate via notification_id in task envelope |
| Increment retry counter | No | Protected by lease, version check |
| Escalate to human | No | One-time state change, subsequent calls rejected |

#### At-Least-Once Delivery
n8n workflows may execute multiple times due to retries. Design assumes:
- Read operations are always safe
- Write operations check preconditions (version, status guards)
- Side effects (notifications) tracked to prevent duplicates

### 3.6 Recovery Points

Each phase defines a recovery checkpoint for restart after failure:

| Phase | Recovery Point | State Preserved |
|-------|----------------|-----------------|
| `intake` | Start of phase | Request data (immutable) |
| `planning` | After spec.md saved | spec.md in blob |
| `implementation` | After each commit | `current_task`, `commits[]` in envelope |
| `verification` | After report saved | verification-report.yml in blob |
| `review` | After report saved | review-report.yml in blob |
| `release` | Before merge | PR URL, all approvals recorded |

**Recovery procedure**:
1. Task Recovery workflow scans for stuck tasks (>2 hours in same phase)
2. For each stuck task, determine recovery point
3. Reset to recovery point, clear transient errors
4. Re-queue for processing
5. Alert if recovery attempted >3 times for same phase

---

## 4. Agent Artifacts

### 4.1 Specification (spec.md)

Follows SpecKit format. Key sections for agent consumption:

```markdown
# Feature: {title}

## User Stories
- As a {role}, I want {feature}, so that {benefit}

## Functional Requirements
1. FR1: {requirement}
2. FR2: {requirement}

## Success Criteria
- [ ] SC1: {testable criterion}
- [ ] SC2: {testable criterion}

## Edge Cases
- EC1: {edge case and expected behavior}
```

### 4.2 Plan (plan.md)

Follows SpecKit format. Key sections:

```markdown
# Implementation Plan: {title}

## Technical Context
- Language/Version: {stack}
- Dependencies: {list}

## Implementation Approach
{description}

## Component Design
{architecture decisions}
```

### 4.3 Tasks (tasks.md)

Follows SpecKit format. Key sections:

```markdown
# Tasks: {title}

## Task List

### Task 1: {title}
- **Files**: {files to modify}
- **Tests**: {test requirements}
- **Dependencies**: none
- **Acceptance**: {completion criteria}

### Task 2: {title}
- **Dependencies**: Task 1
...
```

### 4.4 Verification Report

```yaml
# verification-report.yml
# Location: agent-verification/{task_id}/report-{cycle}.yml

task_id: "FEAT-20260119-abc123"
pr_url: "https://github.com/ii-us/target-repo/pull/42"
created_at: "2026-01-19T11:00:00Z"
cycle: 1

# ─────────────────────────────────────────────────────────────────────────────
# TEST RESULTS
# ─────────────────────────────────────────────────────────────────────────────
test_results:
  summary:
    passed: 47
    failed: 2
    skipped: 3
    total: 52

  failures:
    - name: "auth.test.ts > login > should reject invalid password"
      error: "Expected status 401, received 500"
      file: "src/auth/auth.service.ts"
      line: 42

    - name: "auth.test.ts > register > should validate email format"
      error: "Timeout after 5000ms"
      file: "src/auth/auth.controller.ts"
      line: 28

# ─────────────────────────────────────────────────────────────────────────────
# ACCEPTANCE CRITERIA
# ─────────────────────────────────────────────────────────────────────────────
acceptance_criteria:
  - criterion: "Users can register with email/password"
    status: "passed"
    evidence: "Registration endpoint returns 201, user record created"

  - criterion: "Users can log in and receive a session token"
    status: "failed"
    evidence: "Login returns 500 for valid credentials"
    issue_ref: "failures[0]"

  - criterion: "Invalid credentials return appropriate error"
    status: "blocked"
    evidence: "Cannot test due to login endpoint failure"

# ─────────────────────────────────────────────────────────────────────────────
# RECOMMENDATION
# ─────────────────────────────────────────────────────────────────────────────
recommendation: "request_changes"   # approve | request_changes

feedback:
  priority: "high"
  summary: "Login endpoint has critical error handling bug"
  items:
    - severity: "critical"
      description: "Login throws unhandled exception for invalid password"
      file: "src/auth/auth.service.ts"
      line: 42
      suggestion: "Add try-catch around password comparison"

    - severity: "major"
      description: "Email validation has race condition causing timeout"
      file: "src/auth/auth.controller.ts"
      line: 28
      suggestion: "Await the validation promise"
```

### 4.5 Review Report

```yaml
# review-report.yml
# Location: agent-review/{task_id}/report-{cycle}.yml

task_id: "FEAT-20260119-abc123"
pr_url: "https://github.com/ii-us/target-repo/pull/42"
created_at: "2026-01-19T11:30:00Z"
cycle: 1

# ─────────────────────────────────────────────────────────────────────────────
# OVERALL ASSESSMENT
# ─────────────────────────────────────────────────────────────────────────────
assessment: "request_changes"       # approve | request_changes

# ─────────────────────────────────────────────────────────────────────────────
# CODE REVIEW COMMENTS
# ─────────────────────────────────────────────────────────────────────────────
comments:
  - id: "R001"
    severity: "blocking"            # blocking | suggestion
    file: "src/auth/auth.service.ts"
    line: 45
    issue: "Password stored in plain text"
    suggestion: "Use bcrypt.hash() before storing"
    category: "security"

  - id: "R002"
    severity: "suggestion"
    file: "src/auth/auth.controller.ts"
    line: 12
    issue: "Missing rate limiting on login endpoint"
    suggestion: "Add @RateLimit decorator"
    category: "security"

  - id: "R003"
    severity: "suggestion"
    file: "src/auth/auth.service.ts"
    line: 30
    issue: "Magic number 3600 should be constant"
    suggestion: "Extract to SESSION_TTL_SECONDS constant"
    category: "maintainability"

# ─────────────────────────────────────────────────────────────────────────────
# SECURITY SCAN
# ─────────────────────────────────────────────────────────────────────────────
security:
  vulnerabilities_found: 1
  items:
    - type: "CWE-256"
      description: "Plaintext Storage of Password"
      severity: "critical"
      file: "src/auth/auth.service.ts"
      line: 45

# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
feedback:
  blocking_count: 1
  suggestion_count: 2
  priority_order: ["R001", "R002", "R003"]
  message: |
    Critical security issue: passwords must be hashed before storage.
    Address R001 before re-requesting review.
```

---

## 5. Storage Layout

### 5.1 Azure Blob Container Structure

```
iiusagentstore/
│
├── agent-state/                    # Task state management
│   ├── {task_id}/
│   │   └── task-envelope.yml       # Current task state
│   └── github-token-cache.yml      # Cached GitHub token
│
├── agent-spec/                     # SpecKit artifacts
│   └── {task_id}/
│       ├── spec.md                 # Feature specification
│       ├── plan.md                 # Implementation plan
│       ├── tasks.md                # Task breakdown
│       └── research.md             # (optional) Research notes
│
├── agent-verification/             # QA reports
│   └── {task_id}/
│       ├── report-1.yml            # First verification cycle
│       ├── report-2.yml            # Second cycle (if needed)
│       └── report-3.yml            # Third cycle (if needed)
│
├── agent-review/                   # Code review reports
│   └── {task_id}/
│       ├── report-1.yml            # First review cycle
│       └── report-2.yml            # Second cycle (if needed)
│
└── agent-release/                  # Release artifacts
    └── {task_id}/
        └── release-notes.md        # Generated release notes
```

### 5.2 Blob Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `{task_id}/task-envelope.yml` | `FEAT-20260119-abc123/task-envelope.yml` | Task state |
| `{task_id}/spec.md` | `FEAT-20260119-abc123/spec.md` | Specification |
| `{task_id}/report-{n}.yml` | `FEAT-20260119-abc123/report-1.yml` | Cycle-specific report |

### 5.3 Access Patterns

| Operation | Container | Lease Required |
|-----------|-----------|----------------|
| Create task | `agent-state` | No (new blob) |
| Update task state | `agent-state` | Yes (60s) |
| Read task state | `agent-state` | No |
| Write spec/plan/tasks | `agent-spec` | No |
| Read spec/plan/tasks | `agent-spec` | No |
| Write verification report | `agent-verification` | No |
| Write review report | `agent-review` | No |
| Refresh GitHub token | `agent-state` | Yes (60s) |

---

## Summary

This data model provides:

1. **Task Envelope**: Central state object tracking feature lifecycle
2. **State Machine**: Clear status and phase transitions with bounded retry loops
3. **Agent Artifacts**: Structured outputs for each agent role
4. **Storage Layout**: Organized blob containers with consistent naming

Key design decisions:
- YAML for state (human-readable, supports comments)
- Markdown for artifacts (SpecKit compatibility)
- Blob leases for concurrency control
- Version field for optimistic locking
- Cycle tracking for bounded retry loops
