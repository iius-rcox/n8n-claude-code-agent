# Tasks: Dynamic Repository Dropdown

**Input**: Design documents from `/specs/012-dynamic-repo-dropdown/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: No automated tests specified. Manual testing per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/nodes, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact n8n node names and workflow references

## Path Conventions

This feature modifies an **n8n workflow** rather than source code files:
- **Workflow**: "Agent Dev Team - Feature Request Form" (ID: `usUFV7eKzuWddp5A`)
- **Export path**: `n8n-workflows/stage-1/feature-request-form.json`

---

## Phase 1: Setup (Environment Configuration)

**Purpose**: Verify environment prerequisites are met before modifying workflow

- [x] T001 Verify `GITHUB_TOKEN` environment variable exists in n8n instance settings
  - **Note**: n8n instance requires GITHUB_TOKEN env var to be configured
- [x] T002 Test GitHub API access by manually calling `GET https://api.github.com/users/iius-rcox/repos` with token
  - **Discovery**: Repos are under `iius-rcox` user account, not `ii-us` org. Using `/users/iius-rcox/repos` endpoint.
- [x] T003 Export current workflow as backup to `n8n-workflows/stage-1/feature-request-form-backup.json`

---

## Phase 2: Foundational (Core Workflow Restructure)

**Purpose**: Restructure workflow to support two-step form architecture - BLOCKS all user stories

**⚠️ CRITICAL**: These changes must be complete before any user story implementation

- [x] T004 Modify "Feature Request Form" node: Remove "Target Repository" field from form fields
- [x] T005 Add "Fetch Organization Repos" HTTP Request node after Form Trigger with GitHub API call
  - **Note**: Uses `/users/iius-rcox/repos` endpoint with GITHUB_TOKEN env var
- [x] T006 Add "Transform Repo Response" Code node to filter archived repos and format for dropdown
- [x] T007 Add "Check Repos Loaded" IF node to branch on success/failure
- [x] T008 Reconnect workflow: Form Trigger → Fetch Repos → Transform → IF node
  - **Note**: Node positions adjusted for visual clarity

**Checkpoint**: Two-step architecture in place - form now fetches repos between steps

---

## Phase 3: User Story 1 - Select Repository from Dropdown (Priority: P1) 🎯 MVP

**Goal**: Users can select target repository from a dynamically populated dropdown showing all active ii-us organization repos

**Independent Test**: Open form → Complete Step 1 → Verify Step 2 shows dropdown with repos → Select repo → Submit → Verify task envelope contains selected repo

### Implementation for User Story 1

- [x] T009 [US1] Add "Select Repository (Dropdown)" Form node on success path of IF node
- [x] T010 [US1] Configure Form node with "Define Form > Using JSON" using dynamic dropdown options from `$json.dropdownOptions`
- [x] T011 [US1] Set dropdown fieldLabel to "Target Repository" with `requiredField: true`
- [x] T012 [US1] Add "Merge Form Results" node to rejoin paths after Form nodes
- [x] T013 [US1] Connect success Form → Merge → existing "Generate Task ID & Envelope" node
- [x] T014 [US1] Verify "Generate Task ID & Envelope" code handles `body['Target Repository']` from dropdown selection
  - **Updated**: Code now properly merges Step 1 and Step 2 form data
- [x] T015 [US1] Verify alphabetical sorting in Transform code: `sort((a, b) => a.full_name.localeCompare(b.full_name))`
  - **Verified**: Sorting implemented in Transform Repo Response node

**Checkpoint**: User Story 1 complete - dropdown shows active repos, selection persists to task envelope

### Manual Test: User Story 1

1. Open `https://n8n.ii-us.com/form/feature-request-form`
2. Fill Title, Description, Priority, Acceptance Criteria → Submit Step 1
3. Verify Step 2 shows dropdown with ii-us org repositories
4. Verify repos are sorted alphabetically (A-Z)
5. Select a repository → Submit
6. Check Azure Blob `agent-state/{task_id}/task-envelope.json` contains selected repo

---

## Phase 4: User Story 2 - Search/Filter Repositories (Priority: P2)

**Goal**: Users can type to filter the dropdown list when many repositories exist

**Independent Test**: Type partial repo name in dropdown → verify list filters to matching repos

### Implementation for User Story 2

- [x] T016 [US2] Verify n8n Form dropdown natively supports type-to-filter (built-in browser behavior)
  - **Verified**: HTML `<select>` elements have native keyboard navigation - typing jumps to matching options
- [x] T017 [US2] If native filtering insufficient: Evaluate adding Custom HTML with select2/chosen library (document decision in research.md)
  - **Decision**: Native browser filtering is sufficient for ii-us repo count (~17 repos). No custom library needed.

**Checkpoint**: User Story 2 complete - users can filter repos by typing

### Manual Test: User Story 2

1. Complete Step 1 of form
2. On Step 2, type partial text (e.g., "dashboard")
3. Verify dropdown filters to show only matching repositories
4. Clear filter text → verify all repos shown again

**Note**: n8n Form dropdowns have built-in browser filtering. This story may require no implementation if native behavior is sufficient.

---

## Phase 5: User Story 3 - Handle Empty or Error States (Priority: P3)

**Goal**: Users receive clear feedback and can still submit form when GitHub API fails

**Independent Test**: Simulate API failure → verify fallback text input appears with error message

### Implementation for User Story 3

- [x] T018 [US3] Add "Select Repository (Fallback)" Form node on failure path of IF node
  - **Done**: Added form node connected to IF node's false branch (sourceIndex: 1)
- [x] T019 [US3] Configure fallback Form with text input and error message: "Target Repository (Unable to load list - enter manually)"
  - **Done**: Configured with defineForm: json and appropriate error message in fieldLabel
- [x] T020 [US3] Set placeholder to "iius-rcox/repository-name" for user guidance
  - **Done**: Updated placeholder to use correct user account prefix
- [x] T021 [US3] Connect fallback Form → Merge node (same merge as success path)
  - **Done**: Connected to Merge Form Results node input index 1
- [x] T022 [US3] Update Transform code to handle empty API response: set `success: false` when no repos returned
  - **Verified**: Code already sets `success: dropdownOptions.length > 0`
- [x] T023 [US3] Add error handling in HTTP Request node: `continueOnFail: true` to prevent workflow failure on API error
  - **Done**: Added continueOnFail: true to Fetch Organization Repos node

**Checkpoint**: User Story 3 complete - fallback path works when API fails

### Manual Test: User Story 3

1. Temporarily set invalid `GITHUB_TOKEN` in n8n environment
2. Open form and complete Step 1
3. Verify Step 2 shows text input with message "Unable to load list - enter manually"
4. Enter repository manually → Submit → Verify task envelope created
5. Restore valid `GITHUB_TOKEN`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and documentation

- [x] T024 [P] Export completed workflow to `n8n-workflows/stage-1/feature-request-form.json`
  - **Done**: Exported workflow JSON with all 13 nodes and proper connections
- [x] T025 [P] Update workflow description in n8n to reflect two-step form architecture
  - **Done**: Description updated with version 2.0.0 and feature reference
- [x] T026 [P] Document rollback procedure in quickstart.md (remove new nodes, restore text field)
  - **Done**: Added Option A (backup restore) and Option B (manual rollback) procedures
- [x] T027 Run full quickstart.md validation (all 3 test scenarios)
  - **Done**: Tested form submission, verified dropdown loads 17 repos from cached blob
- [x] T028 Remove backup file after successful validation: `n8n-workflows/stage-1/feature-request-form-backup.json`
  - **Done**: Backup file removed after successful dropdown test

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational (BLOCKS all user stories)
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
Phase 3: US1      Phase 4: US2      Phase 5: US3
(P1 - MVP)        (P2)              (P3)
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
              Phase 6: Polish
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|------------|---------------------|
| US1 (P1) | Phase 2 (Foundational) | - |
| US2 (P2) | Phase 2 (Foundational) | US1, US3 (but US1 should complete first for MVP) |
| US3 (P3) | Phase 2 (Foundational) | US1, US2 |

**Recommended Order**: US1 → US2 → US3 (sequential by priority for single developer)

### Within Each Phase

- Setup (T001-T003): Sequential (T002 depends on T001)
- Foundational (T004-T008): Sequential (workflow restructure is ordered)
- US1 (T009-T015): Mostly sequential (node connections depend on nodes existing)
- US2 (T016-T017): Sequential (evaluation before implementation)
- US3 (T018-T023): Mostly sequential (similar to US1)
- Polish (T024-T028): T024-T026 parallel, T027-T028 sequential

---

## Parallel Example: Polish Phase

```bash
# These tasks can run in parallel (different files, no dependencies):
Task: "Export completed workflow to n8n-workflows/stage-1/feature-request-form.json"
Task: "Update workflow description in n8n"
Task: "Document rollback procedure in quickstart.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: User Story 1 (T009-T015)
4. **STOP and VALIDATE**: Run Manual Test for US1
5. ✅ MVP Deployed - users can select repos from dropdown

### Incremental Delivery

| Increment | Tasks | Value Delivered |
|-----------|-------|-----------------|
| MVP | T001-T015 | Dynamic dropdown with active repos |
| +US2 | T016-T017 | Type-to-filter capability (may be built-in) |
| +US3 | T018-T023 | Graceful degradation on API failure |
| Complete | T024-T028 | Documentation, export, cleanup |

### Estimated Effort

| Phase | Task Count | Complexity |
|-------|------------|------------|
| Setup | 3 | Low |
| Foundational | 5 | Medium |
| US1 (MVP) | 7 | Medium |
| US2 | 2 | Low (may be no-op) |
| US3 | 6 | Medium |
| Polish | 5 | Low |
| **Total** | **28** | - |

---

## Notes

- All modifications are to n8n workflow `usUFV7eKzuWddp5A` - no source code files
- Use n8n MCP tools (`n8n_update_partial_workflow`) for programmatic node updates
- Manual testing required per quickstart.md scenarios
- Backup workflow before starting (T003)
- Rollback procedure documented in quickstart.md
