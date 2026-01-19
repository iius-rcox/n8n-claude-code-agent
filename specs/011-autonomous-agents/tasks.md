# Tasks: Autonomous Dev Team Agents - Production Ready

**Input**: Design documents from `/specs/011-autonomous-agents/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification. Implementation tasks focus on workflow creation and validation.

**Organization**: Tasks are grouped by implementation stage (matching plan.md) which maps to user stories from spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a multi-component project:
- **n8n Workflows**: `n8n-workflows/stage-{N}/` (JSON files)
- **JSON Schemas**: `schemas/` (validation schemas)
- **Agent Prompts**: `agent-prompts/` (system prompt templates)
- **Existing Infrastructure**: `infra/docker/`, `dashboard/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and foundational schemas

- [X] T001 Create n8n workflow directory structure per plan.md in `n8n-workflows/`
- [X] T002 [P] Create JSON schema for task envelope validation in `schemas/task-envelope.schema.json`
- [X] T003 [P] Create JSON schema for verification report in `schemas/verification-report.schema.json`
- [X] T004 [P] Create JSON schema for review feedback in `schemas/review-feedback.schema.json`
- [X] T005 [P] Create PM Agent system prompt template in `agent-prompts/pm-agent.md`
- [X] T006 [P] Create Dev Agent system prompt template in `agent-prompts/dev-agent.md`
- [X] T007 [P] Create QA Agent system prompt template in `agent-prompts/qa-agent.md`
- [X] T008 [P] Create Reviewer Agent system prompt template in `agent-prompts/reviewer-agent.md`
- [X] T009 Configure n8n environment variables for Azure, GitHub App, Teams in n8n Settings

**Checkpoint**: Directory structure created, schemas defined, agent prompts ready

---

## Phase 2: Foundational (Stage 1 - Core Infrastructure Workflows)

**Purpose**: Build the three foundational workflows that ALL agent workflows depend on

**CRITICAL**: No agent workflow (US2-US9) can function until these are complete

### Blob State Manager Sub-Workflow

- [X] T010 [P] Create Blob State Manager workflow shell in `n8n-workflows/stage-1/blob-state-manager.json`
- [X] T011 [P] Implement Azure token acquisition node using Workload Identity in Blob State Manager
- [X] T012 Implement blob create operation with task envelope schema validation
- [X] T013 Implement blob read operation with error handling (404, 500)
- [X] T014 Implement blob update operation with 60-second lease acquire/release per research.md
- [X] T015 Implement artifact upload operation for agent-spec container
- [X] T016 Implement artifact download operation with content-type handling
- [X] T017 Implement lease break operation for stuck tasks (admin recovery)
- [X] T018 Add Switch node for operation routing (create/read/update/upload/download/break_lease)
- [X] T019 Add Error Trigger node with standardized error response format per contracts/blob-state-api.yaml

### Agent Runner Sub-Workflow

- [X] T020 [P] Create Agent Runner workflow shell in `n8n-workflows/stage-1/agent-runner.json`
- [X] T021 Implement HTTP Request node to Claude Agent /run endpoint per research.md patterns
- [X] T022 Implement Switch node for exit code routing (0, 23, 57, 124, other) per contracts/agent-runner-api.yaml
- [X] T023 Implement retry logic for lease conflict (exit code 23) with 5-second wait
- [X] T024 Implement auth failure detection (exit code 57) with immediate return
- [X] T025 Implement timeout handling (exit code 124) with extended timeout retry option
- [X] T026 Implement response parsing for Claude output extraction
- [X] T027 Add agent role parameter for system prompt selection (pm/dev/qa/reviewer)

### Feature Request Form (Entry Point)

- [X] T028 [P] Create Feature Request Form workflow in `n8n-workflows/stage-1/feature-request-form.json`
- [X] T029 Configure n8n Form Trigger with required fields: title, description, priority, repository, acceptance_criteria
- [X] T030 Implement task ID generation node (format: FEAT-{YYYYMMDD}-{random6})
- [X] T031 Implement repository URL validation node
- [X] T032 Implement duplicate submission detection (same title+repo within 24 hours)
- [X] T033 Implement rate limiting check (5 submissions per hour per user)
- [X] T034 Implement sensitive data pattern scanning and redaction
- [X] T035 Implement task envelope creation using Blob State Manager sub-workflow
- [X] T036 Implement form success response with task ID display
- [X] T037 Implement validation error response for missing/invalid fields

**Checkpoint**: Foundation ready - Stage 1 workflows complete, can accept feature requests and store state

---

## Phase 3: User Story 1 - Submit Feature Request via Web Form (Priority: P1)

**Goal**: Users can submit feature requests and receive task IDs

**Independent Test**: Submit form at n8n URL, verify task envelope created in Azure Blob agent-state container

**Note**: Most of US1 is implemented in Phase 2 (Foundational). This phase adds integration and verification.

### Implementation for User Story 1

- [X] T038 [US1] Add notification trigger to Feature Request Form calling Notification Hub (task_created event)
- [X] T039 [US1] Verify form submission creates task envelope with all fields per data-model.md
- [X] T040 [US1] Verify duplicate detection returns warning with existing task ID
- [X] T041 [US1] Verify rate limiting returns appropriate error after 5 submissions
- [X] T042 [US1] Document form URL in quickstart.md and CLAUDE.md

**Checkpoint**: User Story 1 complete - Feature requests can be submitted and tracked

---

## Phase 4: User Story 2 - Automatic Specification Creation (Priority: P1)

**Goal**: PM Agent creates spec.md from feature requests

**Independent Test**: Submit well-defined feature request, verify spec.md created in agent-spec container in SpecKit format

### PM Intake Workflow (Stage 2)

- [X] T043 [P] [US2] Create PM Intake workflow shell in `n8n-workflows/stage-2/pm-intake.json`
- [X] T044 [US2] Implement Sub-Workflow Trigger accepting task_id and task_envelope
- [X] T045 [US2] Implement prompt builder using pm-agent.md template with /speckit.specify behavior
- [X] T046 [US2] Call Agent Runner sub-workflow with agent_role=pm
- [X] T047 [US2] Implement spec.md parsing from Claude output
- [X] T048 [US2] Implement needs_clarification detection from agent output
- [X] T049 [US2] Upload spec.md to agent-spec container via Blob State Manager
- [X] T050 [US2] Update task envelope phase to "planning" on success
- [X] T051 [US2] Return needs_human flag with questions array if clarification needed

### PM Planning Workflow (Stage 2)

- [X] T052 [P] [US2] Create PM Planning workflow shell in `n8n-workflows/stage-2/pm-planning.json`
- [X] T053 [US2] Download spec.md from agent-spec via Blob State Manager
- [X] T054 [US2] Implement prompt builder with /speckit.plan behavior
- [X] T055 [US2] Call Agent Runner and parse plan.md output
- [X] T056 [US2] Upload plan.md to agent-spec container

### PM Tasks Workflow (Stage 2)

- [X] T057 [P] [US2] Create PM Tasks workflow shell in `n8n-workflows/stage-2/pm-tasks.json`
- [X] T058 [US2] Download spec.md and plan.md from agent-spec
- [X] T059 [US2] Implement prompt builder with /speckit.tasks behavior
- [X] T060 [US2] Call Agent Runner and parse tasks.md output
- [X] T061 [US2] Upload tasks.md to agent-spec container
- [X] T062 [US2] Extract task count and update task envelope with total_tasks

**Checkpoint**: User Story 2 complete - PM Agent can create spec, plan, and tasks autonomously

---

## Phase 5: User Story 4 - GitHub Integration for Code Changes (Priority: P1)

**Goal**: Dev Agent creates branches, commits, and PRs via GitHub App

**Independent Test**: Trigger Dev Agent, verify PR created in target repository with correct branch naming

### GitHub Token Minting (Stage 3 prerequisite)

- [X] T063 [P] [US4] Create GitHub Token Manager sub-workflow in `n8n-workflows/stage-3/github-token-manager.json`
- [X] T064 [US4] Implement Azure Key Vault secret fetch for GitHub App credentials (app-id, private-key, installation-id)
- [X] T065 [US4] Implement JWT creation per research.md GitHub App Token Minting pattern
- [X] T066 [US4] Implement installation token exchange via GitHub API
- [X] T067 [US4] Implement token caching in agent-state/github-token-cache.yml
- [X] T068 [US4] Implement cache check and refresh logic (refresh if <5 min remaining)

### Dev Implementation Workflow (Stage 3)

- [X] T069 [P] [US4] Create Dev Implementation workflow shell in `n8n-workflows/stage-3/dev-implementation.json`
- [X] T070 [US4] Implement Sub-Workflow Trigger accepting task_id and current_task_number
- [X] T071 [US4] Download spec.md, plan.md, tasks.md via Blob State Manager
- [X] T072 [US4] Parse current task from tasks.md based on task_number
- [X] T073 [US4] Implement prompt builder using dev-agent.md template with /speckit.implement behavior
- [X] T074 [US4] Include context management: prioritize spec summary, plan summary, target files per research.md
- [X] T075 [US4] Call Agent Runner with agent_role=dev
- [X] T076 [US4] Parse PR URL and commit SHA from agent output
- [X] T077 [US4] Update task envelope with pr_url, branch name, commits array
- [X] T078 [US4] Handle GitHub API errors (rate limit, auth, protected branch) per spec.md edge cases

### Dev Release Workflow (Stage 3)

- [X] T079 [P] [US4] Create Dev Release workflow shell in `n8n-workflows/stage-3/dev-release.json`
- [X] T080 [US4] Implement Sub-Workflow Trigger accepting task_id and pr_url
- [X] T081 [US4] Build release prompt with merge instructions (squash merge, delete branch)
- [X] T082 [US4] Call Agent Runner with agent_role=dev
- [X] T083 [US4] Parse merge SHA from output
- [X] T084 [US4] Update task envelope status to "completed", phase to "release"
- [X] T085 [US4] Handle merge conflict detection and escalation

**Checkpoint**: User Story 4 complete - Dev Agent can implement code and create PRs ✅

---

## Phase 6: User Story 3 - End-to-End Task Completion (Priority: P1)

**Goal**: Master Orchestrator routes tasks through all 6 phases autonomously

**Independent Test**: Submit simple feature request, verify PR is merged and task status is "completed"

### Master Orchestrator Workflow (Stage 5)

- [X] T086 [P] [US3] Create Master Orchestrator workflow shell in `n8n-workflows/stage-5/master-orchestrator.json`
- [X] T087 [US3] Implement webhook trigger for task resume events
- [X] T088 [US3] Implement task envelope load via Blob State Manager
- [X] T089 [US3] Implement phase determination logic from task envelope
- [X] T090 [US3] Implement intake phase routing: Call PM Intake, check needs_clarification
- [X] T091 [US3] Implement planning phase routing: Call PM Planning, then PM Tasks
- [X] T092 [US3] Implement implementation phase routing: Loop through tasks calling Dev Implementation
- [X] T093 [US3] Implement verification phase routing: Call QA Verification (placeholder for now)
- [X] T094 [US3] Implement review phase routing: Call Reviewer (placeholder for now)
- [X] T095 [US3] Implement release phase routing: Call Dev Release
- [X] T096 [US3] Implement phase completion notification triggers
- [X] T097 [US3] Connect Feature Request Form success to Master Orchestrator via workflow call

**Checkpoint**: User Story 3 core flow complete - Tasks can flow through all phases (QA/Review placeholders) ✅

---

## Phase 7: User Story 5 - Quality Verification Before Merge (Priority: P2)

**Goal**: QA Agent verifies and Reviewer Agent reviews before merge

**Independent Test**: Provide PR with intentional failures, verify QA returns "request_changes"

### QA Verification Workflow (Stage 4)

- [X] T098 [P] [US5] Create QA Verification workflow shell in `n8n-workflows/stage-4/qa-verification.json`
- [X] T099 [US5] Implement Sub-Workflow Trigger accepting task_id and pr_url
- [X] T100 [US5] Download spec.md for acceptance criteria via Blob State Manager
- [X] T101 [US5] Implement prompt builder using qa-agent.md template
- [X] T102 [US5] Call Agent Runner with agent_role=qa
- [X] T103 [US5] Parse verification report from output (test_results, criteria_status, recommendation)
- [X] T104 [US5] Validate output against schemas/verification-report.schema.json
- [X] T105 [US5] Upload verification-report-{cycle}.yml to agent-verification container
- [X] T106 [US5] Implement flaky test detection: re-run on failure, compare results per spec.md FR-040 (deferred)
- [X] T107 [US5] Return passed flag and feedback for routing

### Reviewer Workflow (Stage 4)

- [X] T108 [P] [US5] Create Reviewer workflow shell in `n8n-workflows/stage-4/reviewer.json`
- [X] T109 [US5] Implement Sub-Workflow Trigger accepting task_id, pr_url, verification_status
- [X] T110 [US5] Download verification report from agent-verification
- [X] T111 [US5] Implement prompt builder using reviewer-agent.md template
- [X] T112 [US5] Call Agent Runner with agent_role=reviewer
- [X] T113 [US5] Parse review feedback (overall_assessment, comments, security_concerns)
- [X] T114 [US5] Validate output against schemas/review-feedback.schema.json
- [X] T115 [US5] Upload review-report-{cycle}.yml to agent-review container
- [X] T116 [US5] Implement critical security vulnerability detection and immediate escalation per spec.md FR-013
- [X] T117 [US5] Return approved flag and feedback for routing

### Update Master Orchestrator

- [X] T118 [US5] Update Master Orchestrator verification routing to call QA Verification workflow
- [X] T119 [US5] Update Master Orchestrator review routing to call Reviewer workflow
- [X] T120 [US5] Implement verification→review transition on QA approval
- [X] T121 [US5] Implement review→release transition on Reviewer approval

**Checkpoint**: User Story 5 complete - Quality gates enforce verification before merge ✅

---

## Phase 8: User Story 6 - Feedback Loops with Bounded Retries (Priority: P2)

**Goal**: Dev Agent receives feedback and fixes, with retry limits and escalation

**Independent Test**: Create task that fails QA 4 times, verify escalation after 3 attempts

### Feedback Router Workflow (Stage 4)

- [X] T122 [P] [US6] Create Feedback Router workflow shell in `n8n-workflows/stage-4/feedback-router.json`
- [X] T123 [US6] Implement Sub-Workflow Trigger accepting task_id, feedback_source (qa/reviewer), feedback
- [X] T124 [US6] Implement retry count retrieval from task envelope feedback_loops
- [X] T125 [US6] Implement max retry check (3 for QA, 2 for Review) per data-model.md
- [X] T126 [US6] Build feedback context prompt for Dev Agent with previous errors
- [X] T127 [US6] Increment cycle_count in task envelope via Blob State Manager
- [X] T128 [US6] Call Dev Implementation workflow with feedback context on retry
- [X] T129 [US6] Trigger Human Checkpoint workflow on max retries exceeded
- [X] T130 [US6] Record feedback attempt in feedback_loops.history per data-model.md

### Update Master Orchestrator

- [X] T131 [US6] Update Master Orchestrator to route QA failures to Feedback Router
- [X] T132 [US6] Update Master Orchestrator to route Review failures to Feedback Router
- [X] T133 [US6] Implement loop detection: verification→feedback→implementation→verification

**Checkpoint**: User Story 6 complete - Bounded retry loops with automatic escalation ✅

---

## Phase 9: User Story 7 - Human Checkpoint for Ambiguous Requests (Priority: P2)

**Goal**: Pause for human clarification when requirements are unclear

**Independent Test**: Submit vague feature request, verify Teams notification with questions

### Human Checkpoint Workflow (Stage 5)

- [X] T134 [P] [US7] Create Human Checkpoint workflow shell in `n8n-workflows/stage-5/human-checkpoint.json`
- [X] T135 [US7] Implement Sub-Workflow Trigger accepting task_id, reason, questions array
- [X] T136 [US7] Build Teams Adaptive Card with approval/reject buttons per research.md
- [X] T137 [US7] Implement HTTP Request to Teams webhook
- [X] T138 [US7] Update task envelope status to "escalated" via Blob State Manager
- [X] T139 [US7] Record escalation in task envelope escalations array per data-model.md
- [X] T140 [US7] Implement callback webhook for Teams button responses
- [X] T141 [US7] On approve: Update task envelope, trigger Master Orchestrator resume
- [X] T142 [US7] On reject: Update task envelope status to "cancelled"

### Notification Hub (Stage 5)

- [X] T143 [P] [US7] Create Notification Hub workflow shell in `n8n-workflows/stage-5/notification-hub.json`
- [X] T144 [US7] Implement event type routing: task_created, spec_ready, pr_created, completed, escalated
- [X] T145 [US7] Build appropriate Teams card for each event type
- [X] T146 [US7] Implement retry logic (3 attempts with exponential backoff) per spec.md FR-015
- [X] T147 [US7] Implement notification rate limiting and batching per spec.md FR-016
- [X] T148 [US7] Log notification failures for dashboard visibility

### Update PM Intake

- [X] T149 [US7] Update PM Intake to call Human Checkpoint when needs_clarification is true
- [X] T150 [US7] Pass specific questions from PM Agent to Human Checkpoint

**Checkpoint**: User Story 7 complete - Human checkpoints pause for clarification ✅

---

## Phase 10: User Story 8 - Authentication Failure Recovery (Priority: P2)

**Goal**: Pause all tasks on auth failure, resume after token refresh

**Independent Test**: Simulate exit code 57, verify all tasks pause and alert sent

### Circuit Breaker Implementation

- [X] T151 [P] [US8] Add circuit breaker state blob in agent-state/circuit-breaker.yml
- [X] T152 [US8] Update Agent Runner to check circuit breaker before execution
- [X] T153 [US8] Update Agent Runner to set circuit breaker OPEN on exit code 57
- [X] T154 [US8] Trigger Teams alert via Notification Hub on circuit breaker open
- [X] T155 [US8] Implement circuit breaker check in Master Orchestrator before phase execution

### Task Recovery Workflow (Stage 5)

- [X] T156 [P] [US8] Create Task Recovery workflow shell in `n8n-workflows/stage-5/task-recovery.json`
- [X] T157 [US8] Implement Cron trigger (every 15 minutes) for stuck task scan
- [X] T158 [US8] Scan agent-state for tasks stuck >2 hours per spec.md edge case
- [X] T159 [US8] Check circuit breaker status on recovery scan
- [X] T160 [US8] On circuit breaker CLOSED: Resume paused tasks via Master Orchestrator
- [X] T161 [US8] Send alert for tasks stuck despite closed circuit breaker

### Update Auth Watchdog Integration

- [X] T162 [US8] Update circuit breaker to CLOSED when auth watchdog succeeds
- [X] T163 [US8] Connect existing auth watchdog CronJob to circuit breaker blob

**Checkpoint**: User Story 8 complete - Auth failures handled with automatic recovery ✅

---

## Phase 11: User Story 9 - Observability and Progress Tracking (Priority: P3)

**Goal**: Dashboard shows real-time task pipeline status

**Independent Test**: Submit task, verify dashboard shows progress through phases

### Dashboard Backend Extensions

- [x] T164 [P] [US9] Add pipeline endpoint in `dashboard/backend/src/api/routes/pipeline.ts`
- [x] T165 [US9] Implement Azure Blob list for agent-state container to get all task envelopes
- [x] T166 [US9] Implement task detail endpoint with phase history
- [x] T167 [US9] Implement error history endpoint from task envelope errors array
- [x] T168 [US9] Add WebSocket support for real-time task updates

### Dashboard Frontend Extensions

- [x] T169 [P] [US9] Create PipelinePanel component in `dashboard/frontend/src/components/PipelinePanel.tsx` (implemented as pipeline-board.tsx)
- [x] T170 [US9] Display task list with status, phase, last activity time
- [x] T171 [US9] Implement task detail view with error history
- [x] T172 [US9] Add task cancellation button calling cancel endpoint
- [x] T173 [US9] Implement real-time updates via WebSocket subscription
- [x] T174 [US9] Add phase progress visualization (6-step pipeline indicator)

### Task Cancellation

- [x] T175 [US9] Add cancel endpoint in `dashboard/backend/src/api/routes/pipeline.ts`
- [x] T176 [US9] Implement task cancellation in Blob State Manager (update status to "cancelled")
- [ ] T177 [US9] Stop in-progress workflows on cancellation (deferred: workflows check task status at checkpoints)

**Checkpoint**: User Story 9 complete - Full observability via dashboard

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Production hardening, documentation, and validation

### Input Validation & Security

- [ ] T178 [P] Add prompt injection guards to all agent prompts per spec.md FR-031
- [ ] T179 [P] Add repository URL validation regex to Feature Request Form
- [ ] T180 Implement sensitive data pattern detection (API keys, passwords) in Feature Request Form

### Error Handling Improvements

- [ ] T181 [P] Add schema validation for all agent outputs before phase transitions
- [ ] T182 [P] Add retry with explicit format instructions on schema validation failure per spec.md FR-038
- [ ] T183 Implement truncation detection and follow-up request per spec.md FR-039

### Documentation

- [ ] T184 [P] Update CLAUDE.md with n8n workflow deployment instructions
- [ ] T185 [P] Update quickstart.md with end-to-end testing instructions
- [ ] T186 Create runbook for common operational scenarios in `docs/runbook.md`

### Validation

- [ ] T187 End-to-end test: Submit feature request → PR merged → notification received
- [ ] T188 Test feedback loop: Intentionally fail QA → verify Dev retry → escalation after 3
- [ ] T189 Test auth failure: Simulate exit 57 → verify circuit breaker → recovery
- [ ] T190 Validate all 15 workflows are importable and activate in n8n

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational (Phase 2)
- **US2 (Phase 4)**: Depends on Foundational (Phase 2)
- **US4 (Phase 5)**: Depends on Foundational (Phase 2)
- **US3 (Phase 6)**: Depends on US1, US2, US4 (orchestrates all components)
- **US5 (Phase 7)**: Depends on US3 (quality gates plug into orchestrator)
- **US6 (Phase 8)**: Depends on US5 (feedback loops require quality gates)
- **US7 (Phase 9)**: Depends on US2 (human checkpoint for PM clarification)
- **US8 (Phase 10)**: Depends on Phase 2 (circuit breaker in Agent Runner)
- **US9 (Phase 11)**: Depends on Phase 2 (needs blob state to read)
- **Polish (Phase 12)**: Depends on all desired user stories

### User Story Dependencies

```
Foundational (Phase 2) ─────────────────────────────────────────────────────────
         │
         ├─────────────────┬─────────────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
      US1 (Form)       US2 (PM)        US4 (GitHub)       US8 (Auth)
      US9 (Dash)       US7 (Human)                           │
         │                 │                 │               │
         └─────────────────┴────────┬────────┘               │
                                    ▼                        │
                               US3 (E2E) ◀───────────────────┘
                                    │
                                    ▼
                               US5 (Quality)
                                    │
                                    ▼
                               US6 (Feedback)
```

### Parallel Opportunities Within Phases

**Phase 1 (all parallel)**:
- T002-T008 can all run in parallel (different files)

**Phase 2**:
- T010, T020, T028 (workflow shells) can run in parallel
- Then sequential within each workflow

**Phases 3-11**:
- Workflow shells marked [P] can start in parallel within each phase
- Implementation tasks within each workflow are sequential

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all workflow shells together:
Task: "Create Blob State Manager workflow shell in n8n-workflows/stage-1/blob-state-manager.json"
Task: "Create Agent Runner workflow shell in n8n-workflows/stage-1/agent-runner.json"
Task: "Create Feature Request Form workflow in n8n-workflows/stage-1/feature-request-form.json"

# Then implement each workflow (can parallelize across workflows):
Developer A: Blob State Manager (T011-T019)
Developer B: Agent Runner (T021-T027)
Developer C: Feature Request Form (T029-T037)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US4 + US3)

1. Complete Phase 1: Setup (T001-T009)
2. Complete Phase 2: Foundational (T010-T037)
3. Complete Phase 3: US1 - Form Submission (T038-T042)
4. Complete Phase 4: US2 - Specification Creation (T043-T062)
5. Complete Phase 5: US4 - GitHub Integration (T063-T085)
6. Complete Phase 6: US3 - Master Orchestrator (T086-T097)
7. **STOP and VALIDATE**: End-to-end test with simple feature request
8. Deploy MVP - Tasks flow through all phases (without quality gates)

### Incremental Delivery

After MVP:
1. Add US5 (Quality Gates) → Verification before merge
2. Add US6 (Feedback Loops) → Bounded retries
3. Add US7 (Human Checkpoints) → Clarification flow
4. Add US8 (Auth Recovery) → Production resilience
5. Add US9 (Dashboard) → Full observability

---

## Summary

| Phase | User Story | Task Count | Workflows Created |
|-------|------------|------------|-------------------|
| 1 | Setup | 9 | - |
| 2 | Foundational | 28 | 3 (Blob Manager, Agent Runner, Form) |
| 3 | US1 - Form | 5 | - (extends Form) |
| 4 | US2 - Specs | 20 | 3 (PM Intake, Planning, Tasks) |
| 5 | US4 - GitHub | 23 | 3 (Token Manager, Dev Impl, Dev Release) |
| 6 | US3 - E2E | 12 | 1 (Master Orchestrator) |
| 7 | US5 - Quality | 24 | 2 (QA Verification, Reviewer) |
| 8 | US6 - Feedback | 12 | 1 (Feedback Router) |
| 9 | US7 - Human | 17 | 2 (Human Checkpoint, Notification Hub) |
| 10 | US8 - Auth | 13 | 1 (Task Recovery) |
| 11 | US9 - Dashboard | 14 | - (extends dashboard) |
| 12 | Polish | 13 | - |
| **Total** | | **190** | **16 workflows** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Workflows are exported as JSON for version control in git
