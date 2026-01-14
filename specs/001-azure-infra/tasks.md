# Tasks: Azure Infrastructure Foundation

**Input**: Design documents from `/specs/001-azure-infra/`
**Runbook**: `quickstart.md` (contains all CLI commands)
**Branch**: `001-azure-infra`

**Approach**: Execute Azure CLI commands directly following quickstart.md steps. No wrapper scripts needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify prerequisites and set environment variables

- [x] T001 Verify Azure CLI authenticated (`az account show`)
- [x] T002 Verify kubectl context set to dev-aks
- [x] T003 Verify AKS OIDC issuer enabled
- [x] T004 Set all environment variables (quickstart.md Step 1)

**Checkpoint**: Prerequisites verified, environment ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create core Azure resources required by all user stories

**CRITICAL**: No user story verification can succeed until this phase is complete

- [x] T005 Create storage account `iiusagentstore` with security settings (Step 2)
  - `--allow-blob-public-access false`
  - `--https-only true`
  - `--min-tls-version TLS1_2`
  - `--default-action Deny`
- [x] T006 Verify storage account creation succeeded
- [x] T007 Create 6 blob containers (Step 3)
  - agent-state, agent-spec, agent-plan, agent-verification, agent-review, agent-release
- [x] T008 Verify all containers created
- [x] T009 Create managed identity `claude-agent-identity` (Step 4)
- [x] T010 Capture and save CLIENT_ID and OBJECT_ID outputs

**Checkpoint**: Storage account, containers, and identity exist

---

## Phase 3: User Story 1 - Secure Storage Access (Priority: P1)

**Goal**: Enable agent pods to authenticate and access storage using Workload Identity

**Independent Test**: Verify role assignments exist with correct scopes

### Implementation

- [x] T011 [US1] Get storage account resource ID (Step 5)
- [x] T012 [US1] Get Key Vault resource ID (Step 5)
- [x] T013 [US1] Assign Storage Blob Data Contributor role to identity (Step 5)
  - Scope: Storage account (not resource group)
- [x] T014 [US1] Assign Key Vault Secrets User role to identity (Step 5)
  - Scope: Key Vault (not resource group)
- [x] T015 [US1] Verify role assignments with `az role assignment list`
- [x] T016 [US1] Create federated credential `claude-agent-fed-cred` (Step 6)
  - Subject: `system:serviceaccount:claude-agent:claude-agent-sa`
- [x] T017 [US1] Verify federated credential created

**Checkpoint**: Identity has RBAC permissions and federated credential for K8s binding

---

## Phase 4: User Story 2 - Network-Isolated Storage (Priority: P2)

**Goal**: Restrict storage access to authorized networks only

**Independent Test**: Verify network rules show default-deny with AKS subnet allowed

### Implementation

- [x] T018 [US2] Get AKS subnet ID (Step 8)
- [x] T019 [US2] Add AKS subnet to storage network rules (Step 8)
- [x] T020 [US2] Enable Azure services bypass (Step 8)
- [x] T021 [US2] Verify network rules configuration
  - DefaultAction: Deny
  - Bypass: AzureServices
  - VirtualNetworkRules includes AKS subnet

**Checkpoint**: Storage is network-isolated with explicit AKS subnet access

---

## Phase 5: User Story 3 - Secrets Access from Key Vault (Priority: P3)

**Goal**: Enable CSI Driver for Key Vault secret mounting

**Independent Test**: Verify CSI driver pods are running in kube-system

### Implementation

- [x] T022 [US3] Enable Secrets Store CSI Driver add-on (Step 7)
- [x] T023 [US3] Verify CSI driver pods running
- [x] T024 [US3] Verify provider-azure pods running

**Checkpoint**: CSI Driver enabled and healthy

---

## Phase 6: Verification

**Purpose**: Run all verification tests from quickstart.md

- [x] T025 [P] Test 1: Storage account hardening (TLS, public access, default deny)
- [x] T026 [P] Test 2: Identity configuration (federated credential subject)
- [x] T027 [P] Test 3: CSI driver health (driver and provider pods)
- [x] T028 Document outputs: Save CLIENT_ID for Kubernetes deployment phase

**Checkpoint**: All success criteria verified

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1: RBAC)
                                        → Phase 4 (US2: Network)
                                        → Phase 5 (US3: CSI)
                                        → Phase 6 (Verification)
```

### Task Dependencies

| Task | Depends On |
|------|------------|
| T005-T010 | T004 (env vars set) |
| T011-T017 | T009-T010 (identity exists) |
| T018-T021 | T005-T006 (storage exists) |
| T022-T024 | T004 (env vars set) |
| T025-T028 | All implementation tasks |

### Parallel Opportunities

- T011, T012 can run in parallel (get resource IDs)
- T013, T014 can run in parallel (role assignments)
- T018-T021 can run in parallel with T022-T024 (US2 and US3 independent)
- T025, T026, T027 can run in parallel (verification tests)

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T005-T006 | SC-002: Storage blocks unauthorized requests |
| T007-T008 | SC-003: All 6 containers created |
| T013-T015 | SC-004: Exactly required permissions at correct scopes |
| T016-T017 | SC-005: Federated credential works on first deployment |
| T018-T021 | SC-002: Network isolation enforced |
| T022-T024 | SC-006: CSI driver ready within 5 minutes |
| T025-T028 | SC-007: Reproducible from documented commands |

---

## Notes

- All commands are in `quickstart.md` - reference step numbers
- Save CLIENT_ID output from T010 - required for Sprint 5 (Kubernetes)
- Commands are idempotent - safe to re-run if needed
- If AKS subnet is null (kubenet), T019 will require manual network config

---

## Deferred Requirements

| Requirement | Deferred To | Rationale |
|-------------|-------------|-----------|
| FR-012 (Teams notifications) | Sprint 7 | Requires n8n workflow configuration (out of scope for infrastructure sprint) |
| SC-001 (30s auth validation) | Sprint 5 | Requires pod deployment with service account |
| SC-008 (15min recreate test) | Optional | Can be validated manually if desired |

---

## Implementation Complete

**Date**: 2026-01-14
**Status**: All 28 tasks completed successfully

### Documented Outputs (T028)

Save these values for Sprint 5 (Kubernetes Deployment):

```json
{
  "ManagedIdentity": {
    "Name": "claude-agent-identity",
    "ClientID": "866b8e62-d9ce-42d1-a6b0-4382baf39f7a",
    "PrincipalID": "a09d768c-6075-46ff-b1fc-49202969bdb2",
    "TenantID": "953922e6-5370-4a01-a3d5-773a30df726b"
  },
  "FederatedCredential": {
    "Name": "claude-agent-fed-cred",
    "Subject": "system:serviceaccount:claude-agent:claude-agent-sa",
    "Issuer": "https://southcentralus.oic.prod-aks.azure.com/953922e6-5370-4a01-a3d5-773a30df726b/c441c110-692f-4e55-a988-95d4f43a7d88/"
  },
  "StorageAccount": {
    "Name": "iiusagentstore",
    "ResourceGroup": "rg_prod"
  }
}
```

### Verification Results

| Test | Result | Details |
|------|--------|---------|
| T025: Storage Hardening | PASS | publicAccess=false, httpsOnly=true, minTlsVersion=TLS1_2, defaultAction=Deny |
| T026: Identity Config | PASS | Federated credential subject matches K8s service account |
| T027: CSI Health | PASS | 6 driver pods Running, 6 provider-azure pods Running |

### Implementation Notes

- Used `az rest` API for role assignments (worked around `az role assignment create` MissingSubscription error)
- Added Microsoft.Storage service endpoint to subnet before adding network rules
- Used `az aks command invoke` for kubectl commands (private AKS cluster)
