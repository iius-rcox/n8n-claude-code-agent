# n8n Multi-Agent Workflow Architecture Plan

## Overview

This document describes the n8n workflow architecture for orchestrating a multi-agent Claude coding system. The design uses a **Simplified Orchestrator + Generic Phase Executor** pattern for modularity while avoiding over-engineering.

```
External Trigger (GitHub, Teams, Manual)
        │
        ▼
┌─────────────────────────────────────────────┐
│         MASTER ORCHESTRATOR                 │
│  Loops through phase configs:               │
│  Intake → Planning → Implementation →       │
│  Verification → Review → Release            │
└─────────────────────────────────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Generic │ │  Blob   │ │ Human   │ │Circuit  │
   │ Phase   │ │ State   │ │Checkpoint│ │Breaker  │
   │ Executor│ │ Manager │ │         │ │         │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘
        │
        ▼
   ┌─────────┐
   │ Agent   │
   │ Runner  │
   └─────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│     CLAUDE AGENT HTTP API                   │
│     POST /run → { prompt, timeout }         │
└─────────────────────────────────────────────┘
```

---

## Workflows to Build (Simplified: 7 Workflows)

| # | Workflow | Purpose |
|---|----------|---------|
| 1 | **Agent Runner** | Execute Claude agent with retry logic and circuit breaker |
| 2 | **Blob State Manager** | Read/write task state to Azure blob with lease renewal |
| 3 | **Generic Phase Executor** | Execute any phase (replaces 6 separate phase workflows) |
| 4 | **Human Checkpoint** | Pause for approval with timeout and reminders |
| 5 | **Notification Hub** | Centralized Teams alerts and structured logging |
| 6 | **Master Orchestrator** | Entry point, routes through phases with retry limits |
| 7 | **Task Recovery** | Scan and resume orphaned tasks |

**Rationale:** Consolidated from 11 to 7 workflows by using a Generic Phase Executor with phase config as input, rather than 6 nearly-identical phase workflows.

---

## Critical Fixes Addressed

### Fix 1: Circuit Breaker for Auth Failures

**Problem:** Exit code 57 causes cascading failures across all tasks.

**Solution:** Agent Runner implements circuit breaker pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│ Circuit Breaker State (stored in blob: system/circuit-state.json)│
├─────────────────────────────────────────────────────────────────┤
│ {                                                                │
│   "auth_healthy": true,                                         │
│   "failure_count": 0,                                           │
│   "last_failure": null,                                         │
│   "circuit_open_until": null                                    │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘

Circuit Breaker Rules:
- 2 auth failures in 5 minutes → OPEN circuit (reject new tasks)
- Circuit stays OPEN for 15 minutes
- Single consolidated Teams alert (not per-task)
- Manual reset via /circuit-reset webhook OR auto-reset after 15 min
```

### Fix 2: Bounded Retry Limits

**Problem:** Verification → Implementation loop could run forever.

**Solution:** Task envelope tracks retry counts with hard limits:

```yaml
# In task-envelope.yml
retry_limits:
  verification_max: 3      # Max verification failures before human intervention
  implementation_max: 3    # Max implementation retries per verification cycle

retry_counts:
  verification_attempts: 0
  implementation_attempts: 0
```

**Behavior:**
- After 3 verification failures → pause task, send alert, require human intervention
- Human can: fix issue manually, reset counters, or cancel task

### Fix 3: Task Recovery Workflow

**Problem:** Orphaned tasks if Master Orchestrator fails mid-execution.

**Solution:** Scheduled workflow scans for stuck tasks:

```
┌─────────────────────────────────────────────────────────────────┐
│ Task Recovery Workflow (runs every 30 minutes)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Schedule Trigger: */30 * * * *]                                │
│         │                                                        │
│         ▼                                                        │
│ [List all task envelopes in agent-state/]                       │
│         │                                                        │
│         ▼                                                        │
│ [Filter: status=in_progress AND updated_at < (now - 2 hours)]   │
│         │                                                        │
│         ▼                                                        │
│ [For each stuck task:]                                          │
│    ├── Determine last successful phase                          │
│    ├── Send Teams alert: "Task {id} appears stuck at {phase}"   │
│    └── Option A: Auto-resume from last phase                    │
│        Option B: Wait for human to /task-resume {id}            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Fix 4: Extended Lease with Renewal

**Problem:** 30-second lease expires during long Claude operations.

**Solution:**
- Lease duration: **60 seconds** (extended from 30)
- Lease renewal: Background job renews every **45 seconds** during long operations
- Fallback: If renewal fails, operation completes but logs warning

```javascript
// Lease renewal pattern in Blob State Manager
async function withLeaseRenewal(blobClient, operation) {
  const lease = await blobClient.acquireLease(60);
  const renewalInterval = setInterval(() => {
    lease.renew().catch(err => console.warn('Lease renewal failed:', err));
  }, 45000);

  try {
    return await operation();
  } finally {
    clearInterval(renewalInterval);
    await lease.release();
  }
}
```

### Fix 5: Workspace Isolation Strategy

**Problem:** Multiple tasks could conflict in shared `/workspace` directory.

**Solution:** Each task gets isolated workspace:

```
/workspace/
  └── {ticket_id}/
      └── {repo_name}/    ← cloned repo lives here
```

**Dev Agent prompt includes:**
```
WORKSPACE: /workspace/${ticket_id}
REPOSITORY: ${repo}

Instructions:
1. Your workspace is isolated at /workspace/${ticket_id}
2. Clone to: /workspace/${ticket_id}/${repo_name}
3. All operations must stay within this directory
```

### Fix 6: GitHub Auth Strategy

**Problem:** How does the Dev agent authenticate to GitHub?

**Solution:** GitHub App token minted per-task:

```
┌─────────────────────────────────────────────────────────────────┐
│ GitHub Auth Flow                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Task starts                                                  │
│         │                                                        │
│         ▼                                                        │
│ 2. Blob State Manager reads GitHub App credentials              │
│    from K8s secret (app-id, private-key)                        │
│         │                                                        │
│         ▼                                                        │
│ 3. Mint installation token via GitHub API                       │
│    POST /app/installations/{id}/access_tokens                   │
│         │                                                        │
│         ▼                                                        │
│ 4. Token stored in task envelope (expires in 1 hour)            │
│         │                                                        │
│         ▼                                                        │
│ 5. Dev agent uses token for git operations:                     │
│    git clone https://x-access-token:{token}@github.com/...      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Fix 7: Structured Logging and Metrics

**Problem:** No observability when things go wrong.

**Solution:** All workflows emit structured logs to Azure Application Insights:

```javascript
// Standard log format for all workflow nodes
const logEvent = {
  timestamp: new Date().toISOString(),
  correlation_id: `${ticket_id}-${execution_id}`,
  workflow: "master-orchestrator",
  node: "phase-verification",
  ticket_id: ticket_id,
  phase: "verification",
  agent: "qa",
  event_type: "phase_started",  // phase_started | phase_completed | phase_failed | retry | error
  duration_ms: null,
  exit_code: null,
  error_message: null,
  metadata: {}
};
```

**Metrics tracked:**
- Phase duration (avg, p50, p95)
- Task completion rate
- Retry frequency by phase
- Auth failure frequency
- Circuit breaker open/close events

---

## Claude Agent HTTP API Interface

**Endpoint:** `http://claude-agent.claude-agent.svc.cluster.local/run`

**Request:**
```json
{
  "prompt": "string (required, max 100KB)",
  "timeout": "number (optional, 1-600000 ms, default: 300000)",
  "workdir": "string (optional, absolute path)"
}
```

**Response:**
```json
{
  "success": true|false,
  "exitCode": 0|23|57|124|other,
  "output": "Claude CLI stdout",
  "duration": 1234,
  "error": "Error message (on failure)"
}
```

**Exit Code Handling:**

| Exit Code | Meaning | Workflow Action |
|-----------|---------|-----------------|
| `0` | Success | Continue to next phase |
| `23` | Lease conflict | Retry with backoff (30s, 60s, 120s), max 3 retries |
| `57` | Auth failure | Increment circuit breaker, alert if threshold reached |
| `124` | Timeout | Retry once, then fail with alert |
| Other | Unknown error | Log, alert, fail phase |

---

## Detailed Workflow Designs

### Workflow 1: Agent Runner

**Purpose:** Execute Claude agent with circuit breaker protection.

**Input:**
```json
{
  "ticket_id": "TICKET-001",
  "phase": "intake",
  "agent_name": "pm",
  "prompt": "...",
  "timeout": 300000,
  "max_retries": 3,
  "workdir": "/workspace/TICKET-001"
}
```

**Flow:**
```
[Sub-Workflow Trigger]
        │
        ▼
[Check Circuit Breaker] ──OPEN──► [Return: circuit_open error]
        │ CLOSED
        ▼
[Set Parameters + Log Start]
        │
        ▼
[Mock or Real?] ──mock──► [Mock Response]
        │ real                   │
        ▼                        │
[HTTP POST /run] ◄───────────────┘
        │
        ▼
[Parse Exit Code]
        │
        ▼
[Switch: Exit Code]
   │    │    │    │
   ▼    ▼    ▼    ▼
  [0] [23] [57] [Other]
   │    │    │    │
   │    │    │    └──► [Log Error] ──► [Return: error]
   │    │    │
   │    │    └──► [Update Circuit Breaker]
   │    │              │
   │    │         ┌────┴────┐
   │    │         ▼         ▼
   │    │    [< threshold] [>= threshold]
   │    │         │              │
   │    │         │         [OPEN Circuit]
   │    │         │              │
   │    │         │         [Send ONE Alert]
   │    │         │              │
   │    │         └──────┬───────┘
   │    │                ▼
   │    │         [Return: auth_failure]
   │    │
   │    └──► [Check Retry Count]
   │              │
   │         ┌────┴────┐
   │         ▼         ▼
   │    [< max]    [>= max]
   │         │         │
   │    [Wait + Retry] │
   │         │         │
   │         └────┬────┘
   │              ▼
   │         [Return: lease_conflict_exhausted OR retry]
   │
   └──► [Log Success] ──► [Return: success]
```

---

### Workflow 2: Blob State Manager

**Purpose:** Azure blob operations with extended lease management.

**Operations:**

| Operation | Description | Lease Required |
|-----------|-------------|----------------|
| `create` | Create new task envelope | No |
| `read` | Read current task state | No |
| `update` | Update task state | Yes (60s with renewal) |
| `upload_artifact` | Upload phase artifact | No |
| `download_artifact` | Download phase artifact | No |
| `acquire_lease` | Get exclusive access | N/A |
| `release_lease` | Release exclusive access | N/A |
| `check_circuit` | Read circuit breaker state | No |
| `update_circuit` | Update circuit breaker | Yes |

**Lease Configuration:**
- Duration: **60 seconds** (extended from 30)
- Renewal interval: Every 45 seconds during long operations
- Backoff on conflict: 30s, 60s, 120s

**Azure Blob Paths:**
```
iiusagentstore.blob.core.windows.net/
├── agent-state/
│   ├── {ticket_id}/task-envelope.yml
│   └── system/circuit-state.json       ← Circuit breaker state
├── agent-spec/{ticket_id}/specification.md
├── agent-plan/{ticket_id}/implementation-plan.md
├── agent-verification/{ticket_id}/test-results.json
├── agent-review/{ticket_id}/review-feedback.md
└── agent-release/{ticket_id}/release-notes.md
```

---

### Workflow 3: Generic Phase Executor

**Purpose:** Execute any phase using configuration-driven approach.

**Input:**
```json
{
  "ticket_id": "TICKET-001",
  "phase_config": {
    "name": "implementation",
    "agent": "dev",
    "container": "agent-state",
    "prompt_template": "implementation",
    "requires_approval": false,
    "max_retries": 3,
    "timeout": 600000
  },
  "context": {
    "repo": "ii-us/my-app",
    "branch": "feature/TICKET-001-dark-mode",
    "specification": "...",
    "plan": "...",
    "pr_url": null
  }
}
```

**Flow:**
```
[Sub-Workflow Trigger]
        │
        ▼
[Load Task State] ◄──── [Call: Blob State Manager (read)]
        │
        ▼
[Load Required Artifacts based on phase_config]
        │
        ▼
[Build Prompt from Template + Context]
        │
        ▼
[Call: Agent Runner]
        │
   ┌────┴────┐
   ▼         ▼
[Success] [Failure]
   │         │
   ▼         ▼
[Parse Output]  [Check if retryable]
   │              │
   ▼              ▼
[Extract PR URL, etc. from output]  [Return: failure + reason]
   │
   ▼
[Upload Artifact] ──► [Call: Blob State Manager (upload)]
   │
   ▼
[Update Task State] ──► [Call: Blob State Manager (update)]
   │
   ▼
[Log: Phase Complete]
   │
   ▼
[Return: success + extracted_data]
```

**Phase Configurations (stored in workflow or blob):**

```json
{
  "phases": {
    "intake": {
      "agent": "pm",
      "container": "agent-spec",
      "artifact_name": "specification.md",
      "prompt_template": "intake",
      "requires_previous": [],
      "requires_approval_after": false
    },
    "planning": {
      "agent": "pm",
      "container": "agent-plan",
      "artifact_name": "implementation-plan.md",
      "prompt_template": "planning",
      "requires_previous": ["intake"],
      "requires_approval_after": true
    },
    "implementation": {
      "agent": "dev",
      "container": "agent-state",
      "artifact_name": "implementation-notes.md",
      "prompt_template": "implementation",
      "requires_previous": ["planning"],
      "requires_approval_after": false,
      "extracts": ["pr_url", "branch_name"]
    },
    "verification": {
      "agent": "qa",
      "container": "agent-verification",
      "artifact_name": "test-results.json",
      "prompt_template": "verification",
      "requires_previous": ["implementation"],
      "requires_approval_after": false,
      "on_failure": "loop_to_implementation",
      "max_failures": 3
    },
    "review": {
      "agent": "reviewer",
      "container": "agent-review",
      "artifact_name": "review-feedback.md",
      "prompt_template": "review",
      "requires_previous": ["verification"],
      "requires_approval_after": true,
      "on_changes_requested": "loop_to_implementation"
    },
    "release": {
      "agent": "dev",
      "container": "agent-release",
      "artifact_name": "release-notes.md",
      "prompt_template": "release",
      "requires_previous": ["review"]
    }
  }
}
```

---

### Workflow 4: Human Checkpoint

**Purpose:** Pause for approval with timeout and reminders.

**Improvements:**
- 24-hour default timeout
- Reminder at 4 hours and 12 hours if no response
- Action.OpenUrl to web form (more reliable than Action.Http)

**Flow:**
```
[Sub-Workflow Trigger]
        │
        ▼
[Generate Approval Token (UUID)]
        │
        ▼
[Store Token + Deadline in Task State]
        │
        ▼
[Send Teams Adaptive Card with OpenUrl action]
        │
        ▼
[Start Wait Loop]
        │
        ├── [Wait 4 hours] ──► [Check if approved] ──no──► [Send Reminder 1]
        │                              │ yes
        │                              └──► [Return: approved]
        │
        ├── [Wait 8 more hours] ──► [Check if approved] ──no──► [Send Reminder 2]
        │                                   │ yes
        │                                   └──► [Return: approved]
        │
        └── [Wait 12 more hours] ──► [Check if approved] ──no──► [Timeout]
                                            │ yes                    │
                                            └──► [Return: approved]  │
                                                                     ▼
                                                          [Return: timeout]
```

**Approval Web Form (instead of Action.Http):**
```
URL: https://n8n.ii-us.com/webhook-ui/task-approve?ticket={ticket_id}&token={token}

Simple form with:
- Task summary (read-only)
- Approve button
- Reject button + reason field
```

---

### Workflow 5: Notification Hub

**Purpose:** Centralized notifications with deduplication.

**Features:**
- Rate limiting: Max 1 auth alert per 5 minutes
- Deduplication: Same error within 10 minutes → skip
- Structured logging to Azure Application Insights

**Notification Types:**

| Type | Channel | Rate Limit |
|------|---------|------------|
| `phase_complete` | Teams | None |
| `approval_required` | Teams | None |
| `auth_failure` | Teams | 1 per 5 min |
| `circuit_open` | Teams | 1 per event |
| `task_failure` | Teams | 1 per task per hour |
| `task_stuck` | Teams | 1 per task per 2 hours |
| `task_complete` | Teams | None |

**Logging Output (to Application Insights):**
```javascript
{
  "name": "workflow_event",
  "time": "2026-01-17T14:30:00Z",
  "data": {
    "correlation_id": "TICKET-001-exec-abc123",
    "ticket_id": "TICKET-001",
    "workflow": "master-orchestrator",
    "phase": "verification",
    "event": "phase_failed",
    "agent": "qa",
    "exit_code": 1,
    "duration_ms": 45000,
    "retry_count": 2
  }
}
```

---

### Workflow 6: Master Orchestrator

**Purpose:** Entry point with bounded retry loops.

**Input:**
```json
{
  "ticket_id": "TICKET-001",
  "title": "Add dark mode toggle",
  "description": "User story and acceptance criteria...",
  "repo": "ii-us/my-app",
  "branch_prefix": "feature/",
  "require_approval": ["planning", "review"],
  "timeout_minutes": 60,
  "priority": "normal"
}
```

**Flow with Bounded Retries:**
```
[Webhook /task-start]
        │
        ▼
[Check Circuit Breaker] ──OPEN──► [Return 503: System paused]
        │ CLOSED
        ▼
[Initialize Task State with retry_limits]
        │
        ▼
[Create Task Envelope + Mint GitHub Token]
        │
        ▼
[Create Isolated Workspace: /workspace/{ticket_id}]
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ PHASE LOOP (for each phase in sequence)                 │
│                                                         │
│   [Call: Generic Phase Executor with phase_config]      │
│           │                                             │
│      ┌────┴────┐                                        │
│      ▼         ▼                                        │
│   [Success] [Failure]                                   │
│      │         │                                        │
│      │    [Check retry_counts vs retry_limits]          │
│      │         │                                        │
│      │    ┌────┴────┐                                   │
│      │    ▼         ▼                                   │
│      │ [< limit] [>= limit]                             │
│      │    │         │                                   │
│      │    │    [Pause Task]                             │
│      │    │         │                                   │
│      │    │    [Alert: Human intervention required]     │
│      │    │         │                                   │
│      │    │    [Wait for /task-resume webhook]          │
│      │    │         │                                   │
│      │    └────┬────┘                                   │
│      │         │                                        │
│      │    [Loop back to appropriate phase]              │
│      │                                                  │
│      ▼                                                  │
│   [Check: requires_approval_after?]                     │
│      │                                                  │
│      ├──yes──► [Call: Human Checkpoint]                 │
│      │              │                                   │
│      │         ┌────┴────┐                              │
│      │         ▼         ▼                              │
│      │    [Approved] [Rejected/Timeout]                 │
│      │         │         │                              │
│      │         │    [Pause Task + Alert]                │
│      │         │                                        │
│      └──no─────┴──► [Continue to next phase]            │
│                                                         │
└─────────────────────────────────────────────────────────┘
        │
        ▼
[All phases complete]
        │
        ▼
[Finalize Task State: status=completed]
        │
        ▼
[Cleanup Workspace]
        │
        ▼
[Notify: Task Complete]
        │
        ▼
[Respond: Success + summary]
```

**Retry Limits:**
```yaml
retry_limits:
  verification_failures: 3    # After 3 QA failures → human intervention
  implementation_retries: 3   # After 3 dev retries per cycle → human intervention
  review_rejections: 3        # After 3 reviewer rejections → human intervention
```

---

### Workflow 7: Task Recovery

**Purpose:** Scan for and recover orphaned tasks.

**Trigger:** Schedule (every 30 minutes)

**Flow:**
```
[Schedule: */30 * * * *]
        │
        ▼
[List blobs in agent-state/ container]
        │
        ▼
[For each task-envelope.yml:]
   │
   ├── [Skip if status != in_progress]
   │
   ├── [Skip if updated_at > (now - 2 hours)]
   │
   └── [Task is stuck!]
            │
            ▼
       [Read task envelope]
            │
            ▼
       [Determine last completed phase]
            │
            ▼
       [Send Teams Alert:]
       "Task {ticket_id} stuck at {phase} for {hours}h"
       "Last activity: {updated_at}"
       "Options: [Resume] [Investigate] [Cancel]"
            │
            ▼
       [Update task: status=stuck, stuck_detected_at=now]
```

**Recovery Actions (via webhook):**
- `/task-resume/{ticket_id}` - Resume from last completed phase
- `/task-cancel/{ticket_id}` - Mark as cancelled, cleanup workspace
- `/task-investigate/{ticket_id}` - Keep stuck, suppress alerts for 24h

---

## State Management

### Task Envelope Structure (Updated)

**Location:** `agent-state/{ticket_id}/task-envelope.yml`

```yaml
ticket_id: TICKET-001
title: "Add dark mode toggle"
status: in_progress  # pending | in_progress | paused | stuck | completed | failed | cancelled
current_phase: implementation
priority: normal

created_at: "2026-01-17T10:00:00Z"
updated_at: "2026-01-17T14:30:00Z"

# Workspace isolation
workspace: "/workspace/TICKET-001"

# GitHub integration
repository:
  url: "https://github.com/ii-us/my-app"
  branch: "feature/TICKET-001-dark-mode"
  pr_number: 42
  github_token_expires: "2026-01-17T15:00:00Z"  # 1-hour token

# Retry tracking (NEW)
retry_limits:
  verification_failures: 3
  implementation_retries: 3
  review_rejections: 3

retry_counts:
  verification_failures: 0
  implementation_retries: 0
  review_rejections: 0

# Approval tracking
pending_approval:
  phase: null
  token: null
  requested_at: null
  deadline: null
  reminders_sent: 0

phases:
  intake:
    status: completed
    started_at: "2026-01-17T10:00:00Z"
    completed_at: "2026-01-17T10:15:00Z"
    agent: pm
    artifact: "agent-spec/TICKET-001/specification.md"
    duration_ms: 900000

  planning:
    status: completed
    started_at: "2026-01-17T10:20:00Z"
    completed_at: "2026-01-17T10:35:00Z"
    agent: pm
    artifact: "agent-plan/TICKET-001/implementation-plan.md"
    approved_by: "user@example.com"
    approved_at: "2026-01-17T11:00:00Z"
    duration_ms: 900000

  implementation:
    status: in_progress
    started_at: "2026-01-17T11:05:00Z"
    agent: dev
    attempt: 1

  verification:
    status: pending

  review:
    status: pending

  release:
    status: pending

audit_log:
  - timestamp: "2026-01-17T10:00:00Z"
    event: task_created
    actor: workflow
  - timestamp: "2026-01-17T10:15:00Z"
    event: phase_completed
    phase: intake
    actor: pm
    duration_ms: 900000
```

### Circuit Breaker State

**Location:** `agent-state/system/circuit-state.json`

```json
{
  "auth_healthy": true,
  "state": "closed",
  "failure_count": 0,
  "failure_window_start": null,
  "last_failure_at": null,
  "circuit_opened_at": null,
  "circuit_closes_at": null,
  "last_alert_sent": null
}
```

---

## Implementation Sequence

### Step 1: Core Infrastructure (Foundation)
1. **Blob State Manager** - CRUD with 60s lease, renewal support
2. **Agent Runner** - HTTP + circuit breaker + retry logic
3. **Notification Hub** - Teams + rate limiting + App Insights logging

### Step 2: Phase Execution
4. **Generic Phase Executor** - Config-driven phase execution
5. **Human Checkpoint** - Timeout + reminders + web form

### Step 3: Orchestration
6. **Master Orchestrator** - Full pipeline with bounded retries
7. **Task Recovery** - Scheduled scan for stuck tasks

### Step 4: Testing
- Unit test each workflow with mock mode
- Integration test with real blob storage, mock agent
- E2E test with real agent on test ticket
- Chaos test: kill workflow mid-execution, verify recovery

---

## Verification Checklist

### Core Infrastructure
- [ ] Blob State Manager: CRUD operations work
- [ ] Blob State Manager: 60s lease with renewal during long ops
- [ ] Agent Runner: Calls API, parses response correctly
- [ ] Agent Runner: Circuit breaker opens after 2 failures in 5 min
- [ ] Agent Runner: Circuit breaker auto-closes after 15 min
- [ ] Notification Hub: Teams cards render correctly
- [ ] Notification Hub: Rate limiting prevents alert spam
- [ ] Notification Hub: Events appear in Application Insights

### Phase Execution
- [ ] Generic Phase Executor: Loads correct prompt template
- [ ] Generic Phase Executor: Extracts PR URL from implementation output
- [ ] Human Checkpoint: Approval web form works
- [ ] Human Checkpoint: Sends reminders at 4h and 12h
- [ ] Human Checkpoint: Times out at 24h

### Orchestration
- [ ] Master Orchestrator: Creates isolated workspace
- [ ] Master Orchestrator: Mints GitHub token per task
- [ ] Master Orchestrator: Loops verification → implementation (max 3x)
- [ ] Master Orchestrator: Pauses task when retry limit hit
- [ ] Task Recovery: Detects stuck tasks after 2 hours
- [ ] Task Recovery: /task-resume successfully continues task

### End-to-End
- [ ] Full pipeline completes for simple test ticket
- [ ] Verification failure loops correctly
- [ ] Review rejection loops correctly
- [ ] Auth failure triggers circuit breaker
- [ ] Orphaned task is detected and alerted

---

## Prompt Templates

### Intake (PM Agent)
```
You are a Project Manager agent. Analyze the assignment and create a specification.

ASSIGNMENT:
Ticket: ${ticket_id}
Title: ${title}
Description: ${description}
Repository: ${repo}

Create a specification document (markdown) including:
1. Problem statement
2. User stories with acceptance criteria (Given/When/Then)
3. Technical constraints
4. Out of scope items
5. Success metrics

Output ONLY the markdown specification, no explanations.
```

### Planning (PM Agent)
```
You are a Project Manager agent. Create an implementation plan.

SPECIFICATION:
${specification_content}

Create an implementation plan (markdown) including:
1. Task breakdown (numbered list, max 10 tasks)
2. Dependencies between tasks
3. Estimated complexity (S/M/L) for each task
4. Suggested order
5. Risk areas and mitigation

Output ONLY the markdown plan, no explanations.
```

### Implementation (Dev Agent)
```
You are a Developer agent. Implement the task.

WORKSPACE: ${workspace}
REPOSITORY: ${repo}
BRANCH: ${branch_name}
GITHUB_TOKEN: (use for git operations)

PLAN:
${plan_content}

CURRENT TASK: ${current_task}

Instructions:
1. Clone repo to ${workspace}/${repo_name} if not exists
2. Checkout branch ${branch_name} (create if needed)
3. Implement the changes
4. Run existing tests
5. Commit with message: "${ticket_id}: ${title}"
6. Push to origin
7. Create PR if not exists

At the end, output a JSON block:
```json
{
  "status": "success|failure",
  "pr_url": "https://github.com/...",
  "branch": "feature/...",
  "commits": ["abc123"],
  "notes": "any blockers or issues"
}
```
```

### Verification (QA Agent)
```
You are a QA agent. Verify the implementation.

SPECIFICATION:
${specification_content}

PULL REQUEST: ${pr_url}
BRANCH: ${branch_name}

Tasks:
1. Checkout the PR branch
2. Review code changes
3. Run test suite
4. Verify each acceptance criterion from spec
5. Check edge cases

Output a JSON report:
```json
{
  "status": "pass|fail",
  "test_results": {
    "passed": 10,
    "failed": 0,
    "skipped": 2
  },
  "acceptance_criteria": [
    {"criterion": "...", "status": "pass|fail", "notes": "..."}
  ],
  "issues_found": [],
  "recommendation": "approve|request_changes"
}
```
```

### Review (Reviewer Agent)
```
You are a Code Reviewer agent. Review the PR.

PULL REQUEST: ${pr_url}
SPECIFICATION: ${specification_content}

Review for:
1. Code quality and readability
2. Test coverage
3. Security issues
4. Performance concerns
5. Documentation

Output a JSON review:
```json
{
  "decision": "approve|request_changes",
  "summary": "brief overall assessment",
  "comments": [
    {"file": "...", "line": 42, "severity": "critical|warning|suggestion", "comment": "..."}
  ],
  "required_changes": [],
  "suggestions": []
}
```
```

### Release (Dev Agent)
```
You are a Developer agent. Complete the release.

PULL REQUEST: ${pr_url}
REVIEW STATUS: Approved

Tasks:
1. Merge PR (squash merge)
2. Verify CI passes on main
3. Tag release if version bump
4. Close related issues

Output:
```json
{
  "status": "success|failure",
  "merge_commit": "abc123",
  "tag": "v1.2.3" or null,
  "closed_issues": ["#42"],
  "notes": ""
}
```
```

---

## References

- **Claude Agent HTTP API:** `infra/docker/server.js`
- **Existing POC Workflow:** ID `Anfqbp8bXJpPFFK7` on n8n.ii-us.com
- **Azure Storage:** `iiusagentstore` (6 containers + system/)
- **n8n Instance:** https://n8n.ii-us.com
- **Teams Webhook:** (configured in Notification Hub)
- **Application Insights:** (for structured logging)
