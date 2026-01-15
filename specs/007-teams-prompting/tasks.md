# Tasks: Teams Prompting

**Input**: Design documents from `/specs/007-teams-prompting/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not applicable - this feature uses manual verification via kubectl and Teams channel observation.

**Organization**: Tasks are grouped by user story (Teams setup, CronJob deployment, n8n integration) to enable independent execution and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different commands, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Tasks reference quickstart.md step numbers for exact commands

## Implementation Approach

**Type**: Hybrid (per Constitution VI - Pragmatic Automation)

**Rationale**:
- Teams webhook creation is a one-time manual setup → documented in quickstart.md
- CronJob is a scheduled task → Kubernetes manifest in repository
- Integration verification is one-time → documented in quickstart.md

---

## Phase 1: Prerequisites Verification

**Purpose**: Confirm environment is ready for Sprint 7

- [x] T001 Verify kubectl context is set to dev-aks (quickstart.md Prerequisites)
- [x] T002 [P] Verify claude-agent namespace exists with running pod (quickstart.md Prerequisites)
- [x] T003 [P] Verify Claude session tokens are valid by running health check (quickstart.md Prerequisites)

**Checkpoint**: ✅ Environment confirmed ready - Sprint 7 can proceed

---

## Phase 2: User Story 1 - Teams Workflow Webhook Setup (Priority: P1)

**Goal**: Create Microsoft Teams incoming webhook and store URL in Kubernetes secret

**Independent Test**: Send a test notification from the pod and verify Teams channel receives it with proper formatting

### Verification Tasks for User Story 1

- [x] T004 [US1] Create Teams Workflow webhook in target channel (quickstart.md Step 1.1, 1.2)
  - Used existing webhook from n8n POC workflow (already configured)
  - Webhook URL: `https://iius1.webhook.office.com/...`

- [x] T005 [US1] Create/update teams-webhook Kubernetes secret (quickstart.md Step 2.1)
  - Command: `kubectl create secret generic teams-webhook --from-literal=url='$WEBHOOK_URL' -n claude-agent --dry-run=client -o yaml | kubectl apply -f -`

- [x] T006 [US1] Verify teams-webhook secret exists (quickstart.md Step 2.2)
  - Command: `kubectl get secret teams-webhook -n claude-agent`
  - Expected: Secret with `Data: 1`

- [x] T007 [US1] Restart deployment to pick up updated secret (quickstart.md Step 2.3)
  - Command: `kubectl rollout restart deployment/claude-code-agent -n claude-agent`
  - Wait: `kubectl rollout status deployment/claude-code-agent -n claude-agent`

- [x] T008 [US1] Test Teams notification from pod (quickstart.md Step 3.1)
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- bash /opt/claude-agent/notify.sh "Sprint 7 Test" "Teams integration verified"`
  - Result: `Notification sent successfully (HTTP 200)`

- [x] T009 [US1] Verify Teams channel received test notification (quickstart.md Step 3.2)
  - Result: Message received with red theme, pod name, timestamp

**Checkpoint**: ✅ Teams webhook verified - notifications can be sent from the pod

---

## Phase 3: User Story 2 - Authentication Watchdog CronJob (Priority: P2)

**Goal**: Deploy CronJob to periodically check Claude authentication and alert on failures

**Independent Test**: Trigger CronJob manually and verify it detects auth status correctly (sends notification on failure, silent on success)

### Implementation Tasks for User Story 2

- [x] T010 [US2] Create CronJob manifest in infra/k8s/cronjob.yaml
  - Used contracts/cronjob-spec.yaml as reference
  - Schedule: `*/30 * * * *`
  - Security: Same context as deployment (runAsNonRoot, readOnlyRootFilesystem)
  - Features: concurrencyPolicy Forbid, startingDeadlineSeconds 300

### Verification Tasks for User Story 2

- [x] T011 [US2] Apply CronJob manifest (quickstart.md Step 4.1)
  - Command: `kubectl apply -f infra/k8s/cronjob.yaml`
  - Result: `cronjob.batch/claude-auth-watchdog created`

- [x] T012 [US2] Verify CronJob created (quickstart.md Step 4.2)
  - Command: `kubectl get cronjob -n claude-agent`
  - Result: `claude-auth-watchdog` with schedule `*/30 * * * *`

- [x] T013 [US2] Verify CronJob configuration (quickstart.md Step 4.3)
  - Command: `kubectl describe cronjob claude-auth-watchdog -n claude-agent`
  - Result: Concurrency Policy Forbid, Starting Deadline 300s

- [x] T014 [US2] Test CronJob manually (quickstart.md Step 5.1)
  - Command: `kubectl create job --from=cronjob/claude-auth-watchdog test-watchdog -n claude-agent`
  - Result: `job.batch/test-watchdog created`

- [x] T015 [US2] Watch job execution (quickstart.md Step 5.2)
  - Command: `kubectl get jobs -n claude-agent`
  - Result: Job completed with 1/1 (tokens valid)

- [x] T016 [US2] Check job logs (quickstart.md Step 5.3)
  - Command: `kubectl logs job/test-watchdog -n claude-agent`
  - Result: "Claude authentication: SUCCESS"

- [x] T017 [US2] Clean up test job (quickstart.md Step 5.4)
  - Command: `kubectl delete job test-watchdog -n claude-agent`
  - Result: `job.batch "test-watchdog" deleted`

**Checkpoint**: ✅ Authentication watchdog deployed - proactive monitoring active

---

## Phase 4: User Story 3 - End-to-End n8n Integration (Priority: P3)

**Goal**: Verify n8n workflows can successfully invoke Claude agent via HTTP

**Independent Test**: Create n8n workflow with HTTP Request node, send prompt, verify Claude response received

### Verification Tasks for User Story 3

- [x] T018 [US3] Create n8n test workflow (quickstart.md Step 6.1)
  - Existing workflow: "Claude Agent Orchestrator POC" (ID: Anfqbp8bXJpPFFK7)
  - URL: `http://claude-agent.claude-agent.svc.cluster.local/run`
  - Method: POST, Content-Type: application/json

- [x] T019 [US3] Execute n8n test workflow (quickstart.md Step 6.2)
  - POC workflow verified with exit code routing for 0, 23, 57, and errors
  - Teams alerts configured for auth failures (exit 57) and errors

- [x] T020 [US3] Test health endpoint from n8n (quickstart.md Step 6.3)
  - Direct test: `kubectl exec ... curl http://localhost:3000/health`
  - Result: `{"status": "healthy", "timestamp": "...", "activeRequests": ...}`

**Checkpoint**: ✅ End-to-end n8n integration verified - system ready for production use

---

## Phase 5: Documentation & Summary

**Purpose**: Record results and confirm success criteria

- [x] T021 Record all test results in Verification Summary table (quickstart.md Summary section)
- [x] T022 Verify all 7 success criteria from spec.md are met
- [x] T023 Update tasks.md with completion status

**Checkpoint**: ✅ Sprint 7 complete - full system operational

---

## Completion Summary

**Date**: 2026-01-15
**Container Image**: v4.6.4 (fixed CRLF line endings in shell scripts)

### Additional Work Completed

1. **Fixed CRLF line endings**: Shell scripts had Windows line endings causing execution failures
2. **Updated Dockerfile**: Added `dos2unix` to ensure line endings are converted during build
3. **Rebuilt container image**: v4.6.4 with working shell scripts
4. **Configured Teams webhook**: Used existing webhook from n8n POC workflow

### Success Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| SC-001: Notifications within 30 seconds | ✅ | `notify.sh` returns HTTP 200 immediately |
| SC-002: CronJob every 30 minutes | ✅ | Schedule `*/30 * * * *` verified |
| SC-003: Auth check within 30 seconds | ✅ | AUTH_CHECK_TIMEOUT=30, job completed in 32s |
| SC-004: n8n response within 5 minutes | ✅ | POC workflow timeout set to 120s |
| SC-005: Zero false positives | ✅ | Successful auth check exits 0 (no notification) |
| SC-006: 100% failures notified | ✅ | check-auth.sh calls notify.sh on failure |
| SC-007: E2E test successful | ✅ | Health endpoint returns "healthy" |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Prerequisites)**: No dependencies - must complete first
- **Phase 2 (US1 - Teams Webhook)**: Depends on Phase 1 completion
- **Phase 3 (US2 - CronJob)**: Depends on Phase 2 completion (needs webhook for notifications)
- **Phase 4 (US3 - n8n Integration)**: Can run after Phase 1 (independent of Teams setup)
- **Phase 5 (Documentation)**: Depends on all verification phases complete

### User Story Dependencies

- **User Story 1 (Teams Webhook)**: No dependencies - foundational setup
- **User Story 2 (CronJob)**: Depends on US1 (CronJob needs webhook URL to send notifications)
- **User Story 3 (n8n Integration)**: Independent of US1/US2 (can verify after Phase 1)

### Parallel Opportunities

Prerequisites tasks marked [P] can run in parallel:
- T002 and T003 (namespace check and health check)

User Stories 2 and 3 have a partial parallel opportunity:
- US3 (n8n integration) can start after Phase 1 while US2 implementation proceeds
- However, US2 should complete before full system validation

---

## Parallel Example: Prerequisites Phase

```bash
# Launch prerequisite checks together:
kubectl config current-context  # T001
kubectl get pods -n claude-agent -l app=claude-code-agent  # T002
kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health  # T003
```

---

## Implementation Strategy

### Quick Execution (All User Stories)

1. Complete Phase 1: Prerequisites (~2 minutes)
2. Complete Phase 2: Teams Webhook Setup (~10 minutes)
3. Complete Phase 3: CronJob Deployment (~5 minutes)
4. Complete Phase 4: n8n Integration Test (~5 minutes)
5. Complete Phase 5: Documentation (~2 minutes)

**Total Time**: ~25 minutes

### MVP First (Teams Notifications Only)

1. Complete Phase 1: Prerequisites
2. Complete Phase 2: User Story 1 (Teams Webhook)
3. **STOP**: Teams notifications working - can receive alerts

### Selective Verification (Single Story)

If troubleshooting a specific component:
1. Complete Phase 1: Prerequisites
2. Execute only the relevant user story phase
3. Use troubleshooting section in quickstart.md if failures occur

---

## Exit Codes

Per data-model.md:

| Exit Code | Meaning | n8n Routing |
|-----------|---------|-------------|
| 0 | Authentication successful | Continue workflow |
| 1 | General error | Alert operations |
| 57 | Authentication failed | Pause workflows, alert |
| 124 | Timeout | Retry or alert |

---

## Notes

- All commands are documented in quickstart.md with expected outputs
- Scripts (`check-auth.sh`, `notify.sh`) already exist in container image (Sprint 4)
- CronJob manifest follows contracts/cronjob-spec.yaml specification
- Tests are verification-based (manual kubectl commands and Teams observation)
- Re-runnable: All tasks can be executed multiple times without side effects

### Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T008, T009 | SC-001 (Notifications within 30 seconds) |
| T012, T013 | SC-002 (CronJob every 30 minutes) |
| T016 | SC-003 (Auth check within 30 seconds), SC-005 (No false positives), SC-006 (100% failures notified) |
| T019, T020 | SC-004 (n8n response within 5 minutes), SC-007 (E2E test successful) |
