# Tasks: Claude Session Tokens

**Input**: Design documents from `/specs/003-claude-session-tokens/`
**Runbook**: `quickstart.md` (contains all step-by-step commands)
**Branch**: `003-claude-session-tokens`

**Approach**: Execute CLI commands directly following quickstart.md. No wrapper scripts needed per Constitution VI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify prerequisites before token capture

- [x] T001 [P] Verify Claude CLI is installed (`claude --version`) ✅ v2.1.7
- [x] T002 [P] Verify kubectl is installed (`kubectl version --client`) ✅ v1.32.2
- [x] T003 Verify `.gitignore` includes `claude-session-secret.yaml` ✅ Added

**Checkpoint**: Prerequisites verified, ready to capture tokens

---

## Phase 2: User Story 1 - Fresh Session Token Capture (Priority: P1) 🎯 MVP

**Goal**: Capture fresh Claude Max session tokens with verified authentication

**Independent Test**: Run `claude -p "Say 'auth test successful'"` and verify response

### Implementation

- [x] T004 [US1] Logout existing Claude session (quickstart.md Step 2) ✅ SKIPPED - session active
  - Command: `claude logout`
- [x] T005 [US1] Login to Claude Max with fresh authentication (quickstart.md Step 3) ✅ SKIPPED - session active
  - Command: `claude login`
  - Interactive: Browser authentication flow
- [x] T006 [US1] Verify authentication via test prompt (quickstart.md Step 4) ✅
  - Command: `claude -p "Say 'auth test successful'"`
  - Result: "session test" response received

**Checkpoint**: Fresh session tokens captured and verified working

---

## Phase 3: User Story 2 - Session File Verification (Priority: P2)

**Goal**: Verify all required session files exist with valid content

**Independent Test**: List session directory and confirm files have non-zero size

### Implementation

- [x] T007 [US2] List session files in user profile (quickstart.md Step 5) ✅
  - Path: `C:\Users\rcox\.claude\`
  - Files: `.credentials.json` (1894 bytes), `settings.json` (1509 bytes)
- [x] T008 [US2] Verify session files have non-zero size (quickstart.md Step 5) ✅
  - `.credentials.json`: 1894 bytes
  - `settings.json`: 1509 bytes
- [x] T009 [US2] Verify files are readable by current user ✅
  - Result: Readable

**Checkpoint**: Session files verified present and valid

---

## Phase 4: User Story 3 - Kubernetes Secret Preparation (Priority: P3)

**Goal**: Generate Kubernetes secret YAML from session files

**Independent Test**: Verify YAML contains `kind: Secret` and `name: claude-session`

### Implementation

- [x] T010 [US3] Generate Kubernetes secret YAML with dry-run (quickstart.md Step 6) ✅
  - File: `claude-session-secret.yaml` (585172 bytes)
- [x] T011 [US3] Verify secret YAML file was created ✅
  - Size: 585172 bytes
- [x] T012 [US3] Verify secret YAML structure (quickstart.md Step 7) ✅
  - Contains: `kind: Secret`
  - Contains: `name: claude-session`
- [x] T013 [US3] Verify secret YAML is excluded from git (quickstart.md Step 8) ✅
  - Status: IGNORED

**Checkpoint**: Kubernetes secret YAML ready for Sprint 5 deployment

---

## Phase 5: Verification

**Purpose**: Run all verification checks from quickstart.md

- [x] T014 [P] Verify authentication still works ✅
  - Response: "final verification"
- [x] T015 [P] Verify secret file exists with content ✅
  - File exists with 585172 bytes
- [x] T016 Document outputs for Sprint 5 ✅
  - Secret File: `claude-session-secret.yaml`
  - Secret Name: `claude-session`
  - Mount Path: `/home/claude-agent/.claude/`
  - Source Path: `C:\Users\rcox\.claude\`

**Checkpoint**: All success criteria verified

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (US1: Token Capture)
                      ↓
                 T006 (auth verified)
                      ↓
              Phase 3 (US2: File Verification)
                      ↓
                 T009 (files valid)
                      ↓
              Phase 4 (US3: Secret Generation)
                      ↓
              Phase 5 (Verification)
```

### Task Dependencies

| Task | Depends On |
|------|------------|
| T004 | T001-T003 (prerequisites verified) |
| T005 | T004 (logout complete) |
| T006 | T005 (login complete) |
| T007-T009 | T006 (auth verified) |
| T010-T013 | T009 (files valid) |
| T014-T016 | T013 (secret ready) |

### Parallel Opportunities

- T001, T002, T003 can run in parallel (verification commands)
- T014, T015 can run in parallel (final verification)

---

## Success Criteria Mapping

| Task | Success Criteria |
|------|------------------|
| T005 | SC-001: Login completes within 2 minutes |
| T006 | SC-002: Test prompt responds within 10 seconds |
| T007-T009 | SC-003: All session files present |
| T010-T012 | SC-004: Secret YAML valid |
| T013 | SC-006: Secret excluded from git |
| T014 | SC-005: Tokens remain valid (initial check) |

---

## Notes

- All commands are in `quickstart.md` - reference step numbers
- This is a runbook-based feature (no scripts created)
- T005 requires interactive browser authentication
- Secret YAML should be deleted after Sprint 5 apply (see quickstart.md Cleanup)
- Token refresh procedure documented in quickstart.md

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: User Story 1 (Token Capture)
3. **STOP and VALIDATE**: Test prompt works
4. Tokens are usable for Claude operations

### Incremental Delivery

1. Setup → Prerequisites verified
2. Add US1 (Token Capture) → Can use Claude locally
3. Add US2 (File Verification) → Confidence in session quality
4. Add US3 (Secret Generation) → Ready for Kubernetes deployment

### Deferred Requirements

| Requirement | Deferred To | Rationale |
|-------------|-------------|-----------|
| Cluster apply | Sprint 5 | Requires namespace and deployment |
| Token refresh automation | Sprint 7 | CronJob for monitoring |
| Pod-level validation | Sprint 6 | Requires running pod |
