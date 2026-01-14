# Tasks: GitHub App Integration

**Input**: Design documents from `/specs/002-github-app/`
**Runbook**: `quickstart.md` (contains all step-by-step commands)
**Branch**: `002-github-app`

**Approach**: Execute manual GitHub UI steps and Azure CLI commands directly following quickstart.md. No wrapper scripts needed per Constitution VI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify prerequisites from Sprint 1

- [x] T001 Verify Azure CLI authenticated (`az account show`)
- [x] T002 Verify Key Vault `iius-akv` is accessible (`az keyvault show --name iius-akv`)
- [x] T003 Verify managed identity has Key Vault Secrets User role
- [x] T004 Verify GitHub organization admin access (can access https://github.com/organizations/ii-us/settings/apps)

**Checkpoint**: Prerequisites verified, ready to create GitHub App

---

## Phase 2: Foundational (GitHub App Creation)

**Purpose**: Create the GitHub App which is required by all user stories

**CRITICAL**: User Story 2 (Key Vault storage) and User Story 3 (CSI mounting) cannot proceed without the App and private key

- [x] T005 Create GitHub App `ii-us-claude-code-agent` in ii-us organization (quickstart.md Step 1)
  - Name: `ii-us-claude-code-agent`
  - Homepage: `https://github.com/ii-us/n8n-claude-code-agent`
  - Webhook: Disabled
- [x] T006 Configure GitHub App permissions (quickstart.md Step 1)
  - Contents: Read and write
  - Pull requests: Read and write
  - Issues: Read and write
  - Metadata: Read-only
- [x] T007 Save the App ID displayed after creation (App ID: 2658380)
- [x] T008 Generate private key for GitHub App (quickstart.md Step 2)
- [x] T009 Securely store downloaded private key file path

**Checkpoint**: GitHub App created with credentials ready for storage

---

## Phase 3: User Story 1 - Automated Repository Access (Priority: P1)

**Goal**: Install GitHub App on target repositories so agent can authenticate and access code

**Independent Test**: Verify App installation by checking repository settings shows the App

### Implementation

- [x] T010 [US1] Navigate to GitHub App installation page (quickstart.md Step 3)
- [x] T011 [US1] Select ii-us organization for installation
- [x] T012 [US1] Choose "Only select repositories" option
- [x] T013 [US1] Select `n8n-claude-code-agent` repository for installation
- [x] T014 [US1] Complete installation by clicking Install
- [x] T015 [US1] Verify App appears in repository settings → Integrations → GitHub Apps

**Checkpoint**: GitHub App installed and can authenticate to target repositories

---

## Phase 4: User Story 2 - Secure Credential Storage (Priority: P2)

**Goal**: Store GitHub App credentials in Azure Key Vault for secure, auditable access

**Independent Test**: Verify secrets exist in Key Vault and are accessible by managed identity

### Implementation

- [x] T016 [US2] Store App ID in Key Vault (quickstart.md Step 4)
  - Secret name: `github-app-id`
  - Command: `az keyvault secret set --vault-name iius-akv --name "github-app-id" --value "$APP_ID"`
- [x] T017 [US2] Verify App ID secret was created
  - Command: `az keyvault secret show --vault-name iius-akv --name "github-app-id" --query "value" -o tsv`
- [x] T018 [US2] Store private key in Key Vault (quickstart.md Step 5)
  - Secret name: `github-app-private-key`
  - Command: `az keyvault secret set --vault-name iius-akv --name "github-app-private-key" --file "$PRIVATE_KEY_PATH"`
- [x] T019 [US2] Verify private key secret was created
  - Command: `az keyvault secret show --vault-name iius-akv --name "github-app-private-key" --query "name" -o tsv`
- [x] T020 [US2] Securely delete local private key file (quickstart.md Step 6) ✅
  - Command: `Remove-Item -Path "c:\Users\rcox\n8n-claude-code-agent\ii-us-claude-code-agent.2026-01-14.private-key.pem" -Force`
  - Result: Deleted by user

**Checkpoint**: Credentials securely stored in Key Vault, local copies removed

---

## Phase 5: User Story 3 - Kubernetes CSI Driver Integration (Priority: P3)

**Goal**: Prepare configuration for CSI Driver mounting (actual SecretProviderClass created in Sprint 5)

**Independent Test**: Verify all values needed for SecretProviderClass are documented

**Note**: This user story prepares outputs but does not create K8s resources (that's Sprint 5)

### Implementation

- [x] T021 [US3] Document outputs for Sprint 5 SecretProviderClass configuration
  - App ID Secret Name: `github-app-id`
  - App ID Value: `2658380`
  - Private Key Secret Name: `github-app-private-key`
  - Key Vault Name: `iius-akv`
  - Tenant ID: `953922e6-5370-4a01-a3d5-723a30df726b`
  - GitHub App Name: `ii-us-claude-code-agent`

**Checkpoint**: CSI Driver configuration values documented for Sprint 5

---

## Phase 6: Verification

**Purpose**: Run all verification tests from quickstart.md

- [x] T022 [P] Test 1: List GitHub App secrets in Key Vault ✅
  - Command: `az keyvault secret list --vault-name iius-akv --query "[?starts_with(name, 'github-app')].name" -o tsv`
  - Expected: `github-app-id` and `github-app-private-key`
  - Result: PASSED
- [x] T023 [P] Test 2: Verify managed identity can access secrets ✅
  - Command: `az role assignment list --assignee $OBJECT_ID --scope /subscriptions/.../vaults/iius-akv`
  - Expected: `Key Vault Secrets User` role present
  - Result: PASSED
- [x] T024 [P] Test 3: Verify GitHub App installation in organization ✅
  - Navigate to: https://github.com/organizations/ii-us/settings/installations
  - Expected: `ii-us-claude-code-agent` listed with correct repositories
  - Result: PASSED (verified by user)

**Checkpoint**: All success criteria verified

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational: App Creation)
                      ↓
              T005-T009 complete
                      ↓
         ┌───────────┼───────────┐
         ↓           ↓           ↓
    Phase 3      Phase 4      Phase 5
    (US1:        (US2:        (US3:
    Install)     Storage)     CSI Prep)
         └───────────┼───────────┘
                     ↓
              Phase 6 (Verification)
```

### Task Dependencies

| Task | Depends On |
|------|------------|
| T005-T009 | T001-T004 (prerequisites verified) |
| T010-T015 | T005-T009 (App exists) |
| T016-T020 | T007-T009 (App ID and private key available) |
| T021 | T016-T019 (secrets stored) |
| T022-T024 | All implementation tasks |

### Parallel Opportunities

- T001, T002, T003, T004 can run in parallel (verification commands)
- T010-T015 can run in parallel with T016-T020 (US1 and US2 are independent after App creation)
- T022, T023, T024 can run in parallel (verification tests)

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T005-T009 | SC-002: App-based authentication (no PATs) |
| T010-T015 | SC-004: GitHub operations succeed without manual config |
| T016-T020 | SC-003: Credentials in exactly one location (Key Vault) |
| T016-T020 | SC-005: Credential access is auditable |
| T021 | SC-001: Credentials retrievable within 5 seconds (prep) |
| T022-T024 | SC-006: Tokens generated programmatically |

---

## Notes

- All commands are in `quickstart.md` - reference step numbers
- GitHub App creation requires manual UI steps (no CLI available)
- Private key file should be deleted immediately after Key Vault storage
- Save App ID immediately after creation - displayed only once on confirmation page
- SecretProviderClass creation is deferred to Sprint 5 (Kubernetes Deployment)

---

## Deferred Requirements

| Requirement | Deferred To | Rationale |
|-------------|-------------|-----------|
| SecretProviderClass creation | Sprint 5 | Requires Kubernetes namespace and pod deployment |
| Installation token generation test | Sprint 5 | Requires running pod with CSI-mounted credentials |
| SC-001 (5s retrieval) | Sprint 5 | Requires pod startup measurement |

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Create GitHub App
3. Complete Phase 3: Install App on repositories
4. Complete Phase 4: Store credentials in Key Vault
5. **STOP and VALIDATE**: Run Phase 6 verification tests
6. Phase 5 outputs documented for Sprint 5

### Incremental Delivery

1. Setup → App exists
2. Add US1 (Install) → Can authenticate to repos
3. Add US2 (Storage) → Credentials secure in Key Vault
4. Add US3 (CSI Prep) → Ready for Sprint 5 Kubernetes deployment
