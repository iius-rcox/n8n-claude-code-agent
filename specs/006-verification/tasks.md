# Tasks: Verification

**Input**: Design documents from `/specs/006-verification/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not applicable - this feature executes verification tests against existing infrastructure.

**Organization**: Tasks are grouped by user story (verification test category) to enable independent execution and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different commands, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Tasks reference quickstart.md step numbers for exact commands

## Implementation Approach

**Type**: Runbook (per Constitution VI - Pragmatic Automation)

**Rationale**: This is a one-time verification phase to confirm Sprint 1-5 deliverables are working. Verification tests that run once per deployment cycle should be documented in a runbook rather than scripted. Tasks reference quickstart.md steps and execute kubectl commands directly.

---

## Phase 1: Prerequisites Verification

**Purpose**: Confirm environment is ready for verification tests

- [x] T001 Verify kubectl context is set to dev-aks (quickstart.md Prerequisites) ✅ PASS
- [x] T002 [P] Verify claude-agent namespace exists and is Active (quickstart.md Prerequisites) ✅ PASS
- [x] T003 [P] Verify claude-code-agent pod is in Running state (quickstart.md Prerequisites) ✅ PASS

**Checkpoint**: Environment confirmed ready - verification tests can proceed

---

## Phase 2: User Story 1 - Azure Workload Identity Verification (Priority: P1)

**Goal**: Confirm the Claude agent pod can authenticate to Azure services using Workload Identity and access all 6 storage containers

**Independent Test**: Execute Azure CLI commands inside the running pod to authenticate and list storage containers

### Verification Tasks for User Story 1

- [x] T037 [US1] Test Azure identity login from pod (quickstart.md Step 1.1) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- sh -c "az login --service-principal -u \$AZURE_CLIENT_ID -t \$AZURE_TENANT_ID --federated-token \"\$(cat \$AZURE_FEDERATED_TOKEN_FILE)\" --allow-no-subscriptions"`
  - **NOTE**: Original command `az login --identity` fails for Workload Identity - use federated token approach
  - Expected: JSON output with environmentName, id, isDefault fields
  - Timeout: 30 seconds

- [x] T037b [US1] Test storage container access (quickstart.md Step 1.2) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- az storage container list --account-name iiusagentstore --auth-mode login --query '[].name' -o tsv`
  - Expected: 6 containers (agent-state, agent-spec, agent-plan, agent-verification, agent-review, agent-release)
  - Timeout: 30 seconds

**Checkpoint**: Azure Workload Identity verified - pod can authenticate and access storage

---

## Phase 3: User Story 2 - Claude Authentication Verification (Priority: P2)

**Goal**: Confirm the Claude agent pod can successfully communicate with Claude's API

**Independent Test**: Execute a simple Claude prompt inside the running pod and verify successful response

### Verification Tasks for User Story 2

- [x] T038 [US2] Test Claude prompt execution from pod (quickstart.md Step 2) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "Say 'Claude Max auth working'"`
  - Expected: Response containing "Claude Max auth working"
  - **Result**: Response received: "Claude Max auth working"
  - **Fix Applied**: Updated Dockerfile to v4.6.3 - moved server files to /opt/claude-agent/, updated deployment to mount /home/claude-agent as emptyDir

**Checkpoint**: Claude authentication verified - pod can execute prompts

---

## Phase 4: User Story 3 - GitHub CSI Secrets Verification (Priority: P3)

**Goal**: Confirm GitHub App credentials are correctly mounted from Azure Key Vault via CSI Driver

**Independent Test**: Check that secret files exist at the expected mount path and contain valid credential data

### Verification Tasks for User Story 3

- [x] T039a [P] [US3] Verify secrets directory exists (quickstart.md Step 3.1) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /secrets/github/`
  - Expected: Files present - app-id, private-key.pem
  - Timeout: 10 seconds

- [x] T039b [P] [US3] Verify App ID content (quickstart.md Step 3.2) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- cat /secrets/github/app-id`
  - Expected: `2658380` (numeric App ID from Sprint 2)
  - Timeout: 10 seconds

**Checkpoint**: GitHub CSI secrets verified - credentials mounted and accessible

---

## Phase 5: User Story 4 - NetworkPolicy Verification (Priority: P4)

**Goal**: Confirm NetworkPolicies are correctly applied for security hardening

**Independent Test**: Check that all 4 NetworkPolicies exist and that DNS resolution works (proving allow-dns policy functions while default-deny blocks other traffic)

### Verification Tasks for User Story 4

- [x] T040a [P] [US4] Verify NetworkPolicy count (quickstart.md Step 4.1) ✅ PASS
  - Command: `kubectl get networkpolicy -n claude-agent`
  - Expected: 4 policies (default-deny-all, allow-dns, allow-azure-egress, allow-ingress-from-n8n)
  - Timeout: 10 seconds

- [x] T040b [P] [US4] Test DNS resolution (quickstart.md Step 4.2) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- getent hosts iiusagentstore.blob.core.windows.net`
  - Expected: IP address returned (proves allow-dns NetworkPolicy works)
  - Timeout: 10 seconds

**Checkpoint**: NetworkPolicies verified - security hardening confirmed

---

## Phase 6: User Story 5 - HTTP Health Endpoint Verification (Priority: P5)

**Goal**: Confirm the Claude agent's HTTP server is running and responding to health checks

**Independent Test**: Make an HTTP request to the health endpoint and verify JSON response with healthy status

### Verification Tasks for User Story 5

- [x] T041 [US5] Test HTTP health endpoint (quickstart.md Step 5) ✅ PASS
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health`
  - Expected: JSON with `status: "healthy"`, timestamp, activeRequests
  - Response time: < 1 second
  - Timeout: 10 seconds

**Checkpoint**: HTTP health endpoint verified - service ready for n8n integration

---

## Phase 7: Documentation & Summary

**Purpose**: Record results and determine next steps

- [x] T042 Record all test results in Verification Summary table (quickstart.md Summary section) ✅ DONE
- [x] T043 Document any failures with troubleshooting steps taken ✅ DONE (fixes applied)
- [x] T044 Verify all 8 success criteria from spec.md are met ✅ ALL PASS

**Checkpoint**: All verification complete - ready for Sprint 7 or troubleshooting

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Prerequisites)**: No dependencies - must complete first
- **Phase 2-6 (User Stories)**: Depend on Phase 1 completion
  - Can execute in parallel (recommended order: P1 → P5)
  - Or execute sequentially in priority order
- **Phase 7 (Documentation)**: Depends on all verification phases complete

### User Story Dependencies

- **User Story 1 (Azure Identity)**: Can start after Prerequisites - No dependencies on other stories
- **User Story 2 (Claude Auth)**: Can start after Prerequisites - Independent of other stories
- **User Story 3 (GitHub CSI)**: Can start after Prerequisites - Independent of other stories
- **User Story 4 (NetworkPolicy)**: Can start after Prerequisites - Independent of other stories
- **User Story 5 (HTTP Health)**: Can start after Prerequisites - Independent of other stories

### Parallel Opportunities

All verification tasks marked [P] can run in parallel:
- T002 and T003 (prerequisites)
- T039a and T039b (GitHub CSI checks)
- T040a and T040b (NetworkPolicy checks)

User stories can also be executed in parallel since they test independent subsystems.

---

## Parallel Example: Phase 1 Prerequisites

```bash
# Launch all prerequisite checks together:
kubectl config current-context  # T001
kubectl get namespace claude-agent  # T002
kubectl get pods -n claude-agent -l app=claude-code-agent  # T003
```

## Parallel Example: User Story 3 and 4

```bash
# GitHub CSI and NetworkPolicy can run in parallel:
kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /secrets/github/  # T039a
kubectl exec -n claude-agent deploy/claude-code-agent -- cat /secrets/github/app-id  # T039b
kubectl get networkpolicy -n claude-agent  # T040a
kubectl exec -n claude-agent deploy/claude-code-agent -- getent hosts iiusagentstore.blob.core.windows.net  # T040b
```

---

## Implementation Strategy

### Quick Verification (All Tests)

1. Complete Phase 1: Prerequisites (< 1 minute)
2. Execute Phases 2-6: All verification tests (< 5 minutes total)
3. Complete Phase 7: Documentation

### Selective Verification (Single Story)

If troubleshooting a specific subsystem:
1. Complete Phase 1: Prerequisites
2. Execute only the relevant user story phase
3. Use troubleshooting section in quickstart.md if failures occur

### Re-verification (After Fixes)

All tests are idempotent and non-destructive:
1. Re-execute any failed test after applying fixes
2. No cleanup required between runs
3. Tests can be run repeatedly without side effects

---

## Exit Codes

Per data-model.md and contracts/verification-tests.yaml:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | All tests passed | Proceed to Sprint 7 |
| 1 | One or more tests failed | Review failures, troubleshoot |
| 2 | Test execution error | Check pod status, kubectl access |

---

## Notes

- All commands are documented in quickstart.md with expected outputs
- Each test has a defined timeout (10-60 seconds)
- Troubleshooting steps are provided for each failure mode
- Tests are read-only and do not modify system state
- Results should be recorded in the Verification Summary table

### Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T037, T037b | SC-001, SC-002 (Azure identity < 30s) |
| T038 | SC-001, SC-003 (Claude response < 60s) |
| T039a, T039b | SC-001, SC-004 (CSI secrets accessible) |
| T040a, T040b | SC-001, SC-005 (4 NetworkPolicies) |
| T041 | SC-001, SC-006 (Health < 1s) |
| T042, T043 | SC-007 (Outputs documented) |
| All tests | SC-008 (Re-runnable) |

---

## Verification Results Summary

**Executed**: 2026-01-15T15:49:00Z
**Overall Status**: ✅ ALL PASS (11/11 tests passed)

### Test Results

| Test | Step | Status | Notes |
|------|------|--------|-------|
| T001 | Prerequisites | ✅ PASS | kubectl context = dev-aks |
| T002 | Prerequisites | ✅ PASS | Namespace Active |
| T003 | Prerequisites | ✅ PASS | Pod Running (1/1) |
| T037 | 1.1 | ✅ PASS | Azure Workload Identity login (using federated token) |
| T037b | 1.2 | ✅ PASS | All 6 storage containers accessible |
| T038 | 2 | ✅ PASS | Claude responded: "Claude Max auth working" |
| T039a | 3.1 | ✅ PASS | GitHub secrets directory exists |
| T039b | 3.2 | ✅ PASS | App ID = 2658380 |
| T040a | 4.1 | ✅ PASS | 4 NetworkPolicies present |
| T040b | 4.2 | ✅ PASS | DNS resolution successful |
| T041 | 5 | ✅ PASS | Health endpoint healthy |

### Success Criteria Status

| Criteria | Status | Notes |
|----------|--------|-------|
| SC-001 | ✅ MET | All 5 verification tests pass |
| SC-002 | ✅ MET | Azure identity auth < 30 seconds |
| SC-003 | ✅ MET | Claude prompt response received |
| SC-004 | ✅ MET | CSI secrets accessible |
| SC-005 | ✅ MET | 4 NetworkPolicies confirmed |
| SC-006 | ✅ MET | Health endpoint < 1 second response |
| SC-007 | ✅ MET | All outputs documented |
| SC-008 | ✅ MET | Tests are re-runnable |

### Issues Found and Resolved

#### Issue #1: T038 - Claude CLI Read-Only Filesystem (RESOLVED)

**Symptom**: Claude CLI hangs indefinitely, times out after 90s

**Root Cause**:
- Deployment mounted `/home/claude-agent/.claude` as emptyDir (writable)
- Claude CLI v2.1.7 also writes to `/home/claude-agent/.claude.json` (parent directory)
- Parent directory was read-only due to `readOnlyRootFilesystem: true`
- Server files in `/home/claude-agent/` were hidden by emptyDir mount

**Fix Applied**:
1. Updated Dockerfile (v4.6.3): Moved server files to `/opt/claude-agent/`
2. Updated deployment: Mount `/home/claude-agent` as emptyDir (entire home directory)
3. Updated ENTRYPOINT to `/opt/claude-agent/server.js`

#### Issue #2: T037 - Azure Login Command Correction (DOCUMENTED)

**Symptom**: `az login --identity` times out connecting to IMDS (169.254.169.254)

**Root Cause**:
- `az login --identity` uses Instance Metadata Service (IMDS)
- Azure Workload Identity uses federated tokens, not IMDS

**Workaround** (documented in quickstart.md):
```bash
az login --service-principal -u $AZURE_CLIENT_ID -t $AZURE_TENANT_ID \
  --federated-token "$(cat $AZURE_FEDERATED_TOKEN_FILE)" --allow-no-subscriptions
```

### Sprint 6 Complete

All verification tests pass. Ready for Sprint 7: Teams Prompting.
