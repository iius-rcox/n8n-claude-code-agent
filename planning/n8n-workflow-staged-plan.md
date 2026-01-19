# n8n Multi-Agent Workflow — Staged Implementation Plan

## Overview

Build 7 n8n workflows across 4 stages, with integrated testing at each stage.

```
Stage 1: Foundation     → Blob State Manager, Agent Runner
Stage 2: Orchestration  → Generic Phase Executor, Notification Hub
Stage 3: Human Loop     → Human Checkpoint, Master Orchestrator
Stage 4: Resilience     → Task Recovery, Circuit Breaker, E2E Testing
```

---

## Stage 1: Foundation (Core Infrastructure)

**Goal:** Establish the two fundamental building blocks that all other workflows depend on.

### Workflows to Build

| # | Workflow | Purpose |
|---|----------|---------|
| 1 | **Blob State Manager** | Azure blob CRUD with 60s lease support |
| 2 | **Agent Runner** | HTTP call to Claude Agent with retry logic |

### 1.1 Blob State Manager

**Nodes:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Switch: Operation]
    │
    ├─create──► [HTTP PUT blob]
    ├─read────► [HTTP GET blob]
    ├─update──► [Acquire Lease] → [HTTP PUT blob] → [Release Lease]
    ├─upload──► [HTTP PUT artifact]
    └─download► [HTTP GET artifact]
    │
    ▼
[Return Result]
```

**Key Configuration:**
- Azure Storage URL: `https://iiusagentstore.blob.core.windows.net`
- Lease duration: 60 seconds
- Auth: Shared Access Signature (SAS) or Managed Identity

### 1.2 Agent Runner

**Nodes:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Set Parameters]
    │
    ▼
[Mock Switch] ──mock──► [Return Mock Response]
    │ real
    ▼
[HTTP POST /run]
    │
    ▼
[Parse Response]
    │
    ▼
[Switch: Exit Code]
    ├─0───► [Return: success]
    ├─23──► [Retry with backoff] → [Loop back to HTTP POST]
    ├─57──► [Return: auth_failure]
    └─other► [Return: error]
```

**Key Configuration:**
- URL: `http://claude-agent.claude-agent.svc.cluster.local/run`
- Timeout: 300000ms (5 min)
- Max retries for exit 23: 3
- Backoff: 30s, 60s, 120s

---

### Stage 1 Testing

#### API Testing (Automated)

**Test 1.1: Blob State Manager - Create Operation**
```bash
# Trigger via n8n webhook
curl -X POST https://n8n.ii-us.com/webhook/test-blob-create \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "ticket_id": "TEST-001",
    "content": {"status": "pending", "title": "Test Task"}
  }'

# Expected: 200 OK, blob created at agent-state/TEST-001/task-envelope.yml
```

**Test 1.2: Blob State Manager - Read Operation**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-blob-read \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "read",
    "ticket_id": "TEST-001"
  }'

# Expected: 200 OK, returns task envelope content
```

**Test 1.3: Blob State Manager - Lease Conflict**
```bash
# Acquire lease on blob, then try to update from workflow
# Expected: Exit code 23, retry logic triggered
```

**Test 1.4: Agent Runner - Success Path (Mock)**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-001",
    "prompt": "Say hello",
    "mock": true,
    "mock_exit_code": 0
  }'

# Expected: success=true, exitCode=0
```

**Test 1.5: Agent Runner - Auth Failure (Mock)**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -H "Content-Type: application/json" \
  -d '{
    "mock": true,
    "mock_exit_code": 57
  }'

# Expected: success=false, exitCode=57, error contains "auth"
```

**Test 1.6: Agent Runner - Real API Call**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Respond with exactly: STAGE1_TEST_PASS",
    "mock": false
  }'

# Expected: success=true, output contains "STAGE1_TEST_PASS"
```

#### UI Testing (Chrome DevTools)

**Test 1.7: Verify Blob in Azure Portal**
```
1. Navigate to: https://portal.azure.com
2. Go to: Storage accounts → iiusagentstore → Containers → agent-state
3. Verify: TEST-001/task-envelope.yml exists
4. Click blob → verify content matches expected YAML
```

**Test 1.8: Verify n8n Workflow Execution**
```
1. Navigate to: https://n8n.ii-us.com
2. Go to: Executions
3. Filter by: "Blob State Manager" workflow
4. Verify: Recent executions show success status
5. Click execution → verify node outputs
```

### Stage 1 Completion Criteria

- [ ] Blob State Manager: All CRUD operations work
- [ ] Blob State Manager: Lease acquisition/release works
- [ ] Blob State Manager: Lease conflict returns proper error
- [ ] Agent Runner: Mock mode returns configurable exit codes
- [ ] Agent Runner: Real API call to Claude Agent succeeds
- [ ] Agent Runner: Retry logic triggers on exit code 23
- [ ] Agent Runner: Auth failure (57) returns proper error
- [ ] All 8 tests pass

---

## Stage 2: Phase Execution (Core Logic)

**Goal:** Build the generic phase executor and notification system.

### Workflows to Build

| # | Workflow | Purpose |
|---|----------|---------|
| 3 | **Generic Phase Executor** | Config-driven phase execution |
| 4 | **Notification Hub** | Teams alerts with rate limiting |

### 2.1 Generic Phase Executor

**Nodes:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Load Task State] ← [Call: Blob State Manager (read)]
    │
    ▼
[Load Phase Config from input]
    │
    ▼
[Build Prompt from Template]
    │
    ▼
[Call: Agent Runner]
    │
    ├─success─► [Parse Output (extract PR URL, etc.)]
    │               │
    │               ▼
    │           [Upload Artifact] ← [Call: Blob State Manager (upload)]
    │               │
    │               ▼
    │           [Update Task State] ← [Call: Blob State Manager (update)]
    │               │
    │               ▼
    │           [Return: success + extracted_data]
    │
    └─failure─► [Return: failure + reason]
```

**Phase Config Schema:**
```json
{
  "name": "intake",
  "agent": "pm",
  "container": "agent-spec",
  "artifact_name": "specification.md",
  "prompt_template": "intake",
  "timeout": 300000
}
```

### 2.2 Notification Hub

**Nodes:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Switch: Notification Type]
    │
    ├─phase_complete──► [Format Teams Card] → [HTTP POST Teams Webhook]
    ├─auth_failure────► [Check Rate Limit] → [Format Alert] → [HTTP POST]
    ├─task_failure────► [Check Rate Limit] → [Format Alert] → [HTTP POST]
    └─task_complete───► [Format Summary Card] → [HTTP POST]
    │
    ▼
[Log to Application Insights (optional)]
    │
    ▼
[Return: sent/rate_limited]
```

**Rate Limiting:**
- Store last alert time in workflow static data
- Auth failure: Max 1 per 5 minutes
- Task failure: Max 1 per task per hour

---

### Stage 2 Testing

#### API Testing (Automated)

**Test 2.1: Phase Executor - Intake Phase (Mock)**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-phase-executor \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-002",
    "phase_config": {
      "name": "intake",
      "agent": "pm",
      "container": "agent-spec",
      "prompt_template": "intake"
    },
    "context": {
      "title": "Add login button",
      "description": "User should be able to log in",
      "repo": "ii-us/test-repo"
    },
    "mock": true
  }'

# Expected: success=true, artifact uploaded to agent-spec/TEST-002/
```

**Test 2.2: Phase Executor - Real Intake Phase**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-phase-executor \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-003",
    "phase_config": {
      "name": "intake",
      "agent": "pm",
      "container": "agent-spec",
      "prompt_template": "intake"
    },
    "context": {
      "title": "Add dark mode toggle",
      "description": "Users should be able to switch between light and dark themes",
      "repo": "ii-us/test-repo"
    },
    "mock": false
  }'

# Expected: success=true, specification.md created with user stories
```

**Test 2.3: Notification Hub - Phase Complete**
```bash
curl -X POST https://n8n.ii-us.com/webhook/test-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "phase_complete",
    "ticket_id": "TEST-003",
    "phase": "intake",
    "agent": "pm",
    "duration_ms": 45000
  }'

# Expected: Teams message appears in configured channel
```

**Test 2.4: Notification Hub - Rate Limiting**
```bash
# Send 3 auth_failure notifications in quick succession
for i in 1 2 3; do
  curl -X POST https://n8n.ii-us.com/webhook/test-notification \
    -H "Content-Type: application/json" \
    -d '{"type": "auth_failure", "ticket_id": "TEST-00'$i'"}'
  sleep 1
done

# Expected: Only first notification sent, others rate-limited
```

#### UI Testing (Chrome DevTools)

**Test 2.5: Verify Specification Artifact**
```
1. Navigate to: Azure Portal → iiusagentstore → agent-spec
2. Find: TEST-003/specification.md
3. Download and verify:
   - Contains problem statement
   - Contains user stories
   - Markdown format is valid
```

**Test 2.6: Verify Teams Notification**
```
1. Open Microsoft Teams
2. Go to configured channel
3. Verify: Phase complete card appeared
4. Verify: Card shows correct ticket_id, phase, duration
```

**Test 2.7: Verify Workflow Execution Chain**
```
1. Navigate to: https://n8n.ii-us.com
2. Go to: Executions
3. Find: Generic Phase Executor execution for TEST-003
4. Verify: Shows calls to Blob State Manager and Agent Runner
5. Click through: Verify data passed correctly between workflows
```

### Stage 2 Completion Criteria

- [ ] Generic Phase Executor: Loads phase config correctly
- [ ] Generic Phase Executor: Builds prompt from template
- [ ] Generic Phase Executor: Calls Agent Runner with correct params
- [ ] Generic Phase Executor: Uploads artifact on success
- [ ] Generic Phase Executor: Updates task state on success
- [ ] Notification Hub: Sends Teams messages
- [ ] Notification Hub: Rate limiting works for auth_failure
- [ ] Artifact content is valid (specification has user stories)
- [ ] All 7 tests pass

---

## Stage 3: Human Loop (Approvals & Orchestration)

**Goal:** Add human checkpoint capability and the master orchestrator.

### Workflows to Build

| # | Workflow | Purpose |
|---|----------|---------|
| 5 | **Human Checkpoint** | Pause for approval with timeout |
| 6 | **Master Orchestrator** | Entry point, full pipeline |

### 3.1 Human Checkpoint

**Nodes:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Generate UUID Token]
    │
    ▼
[Store Token in Task State] ← [Call: Blob State Manager (update)]
    │
    ▼
[Send Teams Card with Approval Link]
    │
    ▼
[Wait Node: Check every 5 minutes]
    │
    ├─[Check: Token approved in blob?]
    │     │
    │     ├─yes─► [Return: approved]
    │     │
    │     └─no──► [Check: Timeout reached?]
    │                 │
    │                 ├─no──► [Check: Send reminder?] → [Loop]
    │                 │
    │                 └─yes─► [Return: timeout]
```

**Approval Webhook (separate):**
```
[Webhook: /task-approve]
    │
    ▼
[Validate Token]
    │
    ▼
[Update Task State: approved=true]
    │
    ▼
[Return: OK]
```

### 3.2 Master Orchestrator

**Nodes:**
```
[Webhook: /task-start]
    │
    ▼
[Initialize Task State]
    │
    ▼
[Create Task Envelope] ← [Call: Blob State Manager (create)]
    │
    ▼
[Phase Loop: intake → planning → implementation → verification → review → release]
    │
    ├─[Call: Generic Phase Executor]
    │     │
    │     ├─success─► [Check: requires_approval?]
    │     │               │
    │     │               ├─yes─► [Call: Human Checkpoint]
    │     │               │           │
    │     │               │           ├─approved─► [Continue]
    │     │               │           │
    │     │               │           └─timeout──► [Pause + Alert]
    │     │               │
    │     │               └─no──► [Continue to next phase]
    │     │
    │     └─failure─► [Check: retry limit?]
    │                     │
    │                     ├─under─► [Loop back]
    │                     │
    │                     └─over──► [Pause + Alert]
    │
    ▼
[All Phases Complete]
    │
    ▼
[Finalize: status=completed]
    │
    ▼
[Notify: Task Complete]
    │
    ▼
[Respond: Success]
```

---

### Stage 3 Testing

#### API Testing (Automated)

**Test 3.1: Human Checkpoint - Approval Flow**
```bash
# Start checkpoint
curl -X POST https://n8n.ii-us.com/webhook/test-checkpoint \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-004",
    "phase": "planning",
    "summary": "Test approval flow"
  }'

# Returns: { "token": "abc-123-...", "status": "waiting" }

# Simulate approval
curl -X POST https://n8n.ii-us.com/webhook/task-approve \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-004",
    "token": "abc-123-...",
    "action": "approve"
  }'

# Expected: Checkpoint workflow completes with approved=true
```

**Test 3.2: Human Checkpoint - Rejection Flow**
```bash
# Same as above but with action=reject
curl -X POST https://n8n.ii-us.com/webhook/task-approve \
  -d '{"ticket_id": "TEST-005", "token": "...", "action": "reject", "reason": "Needs more detail"}'

# Expected: Checkpoint returns approved=false, reason="Needs more detail"
```

**Test 3.3: Master Orchestrator - Two Phase Test (Mock)**
```bash
curl -X POST https://n8n.ii-us.com/webhook/task-start \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-006",
    "title": "Test two phases",
    "description": "Simple test",
    "repo": "ii-us/test-repo",
    "require_approval": [],
    "mock": true,
    "stop_after_phase": "planning"
  }'

# Expected: Intake and Planning phases complete, task paused
```

**Test 3.4: Master Orchestrator - Full Pipeline (Mock)**
```bash
curl -X POST https://n8n.ii-us.com/webhook/task-start \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TEST-007",
    "title": "Full pipeline test",
    "description": "Test all phases",
    "repo": "ii-us/test-repo",
    "require_approval": [],
    "mock": true
  }'

# Expected: All 6 phases complete, status=completed
```

**Test 3.5: Master Orchestrator - With Approval Gate**
```bash
# Start task requiring approval after planning
curl -X POST https://n8n.ii-us.com/webhook/task-start \
  -d '{
    "ticket_id": "TEST-008",
    "title": "Approval gate test",
    "description": "Test approval workflow",
    "repo": "ii-us/test-repo",
    "require_approval": ["planning"],
    "mock": true
  }'

# Task pauses after planning, waiting for approval
# Approve via webhook, then task continues
```

#### UI Testing (Chrome DevTools)

**Test 3.6: Teams Approval Card Interaction**
```
1. Trigger Human Checkpoint for TEST-009
2. Open Microsoft Teams
3. Find approval card in channel
4. Click "Approve" button
5. Verify: Card updates to show "Approved by [user]"
6. Verify: n8n workflow receives approval and continues
```

**Test 3.7: Orchestrator Execution Visualization**
```
1. Navigate to: https://n8n.ii-us.com
2. Go to: Executions
3. Find: Master Orchestrator execution for TEST-007
4. Verify: Execution shows all 6 phase calls
5. Click each phase: Verify correct data passed
6. Verify: Total execution time shown
```

**Test 3.8: Task State Progression**
```
1. Navigate to: Azure Portal → iiusagentstore → agent-state
2. Find: TEST-007/task-envelope.yml
3. Download and verify:
   - All 6 phases show status: completed
   - Each phase has started_at, completed_at, duration_ms
   - audit_log contains all phase events
```

### Stage 3 Completion Criteria

- [ ] Human Checkpoint: Generates unique approval token
- [ ] Human Checkpoint: Stores token in task state
- [ ] Human Checkpoint: Sends Teams approval card
- [ ] Human Checkpoint: Detects approval via webhook
- [ ] Human Checkpoint: Returns approved/rejected/timeout
- [ ] Master Orchestrator: Creates task envelope
- [ ] Master Orchestrator: Loops through all 6 phases
- [ ] Master Orchestrator: Pauses at approval gates
- [ ] Master Orchestrator: Handles phase failures
- [ ] Master Orchestrator: Finalizes task on completion
- [ ] All 8 tests pass

---

## Stage 4: Resilience (Recovery & Production Hardening)

**Goal:** Add circuit breaker, task recovery, and comprehensive E2E testing.

### Workflows to Build

| # | Workflow | Purpose |
|---|----------|---------|
| 7 | **Task Recovery** | Scheduled scan for stuck tasks |

### Updates to Existing Workflows

| Workflow | Enhancement |
|----------|-------------|
| **Agent Runner** | Add circuit breaker logic |
| **Master Orchestrator** | Check circuit before starting |
| **Notification Hub** | Add circuit_open notification type |

### 4.1 Circuit Breaker (Agent Runner Enhancement)

**Add to Agent Runner:**
```
[Sub-Workflow Trigger]
    │
    ▼
[Check Circuit State] ← [Call: Blob State Manager (read system/circuit-state.json)]
    │
    ├─OPEN─► [Return: circuit_open error]
    │
    └─CLOSED─► [Continue to existing flow]
           │
           ▼
      [On Exit Code 57:]
           │
           ▼
      [Increment failure_count]
           │
           ▼
      [If failure_count >= 2 in 5 min:]
           │
           ├─yes─► [Set circuit=OPEN, expires in 15 min]
           │           │
           │           ▼
           │       [Send ONE circuit_open alert]
           │
           └─no──► [Continue]
```

### 4.2 Task Recovery

**Nodes:**
```
[Schedule Trigger: */30 * * * *]
    │
    ▼
[List all task envelopes] ← [HTTP: List blobs in agent-state/]
    │
    ▼
[For each task:]
    │
    ├─[Skip if status != in_progress]
    │
    ├─[Skip if updated_at > (now - 2 hours)]
    │
    └─[Task is stuck!]
           │
           ▼
      [Determine last completed phase]
           │
           ▼
      [Send Teams Alert with Resume/Cancel buttons]
           │
           ▼
      [Update task: status=stuck]
```

**Recovery Webhooks:**
- `/task-resume/{ticket_id}` - Resume from last phase
- `/task-cancel/{ticket_id}` - Mark cancelled, cleanup

---

### Stage 4 Testing

#### API Testing (Automated)

**Test 4.1: Circuit Breaker - Opens on Auth Failures**
```bash
# Trigger two auth failures in quick succession
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -d '{"mock": true, "mock_exit_code": 57}'
sleep 2
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -d '{"mock": true, "mock_exit_code": 57}'

# Verify circuit is now OPEN
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -d '{"mock": true, "mock_exit_code": 0}'

# Expected: Returns circuit_open error without calling Claude
```

**Test 4.2: Circuit Breaker - Auto-closes After 15 Minutes**
```bash
# After circuit opens, wait 15+ minutes
# Then test again
curl -X POST https://n8n.ii-us.com/webhook/test-agent-run \
  -d '{"mock": true, "mock_exit_code": 0}'

# Expected: Circuit closed, call succeeds
```

**Test 4.3: Circuit Breaker - Manual Reset**
```bash
curl -X POST https://n8n.ii-us.com/webhook/circuit-reset

# Expected: Circuit state reset to closed
```

**Test 4.4: Task Recovery - Detects Stuck Task**
```bash
# Create a task and make it appear stuck
curl -X POST https://n8n.ii-us.com/webhook/test-create-stuck-task \
  -d '{
    "ticket_id": "TEST-STUCK-001",
    "status": "in_progress",
    "updated_at": "2026-01-15T10:00:00Z"
  }'

# Manually trigger recovery scan
curl -X POST https://n8n.ii-us.com/webhook/test-recovery-scan

# Expected: TEST-STUCK-001 detected, Teams alert sent
```

**Test 4.5: Task Recovery - Resume Flow**
```bash
curl -X POST https://n8n.ii-us.com/webhook/task-resume/TEST-STUCK-001

# Expected: Task resumes from last completed phase
```

**Test 4.6: Task Recovery - Cancel Flow**
```bash
curl -X POST https://n8n.ii-us.com/webhook/task-cancel/TEST-STUCK-002

# Expected: Task status=cancelled, workspace cleaned up
```

#### UI Testing (Chrome DevTools)

**Test 4.7: Circuit Breaker State in Azure**
```
1. Navigate to: Azure Portal → iiusagentstore → agent-state → system
2. Open: circuit-state.json
3. Verify: Shows current circuit state (open/closed)
4. Verify: failure_count, last_failure_at populated after test 4.1
```

**Test 4.8: Task Recovery Alert in Teams**
```
1. After triggering stuck task detection
2. Open Microsoft Teams
3. Find: "Task Stuck" alert card
4. Verify: Shows ticket_id, phase, stuck duration
5. Verify: Has Resume and Cancel buttons
6. Click Resume: Verify task continues
```

**Test 4.9: Recovery Workflow Execution Log**
```
1. Navigate to: https://n8n.ii-us.com
2. Go to: Executions
3. Filter by: "Task Recovery" workflow
4. Find: Recent scheduled execution
5. Verify: Shows blob listing, stuck detection logic
```

#### End-to-End Testing

**Test 4.10: Full Pipeline with Real Agent**
```bash
# Production-like test with real Claude Agent
curl -X POST https://n8n.ii-us.com/webhook/task-start \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "E2E-TEST-001",
    "title": "Add hello world endpoint",
    "description": "Create a simple /hello endpoint that returns {\"message\": \"Hello World\"}",
    "repo": "ii-us/test-api",
    "require_approval": ["planning", "review"],
    "mock": false
  }'

# Monitor progress:
# 1. Intake: PM creates specification
# 2. Planning: PM creates plan (APPROVAL REQUIRED)
# 3. Approve via Teams
# 4. Implementation: Dev creates code + PR
# 5. Verification: QA tests
# 6. Review: Reviewer checks (APPROVAL REQUIRED)
# 7. Approve via Teams
# 8. Release: Dev merges

# Expected: Real PR created, merged, task completed
```

**Test 4.11: Chaos Test - Kill Workflow Mid-Execution**
```bash
# Start a long-running task
curl -X POST https://n8n.ii-us.com/webhook/task-start \
  -d '{"ticket_id": "CHAOS-001", ...}'

# While in implementation phase, restart n8n
# (or manually cancel the execution)

# Wait 2+ hours for recovery scan
# Verify: CHAOS-001 detected as stuck
# Verify: Resume works correctly
```

**Test 4.12: Load Test - Multiple Concurrent Tasks**
```bash
# Start 5 tasks simultaneously
for i in {1..5}; do
  curl -X POST https://n8n.ii-us.com/webhook/task-start \
    -d '{"ticket_id": "LOAD-00'$i'", "mock": true}' &
done
wait

# Expected: All 5 tasks complete without interference
# Verify: No lease conflicts between tasks
# Verify: Workspace isolation works
```

#### UI Testing - Production Dashboard

**Test 4.13: Operations Dashboard Integration**
```
1. Navigate to: https://ops-dashboard.ii-us.com (or internal URL)
2. Verify: Dashboard shows active tasks
3. Verify: Can see task progress (which phase)
4. Verify: Can trigger manual operations (resume, cancel)
5. Verify: Auth status indicator works
```

### Stage 4 Completion Criteria

- [ ] Circuit Breaker: Opens after 2 auth failures in 5 min
- [ ] Circuit Breaker: Auto-closes after 15 min
- [ ] Circuit Breaker: Manual reset works
- [ ] Circuit Breaker: Blocks new tasks when open
- [ ] Task Recovery: Scheduled scan runs every 30 min
- [ ] Task Recovery: Detects tasks stuck > 2 hours
- [ ] Task Recovery: Sends Teams alert with actions
- [ ] Task Recovery: Resume webhook works
- [ ] Task Recovery: Cancel webhook cleans up
- [ ] E2E: Full pipeline with real agent completes
- [ ] E2E: PR is actually created in GitHub
- [ ] E2E: Approval gates work in production
- [ ] Chaos: Recovery handles crashed workflows
- [ ] Load: 5 concurrent tasks complete successfully
- [ ] All 14 tests pass

---

## Summary

| Stage | Workflows | Tests | Focus |
|-------|-----------|-------|-------|
| 1 | Blob State Manager, Agent Runner | 8 | Foundation infrastructure |
| 2 | Generic Phase Executor, Notification Hub | 7 | Core execution logic |
| 3 | Human Checkpoint, Master Orchestrator | 8 | Human-in-the-loop |
| 4 | Task Recovery + Circuit Breaker | 14 | Production resilience |

**Total:** 7 workflows, 37 tests

### Test Categories

| Category | Count | Tools |
|----------|-------|-------|
| API (curl/webhook) | 25 | Bash, n8n webhooks |
| UI (Chrome DevTools) | 12 | Azure Portal, n8n UI, Teams |

### Dependencies

```
Stage 1 (Foundation)
    ↓
Stage 2 (Phase Execution)  ← depends on Stage 1
    ↓
Stage 3 (Human Loop)       ← depends on Stage 2
    ↓
Stage 4 (Resilience)       ← depends on Stage 3
```

Each stage must pass all tests before proceeding to the next.
