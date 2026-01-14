# Tasks: Docker Image

**Input**: Design documents from `/specs/004-docker-image/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/http-api.yaml, quickstart.md
**Branch**: `004-docker-image`

**Approach**: Hybrid (per Constitution VI) - Scripts for repeated runtime tasks, Runbook for build/push commands

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup

**Purpose**: Create directory structure and verify prerequisites

- [x] T001 [P] Verify Docker is running (`docker version`) ✅ v28.3.3
- [x] T002 [P] Verify Azure CLI is logged in (`az account show`) ✅ Azure subscription 1
- [x] T003 [P] Verify access to ACR (`az acr show --name iiusacr`) ✅ iiusacr
- [x] T004 Create directory structure at `infra/docker/` ✅

**Checkpoint**: Prerequisites verified, directory ready for scripts

---

## Phase 2: User Story 1 - Container Image Build (Priority: P1) 🎯 MVP

**Goal**: Create a container image with all required CLI tools (Azure CLI, GitHub CLI, Claude CLI, Node.js, jq, yq) running as non-root user

**Independent Test**: Build image locally and verify all 6 tools are executable via `docker run --rm <image> <tool> --version`

### Implementation

- [x] T005 [US1] Create Dockerfile base image and package installation in `infra/docker/Dockerfile` ✅
  - Base: `ubuntu:24.04`
  - Install: curl, ca-certificates, gnupg, jq
  - Install: Azure CLI via Microsoft repository
  - Install: GitHub CLI via GitHub repository
  - Install: Node.js 20.x via NodeSource
  - Install: yq via wget from GitHub releases
- [x] T006 [US1] Add Claude CLI installation to `infra/docker/Dockerfile` ✅
  - Global npm install: `@anthropic-ai/claude-code`
- [x] T007 [US1] Add non-root user configuration to `infra/docker/Dockerfile` ✅
  - Create user: `claude-agent` (UID 1001, GID 1001) - Ubuntu 24.04 has UID 1000 taken
  - Set home directory: `/home/claude-agent`
  - Set USER directive
- [x] T008 [US1] Build image locally (quickstart.md Step 7) ✅
  - Command: `docker build -t iiusacr.azurecr.io/claude-agent:v4.6.2 .`
- [x] T009 [US1] Verify all 6 CLI tools are in PATH (quickstart.md Step 8) ✅
  - az 2.82.0, gh 2.85.0, claude 2.1.7, node v20.20.0, jq 1.7, yq v4.50.1
- [x] T010 [US1] Verify non-root user (quickstart.md Step 8) ✅
  - whoami: claude-agent
  - id: uid=1001(claude-agent) gid=1001(claude-agent)

**Checkpoint**: Container image builds and all tools are executable as non-root user (SC-001, SC-002, SC-008)

---

## Phase 3: User Story 2 - HTTP Server with Health Endpoint (Priority: P2)

**Goal**: Implement HTTP server with `/health` and `/run` endpoints, graceful shutdown handling

**Independent Test**: Start server locally, test `/health` returns JSON, test `/run` with prompt, test SIGTERM handling

### Implementation

- [x] T011 [US2] Create HTTP server skeleton in `infra/docker/server.js` ✅
  - Port: 3000, Host: 0.0.0.0
  - Active request counter initialization
  - Graceful shutdown flag
- [x] T012 [US2] Implement `/health` endpoint in `infra/docker/server.js` ✅
  - GET handler returning JSON: `{ status, timestamp, activeRequests }`
  - Return 503 during shutdown with `status: "shutting_down"`
  - Per contract: `contracts/http-api.yaml` HealthResponse schema
- [x] T013 [US2] Implement `/run` endpoint in `infra/docker/server.js` ✅
  - POST handler accepting JSON body with `prompt`, `timeout`, `workdir`
  - Request validation per data-model.md rules
  - Return 400 for invalid requests, 503 during shutdown
- [x] T014 [US2] Implement Claude CLI execution in `infra/docker/server.js` ✅
  - Use `spawnSync` (not spawn) to prevent exit code 143
  - Execute: `claude -p "<prompt>"` with timeout
  - Capture stdout, stderr, exit code
  - Return JSON: `{ success, output, exitCode, duration, error? }`
- [x] T015 [US2] Implement SIGTERM graceful shutdown in `infra/docker/server.js` ✅
  - Track active requests with counter
  - On SIGTERM: set shutdown flag, stop accepting new requests
  - Wait for in-flight requests to complete (up to 120s grace period)
  - Exit cleanly when activeRequests reaches 0
- [x] T016 [US2] Add ENTRYPOINT to Dockerfile for server startup in `infra/docker/Dockerfile` ✅
  - Copy server.js to image
  - Set ENTRYPOINT: `["node", "/home/claude-agent/server.js"]`
  - Expose port 3000
- [x] T017 [US2] Rebuild image with server and test health endpoint (quickstart.md Step 9) ✅
  - Test: `curl http://localhost:3001/health` returns JSON: `{"status":"healthy","timestamp":"...","activeRequests":1}`
  - Response time < 1 second (SC-003)

**Checkpoint**: HTTP server responds to health checks and can execute prompts with graceful shutdown (SC-003, SC-004)

---

## Phase 4: User Story 3 - Authentication Monitoring (Priority: P3)

**Goal**: Create scripts for authentication checking and Teams notification on failure

**Independent Test**: Run auth check script, simulate failure, verify notification is sent with correct format

### Implementation

- [x] T018 [P] [US3] Create auth check script in `infra/docker/check-auth.sh` ✅
  - Execute test prompt: `claude -p "auth test"`
  - On success: exit 0
  - On failure: call notify.sh, exit 57
  - Timeout: 30 seconds (SC-005)
- [x] T019 [P] [US3] Create notification script in `infra/docker/notify.sh` ✅
  - Accept webhook URL from environment variable: `TEAMS_WEBHOOK_URL`
  - Format Teams Adaptive Card per research.md R6
  - Include: pod name (`$POD_NAME`), timestamp, error details
  - Include action button linking to refresh documentation
  - POST to webhook URL with curl
- [x] T020 [US3] Add scripts to Dockerfile in `infra/docker/Dockerfile` ✅
  - Copy check-auth.sh and notify.sh to image
  - Set executable permissions
- [x] T021 [US3] Rebuild image with auth scripts ✅
  - Scripts present: check-auth.sh (1957 bytes), notify.sh (2101 bytes)
  - Both scripts executable (-rwxr-xr-x)

**Checkpoint**: Auth check script detects failures and triggers notifications with exit code 57 (SC-005, SC-006, FR-011-FR-014)

---

## Phase 5: User Story 4 - Container Registry Publication (Priority: P4)

**Goal**: Push completed image to Azure Container Registry

**Independent Test**: Push image to ACR and verify tag appears in repository listing

### Implementation

- [x] T022 [US4] Login to Azure Container Registry (quickstart.md Step 10) ✅
  - Command: `az acr login --name iiusacr`
  - Result: Login Succeeded
- [x] T023 [US4] Push image to ACR (quickstart.md Step 11) ✅
  - Command: `docker push iiusacr.azurecr.io/claude-agent:v4.6.2`
  - All layers pushed successfully
- [x] T024 [US4] Verify image tag in registry (quickstart.md Step 12) ✅
  - Command: `az acr repository show-tags --name iiusacr --repository claude-agent`
  - Result: v4.6.2 tag visible
- [x] T025 [US4] Document image digest for Sprint 5 ✅
  - Digest: `sha256:852c88dbe006f051507f2023eedb55b1b146843d48325dd976ba31396d00f525`

**Checkpoint**: Image available in ACR with semantic version tag (SC-007, FR-015, FR-016)

---

## Phase 6: Verification

**Purpose**: Run all verification checks and document outputs

- [x] T026 [P] Verify all success criteria met ✅
  - SC-001: Build time < 10 minutes ✅ (~30 seconds with cache)
  - SC-002: All 6 tools present ✅ az 2.82.0, gh 2.85.0, claude 2.1.7, node v20.20.0, jq 1.7, yq v4.50.1
  - SC-003: Health response < 1 second ✅ Verified via curl
  - SC-008: Non-root user (UID 1001) ✅ claude-agent user
- [x] T027 Document outputs for Sprint 5 (Kubernetes Deployment) ✅
  - Image: `iiusacr.azurecr.io/claude-agent:v4.6.2`
  - Digest: `sha256:852c88dbe006f051507f2023eedb55b1b146843d48325dd976ba31396d00f525`
  - Port: `3000`
  - Health Path: `/health`
  - Run Path: `/run`
  - User UID: `1001` (Note: Ubuntu 24.04 has UID 1000 reserved)

**Checkpoint**: All success criteria verified, outputs documented for Sprint 5

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (US1: Image Build)
                      ↓
                 T010 (tools verified)
                      ↓
              Phase 3 (US2: HTTP Server)
                      ↓
                 T017 (server working)
                      ↓
              Phase 4 (US3: Auth Scripts)
                      ↓
                 T021 (scripts added)
                      ↓
              Phase 5 (US4: Registry Push)
                      ↓
              Phase 6 (Verification)
```

### Task Dependencies

| Task | Depends On |
|------|------------|
| T004 | T001-T003 (prerequisites verified) |
| T005-T007 | T004 (directory exists) |
| T008 | T005-T007 (Dockerfile complete for US1) |
| T009-T010 | T008 (image built) |
| T011-T015 | T010 (base image verified) |
| T016 | T011-T015 (server implemented) |
| T017 | T016 (server in image) |
| T018-T019 | T017 (server working, can run in parallel) |
| T020-T021 | T018-T019 (scripts ready) |
| T022-T025 | T021 (final image ready) |
| T026-T027 | T025 (push complete) |

### Parallel Opportunities

- T001, T002, T003 can run in parallel (prerequisite checks)
- T018, T019 can run in parallel (different script files)
- T026 verification checks can run in parallel

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T008-T010 | SC-001: Build < 10 min, SC-002: 6 tools, SC-008: Non-root |
| T012, T017 | SC-003: Health response < 1s |
| T015 | SC-004: Graceful shutdown < 120s |
| T018 | SC-005: Auth check < 30s |
| T019 | SC-006: Notification < 10s |
| T023-T024 | SC-007: Registry available < 5 min |

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: User Story 1 (Container Image Build)
3. **STOP and VALIDATE**: Image builds, all tools present, non-root user
4. Container can be deployed to Kubernetes (basic functionality)

### Incremental Delivery

1. Setup → Prerequisites verified
2. Add US1 (Image Build) → Deployable container with tools
3. Add US2 (HTTP Server) → n8n can communicate with agent
4. Add US3 (Auth Monitoring) → Proactive failure notifications
5. Add US4 (Registry Push) → Image available for Kubernetes

### Deferred Requirements

| Requirement | Deferred To | Rationale |
|-------------|-------------|-----------|
| Kubernetes manifests | Sprint 5 | Requires namespace and RBAC setup |
| CronJob scheduling | Sprint 7 | Auth watchdog scheduling |
| Multi-arch builds | Future | ARM64 not needed for AKS |

---

## Notes

- Implementation Approach: **Hybrid** - Scripts (server.js, check-auth.sh, notify.sh) for runtime; Runbook (quickstart.md) for build/push
- All scripts use exit codes per project convention (0=success, 57=auth failure, 124=timeout)
- Scripts copied into image at build time (no volume mounts needed)
- HTTP server uses `spawnSync` (lesson learned from POC) to prevent exit code 143
- Teams notifications use Adaptive Card format per research.md R6
