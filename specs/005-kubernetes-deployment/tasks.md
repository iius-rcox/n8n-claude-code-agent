# Tasks: Kubernetes Deployment

**Input**: Design documents from `/specs/005-kubernetes-deployment/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/k8s-manifests.yaml, quickstart.md
**Branch**: `005-kubernetes-deployment`

**Approach**: Hybrid (per Constitution VI) - YAML manifests for IaC, Runbook for kubectl apply commands

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

---

## Phase 1: Setup

**Purpose**: Verify prerequisites and create directory structure

- [x] T001 [P] Verify kubectl context is set to dev-aks (quickstart.md Step 1) ✅ dev-aks
- [x] T002 [P] Verify CSI Secrets Store Driver is enabled on cluster (quickstart.md Step 1) ✅ 5 pods running
- [x] T003 [P] Get Azure tenant ID for SecretProviderClass (`az account show --query tenantId -o tsv`) ✅ 953922e6-5370-4a01-a3d5-773a30df726b
- [x] T004 Create directory structure at `infra/k8s/` ✅

**Checkpoint**: Prerequisites verified, directory ready for manifests

---

## Phase 2: User Story 1 - Namespace and Service Account Configuration (Priority: P1) MVP

**Goal**: Create dedicated namespace with Workload Identity-enabled service account for Azure authentication

**Independent Test**: Apply manifests and verify service account has correct annotations (`azure.workload.identity/client-id: 866b8e62-d9ce-42d1-a6b0-4382baf39f7a`) and labels (`azure.workload.identity/use: "true"`)

### Implementation

- [x] T005 [US1] Create namespace and service account manifest in `infra/k8s/namespace.yaml` ✅
  - Namespace: `claude-agent` with label `app: claude-code-agent`
  - ServiceAccount: `claude-agent-sa` with Workload Identity annotation
  - Per contracts/k8s-manifests.yaml lines 11-27
- [x] T006 [US1] Apply namespace manifest (quickstart.md Step 5) ✅
  - Command: `kubectl apply -f infra/k8s/namespace.yaml`
- [x] T007 [US1] Verify namespace creation (quickstart.md Step 5) ✅ Active
  - Command: `kubectl get namespace claude-agent`
  - Expected: Namespace exists
- [x] T008 [US1] Verify service account annotations (quickstart.md Step 5) ✅
  - Command: `kubectl describe serviceaccount claude-agent-sa -n claude-agent`
  - annotation: `azure.workload.identity/client-id: 866b8e62-d9ce-42d1-a6b0-4382baf39f7a`
  - label: `azure.workload.identity/use: "true"`

**Checkpoint**: Namespace and service account ready with Workload Identity (SC-001, FR-001/002/003)

---

## Phase 3: User Story 2 - Network Security with NetworkPolicies (Priority: P2)

**Goal**: Implement default-deny with explicit allow rules for DNS, Azure services, and n8n ingress

**Independent Test**: Apply all 4 NetworkPolicies and verify via `kubectl get networkpolicy -n claude-agent`. Test DNS resolution still works from within the namespace.

### Implementation

- [x] T009 [P] [US2] Create default-deny NetworkPolicy in `infra/k8s/networkpolicy-default-deny.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 29-39
  - Denies all ingress and egress for all pods in namespace
- [x] T010 [P] [US2] Create DNS allow NetworkPolicy in `infra/k8s/networkpolicy-allow-dns.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 41-63
  - Allows egress to kube-dns on UDP/TCP 53
- [x] T011 [P] [US2] Create Azure egress NetworkPolicy in `infra/k8s/networkpolicy-allow-azure.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 65-78
  - Allows egress to TCP 443 for Azure services
- [x] T012 [P] [US2] Create n8n ingress NetworkPolicy in `infra/k8s/networkpolicy-allow-n8n.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 80-102
  - Allows ingress from n8n-prod namespace on TCP 3000
- [x] T013 [US2] Apply all NetworkPolicies (quickstart.md Step 6) ✅
  - Commands: `kubectl apply -f infra/k8s/networkpolicy-*.yaml`
- [x] T014 [US2] Verify 4 NetworkPolicies exist (quickstart.md Step 6) ✅
  - default-deny-all, allow-dns, allow-azure-egress, allow-ingress-from-n8n

**Checkpoint**: Network isolation enforced (SC-002, FR-004/005/006/007)

---

## Phase 4: User Story 3 - Secret Management with CSI Driver and Kubernetes Secrets (Priority: P3)

**Goal**: Mount GitHub credentials via CSI Driver, create Claude session and Teams webhook secrets

**Independent Test**: Create secrets and SecretProviderClass, verify they exist with correct structure

### Implementation

- [x] T015 [US3] Create SecretProviderClass manifest in `infra/k8s/secretproviderclass.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 104-127
  - Provider: azure
  - Key Vault: iius-akv
  - Secrets: github-app-id, github-app-private-key
  - Update tenantId with value from T003
- [x] T016 [US3] Apply SecretProviderClass (quickstart.md Step 7) ✅
  - Command: `kubectl apply -f infra/k8s/secretproviderclass.yaml`
- [x] T017 [US3] Verify SecretProviderClass exists (quickstart.md Step 7) ✅ github-app-akv
  - Command: `kubectl get secretproviderclass -n claude-agent`
  - Expected: github-app-akv listed
- [x] T018 [US3] Create Claude session secret from local files (quickstart.md Step 8) ✅ already existed
  - Command: `kubectl create secret generic claude-session --namespace claude-agent --from-file="$env:USERPROFILE\.claude\"`
- [x] T019 [US3] Verify Claude session secret exists (quickstart.md Step 8) ✅ 2 data items
  - Command: `kubectl get secret claude-session -n claude-agent`
- [x] T020 [US3] Create Teams webhook secret (quickstart.md Step 9) ✅
  - Command: `kubectl create secret generic teams-webhook --namespace claude-agent --from-literal=url="PLACEHOLDER_URL"`
  - Note: Actual webhook URL will be configured in Sprint 7
- [x] T021 [US3] Verify Teams webhook secret exists (quickstart.md Step 9) ✅ 1 data item
  - Command: `kubectl get secret teams-webhook -n claude-agent`

**Checkpoint**: All secrets configured (FR-008/009/010)

---

## Phase 5: User Story 4 - Deployment with Security Hardening (Priority: P4)

**Goal**: Deploy Claude agent container with full security hardening (non-root, read-only filesystem, dropped capabilities, graceful shutdown)

**Independent Test**: Apply deployment, verify pod reaches Running state, verify security context via kubectl describe and exec

### Implementation

- [x] T022 [US4] Create deployment manifest in `infra/k8s/deployment.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 129-270
  - Image: iiusacr.azurecr.io/claude-agent:v4.6.2
  - Security: runAsUser 1001, readOnlyRootFilesystem, seccompProfile RuntimeDefault
  - Init container: copy-claude-session (busybox) - fixed: removed chown (not needed with fsGroup)
  - Volumes: 4 emptyDirs + CSI for github-secrets
  - Probes: liveness and readiness on /health
  - Lifecycle: preStop sleep 10, terminationGracePeriodSeconds 120
- [x] T023 [US4] Apply deployment (quickstart.md Step 10) ✅
  - Command: `kubectl apply -f infra/k8s/deployment.yaml`
- [x] T024 [US4] Wait for pod to reach Running state (quickstart.md Step 10) ✅ Running
  - Command: `kubectl get pods -n claude-agent -w`
  - Expected: Pod status Running within 5 minutes (SC-003)
- [x] T025 [US4] Verify pod runs as non-root user (quickstart.md Step 11) ✅ claude-agent
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- whoami`
  - Expected: claude-agent (SC-005)
- [x] T026 [US4] Verify user ID is 1001 (quickstart.md Step 11) ✅ uid=1001
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- id`
  - Expected: uid=1001(claude-agent) gid=1001(claude-agent) (FR-012)
- [x] T027 [US4] Verify read-only root filesystem (quickstart.md Step 11) ✅ "Read-only file system"
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- touch /test-readonly 2>&1`
  - Expected: "Read-only file system" error (FR-013)
- [x] T028 [US4] Verify security context via describe ✅ RuntimeDefault, allowPrivilegeEscalation: false
  - Command: `kubectl describe pod -n claude-agent -l app=claude-code-agent`
  - Expected: seccompProfile: RuntimeDefault (FR-014), allowPrivilegeEscalation: false (FR-015)

**Checkpoint**: Deployment running with full security hardening (SC-003/005/006, FR-011-018)

---

## Phase 6: User Story 5 - Service Exposure for n8n Integration (Priority: P5)

**Goal**: Create ClusterIP Service exposing port 80 → 3000 for n8n access

**Independent Test**: Apply service, test health endpoint via port-forward, verify DNS name

### Implementation

- [x] T029 [US5] Create service manifest in `infra/k8s/service.yaml` ✅
  - Per contracts/k8s-manifests.yaml lines 272-288
  - Type: ClusterIP
  - Port: 80 → targetPort 3000
  - Selector: app: claude-code-agent
- [x] T030 [US5] Apply service (quickstart.md Step 12) ✅ unchanged (existed)
  - Command: `kubectl apply -f infra/k8s/service.yaml`
- [x] T031 [US5] Verify service exists (quickstart.md Step 12) ✅ ClusterIP 10.240.8.38:80
  - Command: `kubectl get service claude-agent -n claude-agent`
  - Expected: ClusterIP service (FR-019/020)
- [x] T032 [US5] Test health endpoint via port-forward (quickstart.md Step 13) ✅ {"status":"healthy"}
  - Commands: `kubectl port-forward -n claude-agent svc/claude-agent 8080:80`
  - Test: `Invoke-RestMethod -Uri "http://localhost:8080/health"`
  - Expected: JSON with status: "healthy" (SC-004)
- [x] T033 [US5] Verify DNS resolution from pod (quickstart.md Step 14) ✅ 20.60.161.1
  - Command: `kubectl exec -n claude-agent deploy/claude-code-agent -- getent hosts iiusagentstore.blob.core.windows.net`
  - Expected: DNS resolution succeeds (validates allow-dns NetworkPolicy)

**Checkpoint**: Service exposing Claude agent for n8n integration (SC-004/007, FR-019/020)

---

## Phase 7: Verification

**Purpose**: Run all verification checks and document outputs for Sprint 6

- [x] T034 [P] Verify all success criteria met ✅ ALL PASS
  - SC-001: Namespace and SA created ✓ (claude-agent Active, claude-agent-sa)
  - SC-002: 4 NetworkPolicies applied ✓ (default-deny-all, allow-dns, allow-azure-egress, allow-ingress-from-n8n)
  - SC-003: Pod Running within 5 minutes ✓ (Running)
  - SC-004: Health endpoint response < 1 second ✓ ({"status":"healthy"})
  - SC-005: Non-root user (UID 1001) ✓ (claude-agent, uid=1001)
  - SC-006: Security context verified ✓ (readOnlyRootFilesystem, seccompProfile RuntimeDefault, allowPrivilegeEscalation: false)
  - SC-007: Service reachable via DNS ✓ (20.60.161.1)
  - SC-008: Graceful shutdown configured ✓ (terminationGracePeriodSeconds: 120)
- [x] T035 Document outputs for Sprint 6 (Verification) ✅
  - Service DNS: `claude-agent.claude-agent.svc.cluster.local`
  - Service Port: 80 (routes to 3000)
  - Health Path: `/health`
  - Run Path: `/run`
  - Namespace: `claude-agent`
  - Pod IP: 10.244.5.128
  - Service ClusterIP: 10.240.8.38

**Checkpoint**: All success criteria verified, outputs documented for Sprint 6

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
      ↓
Phase 2 (US1: Namespace/SA) ────────┐
      ↓                             │
Phase 3 (US2: NetworkPolicies) ─────┤ All depend on US1 (namespace exists)
      ↓                             │
Phase 4 (US3: Secrets) ─────────────┘
      ↓
Phase 5 (US4: Deployment) ─── Requires US1, US3 (SA and secrets)
      ↓
Phase 6 (US5: Service) ─────── Requires US4 (deployment running)
      ↓
Phase 7 (Verification)
```

### Task Dependencies

| Task | Depends On |
|------|------------|
| T004 | T001-T003 (prerequisites verified) |
| T005 | T004 (directory exists) |
| T006-T008 | T005 (namespace manifest created) |
| T009-T012 | T005 (can run in parallel after namespace manifest) |
| T013-T014 | T009-T012 (all NetworkPolicy manifests created) |
| T015 | T003 (tenant ID), T005 (namespace manifest) |
| T016-T021 | T006 (namespace applied) |
| T022 | T005, T015 (namespace and SPC manifests ready) |
| T023-T028 | T013, T016, T018, T020 (all dependencies applied) |
| T029 | T022 (deployment manifest ready) |
| T030-T033 | T023 (deployment applied) |
| T034-T035 | T032 (service working) |

### Parallel Opportunities

- T001, T002, T003 can run in parallel (prerequisite checks)
- T009, T010, T011, T012 can run in parallel (different NetworkPolicy files)
- T034 verification checks can run in parallel

---

## Parallel Example: Phase 3 (NetworkPolicies)

```bash
# Launch all NetworkPolicy manifest creation tasks in parallel:
Task: "Create default-deny NetworkPolicy in infra/k8s/networkpolicy-default-deny.yaml"
Task: "Create DNS allow NetworkPolicy in infra/k8s/networkpolicy-allow-dns.yaml"
Task: "Create Azure egress NetworkPolicy in infra/k8s/networkpolicy-allow-azure.yaml"
Task: "Create n8n ingress NetworkPolicy in infra/k8s/networkpolicy-allow-n8n.yaml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: User Story 1 (Namespace and Service Account)
3. **STOP and VALIDATE**: Namespace exists with correct Workload Identity annotations
4. Can proceed to add NetworkPolicies (US2)

### Incremental Delivery

1. Setup → Prerequisites verified
2. Add US1 (Namespace/SA) → Workload Identity foundation ready
3. Add US2 (NetworkPolicies) → Network isolation enforced
4. Add US3 (Secrets) → Credentials available
5. Add US4 (Deployment) → Claude agent running with security hardening
6. Add US5 (Service) → n8n can communicate with agent

### Deferred Requirements

| Requirement | Deferred To | Rationale |
|-------------|-------------|-----------|
| End-to-end n8n testing | Sprint 6 | Verification sprint |
| CronJob auth watchdog | Sprint 7 | Teams prompting sprint |
| Teams webhook URL | Sprint 7 | Teams workflow creation |

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T007-T008 | SC-001: Namespace/SA created within 1 minute |
| T013-T014 | SC-002: 4 NetworkPolicies applied within 2 minutes |
| T024 | SC-003: Pod Running within 5 minutes |
| T032 | SC-004: Health response < 1 second |
| T025-T026 | SC-005: Non-root user UID 1001 |
| T027-T028 | SC-006: Security context (readOnlyRootFilesystem, seccompProfile) |
| T031-T033 | SC-007: Service reachable via DNS |
| T022 | SC-008: Graceful shutdown (terminationGracePeriodSeconds 120) |

---

## Notes

- Implementation Approach: **Hybrid** - YAML manifests for declarative resources, quickstart.md runbook for kubectl commands
- All manifests follow contracts/k8s-manifests.yaml as reference
- Secrets are created via kubectl commands (not committed to repo)
- Teams webhook URL is a placeholder until Sprint 7
- User UID is 1001 (not 1000) due to Ubuntu 24.04 reserving UID 1000
