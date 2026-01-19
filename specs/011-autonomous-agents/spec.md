# Feature Specification: Autonomous Dev Team Agents - Production Ready

**Feature Branch**: `011-autonomous-agents`
**Created**: 2026-01-19
**Status**: Draft
**Input**: User description: "create a full implementation plan to get the autonomous agents production ready"

## User Scenarios & Testing

### User Story 1 - Submit Feature Request via Web Form (Priority: P1)

A team member opens the feature request form in their browser, fills out the title, description, priority, target repository, and acceptance criteria, then submits. The system acknowledges the submission with a unique task ID and begins processing autonomously.

**Why this priority**: This is the entry point for all work. Without a way to submit feature requests, no autonomous work can happen. It's the foundation that enables everything else.

**Independent Test**: Can be fully tested by submitting a form and verifying a task envelope is created in Azure Blob storage, delivering the core value of accepting work requests.

**Acceptance Scenarios**:

1. **Given** the n8n form is accessible at the configured URL, **When** a user fills all required fields and submits, **Then** a unique task ID is generated and the user sees a confirmation message with that ID.
2. **Given** a form submission was successful, **When** checking Azure Blob storage, **Then** a task envelope exists at `agent-state/{task_id}/task-envelope.yml` with all form data captured.
3. **Given** a form is submitted with missing required fields, **When** the user clicks submit, **Then** validation errors are shown and submission is prevented.

---

### User Story 2 - Automatic Specification Creation (Priority: P1)

After a feature request is submitted, the PM Agent automatically analyzes the request and creates a structured specification document. If requirements are clear, processing continues. If ambiguous, the requester is notified via Teams with specific clarifying questions.

**Why this priority**: Specifications are the foundation for all subsequent work. Without automated spec creation, the pipeline cannot progress beyond intake.

**Independent Test**: Can be tested by submitting a well-defined feature request and verifying spec.md is created in SpecKit format with user stories, requirements, and success criteria.

**Acceptance Scenarios**:

1. **Given** a task envelope exists with clear requirements, **When** the PM Agent processes intake, **Then** a spec.md file is created in `agent-spec/{task_id}/` in SpecKit format.
2. **Given** a task envelope with ambiguous requirements, **When** the PM Agent processes intake, **Then** the task status is set to "needs_clarification" and a Teams notification is sent to the requester with specific questions.
3. **Given** a spec.md is successfully created, **When** the task envelope is updated, **Then** the phase is set to "planning" and processing continues automatically.

---

### User Story 3 - End-to-End Task Completion (Priority: P1)

A submitted feature request flows through all six phases (Intake, Planning, Implementation, Verification, Review, Release) without human intervention when requirements are clear and code passes quality gates. The requester receives a Teams notification when complete.

**Why this priority**: This is the core value proposition - autonomous feature delivery. All other stories support this end-to-end flow.

**Independent Test**: Can be tested with a simple, well-defined feature request (e.g., "add a health check endpoint") and verifying a merged PR results.

**Acceptance Scenarios**:

1. **Given** a well-defined feature request, **When** processing completes all phases, **Then** a PR is merged to the target repository and the task status is "completed".
2. **Given** processing completes successfully, **When** the requester checks Teams, **Then** they have received notifications at key milestones (submitted, spec ready, PR created, completed).
3. **Given** an end-to-end test feature, **When** measuring total time, **Then** completion occurs within 2 hours for simple features.

---

### User Story 4 - GitHub Integration for Code Changes (Priority: P1)

The Dev Agent clones the target repository, creates a feature branch, makes code changes, commits with clear messages, and opens a pull request. All git operations use secure GitHub App authentication.

**Why this priority**: Without GitHub integration, the Dev Agent cannot deliver code changes. This is essential for the implementation phase.

**Independent Test**: Can be tested by triggering the Dev Agent with a task and verifying a PR is created in the target GitHub repository with the expected branch naming convention.

**Acceptance Scenarios**:

1. **Given** a task in implementation phase with a target repository, **When** the Dev Agent executes, **Then** a feature branch is created with naming pattern `feat/{task_id}-{short-description}`.
2. **Given** the Dev Agent completes implementation, **When** checking GitHub, **Then** a PR exists with a descriptive title, body referencing the task ID, and all commits have clear messages.
3. **Given** GitHub App credentials are configured, **When** the Dev Agent authenticates, **Then** installation tokens are minted and used for git operations (no hardcoded credentials).

---

### User Story 5 - Quality Verification Before Merge (Priority: P2)

After code is implemented, the QA Agent runs tests, verifies acceptance criteria, and produces a verification report. The Reviewer Agent then checks code quality and security. Only after both approve does the PR proceed to merge.

**Why this priority**: Quality gates prevent low-quality or insecure code from being merged. While essential for production, the core flow can be demonstrated without them initially.

**Independent Test**: Can be tested by providing a PR with intentional test failures and verifying the QA Agent returns "request_changes" with specific feedback.

**Acceptance Scenarios**:

1. **Given** a PR from the Dev Agent, **When** the QA Agent verifies, **Then** a verification-report.md is created with test results and acceptance criteria status.
2. **Given** all tests pass and acceptance criteria are met, **When** the QA Agent completes, **Then** the recommendation is "approve" and the task proceeds to review.
3. **Given** the QA Agent finds issues, **When** feedback is provided, **Then** the Dev Agent receives specific, actionable feedback and the task loops back to implementation.

---

### User Story 6 - Feedback Loops with Bounded Retries (Priority: P2)

When QA or Review agents request changes, the Dev Agent receives feedback and attempts fixes. Retries are bounded (3 for QA, 2 for Review). If limits are exceeded, the task escalates to human review.

**Why this priority**: Prevents infinite loops and ensures human oversight when agents cannot resolve issues. Important for production reliability.

**Independent Test**: Can be tested by providing a task that consistently fails QA and verifying human escalation triggers after 3 attempts.

**Acceptance Scenarios**:

1. **Given** QA requests changes, **When** Dev Agent attempts fix, **Then** the retry count is incremented and tracked in the task envelope.
2. **Given** 3 QA retry attempts have failed, **When** the 4th failure occurs, **Then** the task is escalated to human review via Teams notification.
3. **Given** a feedback loop is in progress, **When** checking the task envelope, **Then** the error history shows each attempt with its outcome.

---

### User Story 7 - Human Checkpoint for Ambiguous Requests (Priority: P2)

When the PM Agent cannot create a clear specification due to ambiguous requirements, the system pauses and notifies the requester via Teams with specific questions. Processing resumes when clarification is provided.

**Why this priority**: Handles the common case where feature requests need clarification. Prevents wasted agent effort on misunderstood requirements.

**Independent Test**: Can be tested by submitting a deliberately vague feature request and verifying a Teams notification is sent with clarifying questions.

**Acceptance Scenarios**:

1. **Given** ambiguous requirements in a feature request, **When** PM Agent sets "needs_clarification", **Then** a Teams adaptive card is sent to the requester with the specific questions.
2. **Given** a task is waiting for clarification, **When** the requester responds via Teams, **Then** the response is captured and processing resumes.
3. **Given** no response within 24 hours, **When** the system checks stale tasks, **Then** a reminder notification is sent.

---

### User Story 8 - Authentication Failure Recovery (Priority: P2)

When Claude authentication expires (exit code 57), all task processing pauses, an alert is sent, and the system waits for token refresh. Once refreshed, processing resumes automatically.

**Why this priority**: Claude tokens expire periodically. Without recovery, the entire system halts. The watchdog CronJob already exists; this connects it to task processing.

**Independent Test**: Can be tested by simulating exit code 57 from Agent Runner and verifying task processing pauses and alerts are sent.

**Acceptance Scenarios**:

1. **Given** the Agent Runner returns exit code 57, **When** processing a task, **Then** the task is paused with status "auth_failure" and a Teams alert is sent.
2. **Given** an auth failure has occurred, **When** checking all other tasks, **Then** they are also paused (circuit breaker activated).
3. **Given** tokens are refreshed and auth succeeds, **When** the system resumes, **Then** paused tasks automatically continue from their last phase.

---

### User Story 9 - Observability and Progress Tracking (Priority: P3)

The ops-dashboard shows real-time status of all tasks in the pipeline, including current phase, agent activity, and error history. Users can see task progress without accessing logs.

**Why this priority**: Important for production operations but not required for core functionality. The dashboard already exists; this extends it with task pipeline data.

**Independent Test**: Can be tested by submitting a task and verifying the dashboard shows its progress through phases in real-time.

**Acceptance Scenarios**:

1. **Given** tasks are in the pipeline, **When** viewing the dashboard, **Then** each task shows its current phase, status, and last activity time.
2. **Given** a task has encountered errors, **When** viewing task details, **Then** the error history is visible with timestamps and resolutions.
3. **Given** the dashboard is loaded, **When** a task changes phase, **Then** the update is visible within 30 seconds without manual refresh.

---

### Edge Cases

#### Form Submission & Entry Point
- What happens when the target repository doesn't exist or is inaccessible? (System validates repository access before creating task envelope; returns error to user immediately)
- What happens when a user submits a duplicate feature request? (System detects similar title+repo within 24 hours; warns user and requires confirmation to proceed)
- What happens when the repository URL is malformed or invalid? (Form validation rejects invalid URLs before submission)
- What happens when a user submits many requests rapidly? (Rate limit of 5 submissions per hour per user; excess requests queued with warning)
- What happens when the form submission contains sensitive data (passwords, keys)? (Form includes warning; system scans for common patterns and redacts before storage)

#### GitHub Integration
- What happens when GitHub API rate limits are exceeded? (System tracks rate limit headers; pauses GitHub operations and resumes when limit resets; alerts if sustained)
- What happens when GitHub App installation token expires mid-operation? (Token refresh is attempted automatically; if failed, task pauses at current step and resumes after refresh)
- What happens when GitHub is unavailable/experiencing outage? (Retry with exponential backoff up to 30 minutes; if still unavailable, pause task and alert)
- What happens when merge conflicts occur during PR creation? (Dev Agent attempts automatic conflict resolution; if complex, escalates to human with conflict details)
- What happens when protected branch rules block the push? (System detects branch protection; escalates to human with explanation of required approvals/checks)
- What happens when the repository is renamed or deleted during processing? (System detects 404/redirect; pauses task and alerts requester to update repository reference)
- What happens when git push fails due to hooks or permissions? (Capture error output; retry once; if still failing, escalate with detailed error message)

#### Agent Execution & Context
- What happens when the codebase is too large for agent context window? (Agent receives prioritized subset: spec, plan, target files only; summarizes large files)
- What happens when an agent produces malformed or invalid output? (Schema validation fails; retry with explicit format instructions; escalate after 2 failures)
- What happens when an agent hallucinates files or APIs that don't exist? (QA Agent verification catches non-existent references; feeds back to Dev Agent with correction)
- What happens when agent output is truncated due to length limits? (Detect truncation; request completion in follow-up call; chunk large outputs)

#### QA & Testing
- What happens when tests are flaky (intermittent pass/fail)? (Run test suite twice on failure; if results differ, flag as flaky and escalate for human review)
- What happens when the repository has no tests? (QA Agent notes absence in report; proceeds with acceptance criteria verification only; flags risk in review)
- What happens when tests require external services or credentials? (Skip integration tests requiring credentials; document skipped tests; flag for manual verification)
- What happens when test infrastructure fails (npm install fails, build errors)? (Capture build output; Dev Agent attempts to fix; escalate if infrastructure issue)

#### State Management & Recovery
- How does the system handle concurrent feature requests to the same repository? (Each task gets its own feature branch; blob leases prevent conflicting state updates)
- What happens when a feature request specifies a non-existent branch as the base? (Dev Agent validates base branch exists; escalates to human if not)
- How does the system recover from partial failures (e.g., spec created but plan failed)? (Task envelope tracks last successful phase; resumes from that point)
- What happens when blob storage is temporarily unavailable? (Retry with exponential backoff; escalate after 3 failures)
- What happens when a task envelope becomes corrupted? (System detects schema validation failure; attempts recovery from last valid state; alerts if unrecoverable)
- What happens when artifact storage quota is exceeded? (Alert before quota reached; pause new tasks; prompt for cleanup of old completed tasks)

#### Task Lifecycle
- How are very long-running tasks (>2 hours) handled? (Task Recovery workflow scans for stuck tasks; alerts after configurable threshold)
- What happens when a task is submitted while the system is in auth failure mode? (Task is created but immediately paused; processes once auth restored)
- How can a user cancel a task in progress? (Dashboard provides cancel button; system marks task as "cancelled", stops processing, cleans up resources)
- What happens when task priority needs to change mid-execution? (Dashboard allows priority change; affects queue position for paused tasks; in-progress tasks complete current phase)
- What happens when one feature depends on another incomplete feature? (System tracks declared dependencies; dependent task waits at implementation phase until dependency merges)

#### Notifications & Communication
- What happens when Teams webhook delivery fails? (Retry 3 times with backoff; log failure; continue processing; surface in dashboard)
- What happens when notification rate limits are hit? (Batch notifications; prioritize escalations and completions over progress updates)
- What happens when the requester is no longer in the organization? (Notification fails silently; task continues; admin notified for completed/escalated tasks without recipient)
- What happens when clarification response times out (>7 days)? (Task marked as "stale"; notification sent to admin; task can be cancelled or reassigned)

#### Security & Abuse Prevention
- What happens when Reviewer Agent identifies a critical security vulnerability? (Immediate escalation regardless of retry count; PR blocked from merge; security team notified)
- What happens when a malicious feature request attempts prompt injection? (Agent system prompts include injection guards; suspicious patterns logged and flagged for review)
- What happens when generated code introduces a known vulnerability pattern? (Reviewer Agent checks against common patterns; blocks with specific remediation guidance)

## Requirements

### Non-Functional Requirements (NFRs)

#### Availability & Reliability
- **NFR-001**: System MUST maintain 99% availability during business hours (6am-10pm CST, Mon-Fri)
- **NFR-002**: System MUST recover from transient failures (network, storage) within 5 minutes without manual intervention
- **NFR-003**: System MUST preserve task state across component restarts (pods, n8n workers)
- **NFR-004**: System MUST handle AKS cluster upgrades without data loss (graceful shutdown with task persistence)

#### Latency & Throughput
- **NFR-005**: Form submission acknowledgment MUST return within 3 seconds
- **NFR-006**: Phase transitions MUST trigger within 30 seconds of previous phase completion
- **NFR-007**: System MUST support processing 10 concurrent tasks without queue starvation
- **NFR-008**: Human escalation notifications MUST be sent within 60 seconds of trigger
- **NFR-009**: Dashboard status updates MUST reflect within 30 seconds of state change

#### Durability & Data Retention
- **NFR-010**: Task envelopes MUST be retained for 90 days after completion/cancellation
- **NFR-011**: Agent artifacts (spec.md, plan.md, etc.) MUST be retained for 1 year
- **NFR-012**: Verification and review reports MUST be retained for 90 days
- **NFR-013**: All state mutations MUST be persisted to Azure Blob before acknowledging success
- **NFR-014**: System MUST NOT lose in-flight task state during unexpected pod termination

#### Scalability
- **NFR-015**: System MUST scale to 50 concurrent tasks with additional n8n workers (horizontal scaling)
- **NFR-016**: Agent context MUST fit within 80KB budget (100KB max - 20KB buffer)
- **NFR-017**: Individual agent executions MUST complete within 10 minutes (timeout with retry)

### Security & Privacy Requirements

#### Authentication & Authorization
- **SEC-001**: All Azure Blob operations MUST use Workload Identity (no storage account keys)
- **SEC-002**: All GitHub operations MUST use GitHub App installation tokens (no PATs)
- **SEC-003**: Claude session tokens MUST be stored in Kubernetes secrets (not ConfigMaps)
- **SEC-004**: n8n credentials MUST be stored encrypted using n8n's credential encryption
- **SEC-005**: Dashboard access MUST require Azure AD authentication with MFA
- **SEC-006**: Agent pods MUST run as non-root with read-only filesystem (except /tmp)

#### Data Classification & Handling
- **SEC-007**: Form submissions MAY contain internal business logic (Confidential - Internal)
- **SEC-008**: Generated code MAY be committed to private repositories only
- **SEC-009**: Agent prompts MUST NOT include production credentials, API keys, or PII
- **SEC-010**: Sensitive patterns (passwords, tokens, keys) MUST be redacted before storage
- **SEC-011**: Task envelopes MUST NOT store raw user credentials or secrets

#### Encryption
- **SEC-012**: All data at rest MUST be encrypted (Azure Blob SSE, AKS etcd encryption)
- **SEC-013**: All data in transit MUST use TLS 1.2+ (HTTPS for all external calls)
- **SEC-014**: GitHub App private key MUST be stored in Azure Key Vault (not in K8s secrets)

#### Audit & Compliance
- **SEC-015**: All state transitions MUST be logged with timestamp, actor, and before/after values
- **SEC-016**: All escalations MUST be logged with reason and resolution
- **SEC-017**: Agent invocations MUST log prompt hash (not full prompt) for audit trail
- **SEC-018**: System MUST support audit export for compliance review (task history JSON)

#### Vulnerability Management
- **SEC-019**: Reviewer Agent MUST check for OWASP Top 10 vulnerability patterns
- **SEC-020**: Critical security vulnerabilities MUST trigger immediate escalation (bypass retry limits)
- **SEC-021**: Known vulnerable dependency patterns MUST be flagged in review
- **SEC-022**: System MUST NOT auto-merge PRs with unresolved security comments

### Observability Requirements

#### Metrics (Prometheus/Azure Monitor)
- **OBS-001**: System MUST expose task_count gauge by status (pending, in_progress, completed, failed)
- **OBS-002**: System MUST expose phase_duration_seconds histogram by phase
- **OBS-003**: System MUST expose agent_invocation_total counter by agent type and exit code
- **OBS-004**: System MUST expose feedback_loop_cycles histogram by loop type (verification, review)
- **OBS-005**: System MUST expose escalation_total counter by reason

#### Logging (Structured JSON)
- **OBS-006**: All logs MUST include task_id, phase, and correlation_id fields
- **OBS-007**: Error logs MUST include exit_code, error_message, and stack_trace fields
- **OBS-008**: Agent logs MUST include agent_type, duration_ms, and prompt_hash fields
- **OBS-009**: State transition logs MUST include from_status, to_status, and trigger fields

#### Tracing (Optional - Future)
- **OBS-010**: Each task SHOULD have a distributed trace ID for end-to-end visibility
- **OBS-011**: Agent invocations SHOULD be traced as child spans of task execution

#### Alerting
- **OBS-012**: Alert MUST fire when task stuck in same phase >2 hours
- **OBS-013**: Alert MUST fire when auth failure (exit 57) detected
- **OBS-014**: Alert MUST fire when error rate >10% over 15-minute window
- **OBS-015**: Alert MUST fire when blob storage unavailable for >5 minutes

### Cost & Resource Controls

#### Compute
- **COST-001**: Agent pods MUST have resource limits (CPU: 2 cores, Memory: 4GB)
- **COST-002**: Concurrent agent executions MUST be limited to 10 per cluster
- **COST-003**: Long-running agents (>10min) MUST be terminated and retried with reduced scope

#### Storage
- **COST-004**: Task artifacts older than retention period MUST be automatically deleted
- **COST-005**: System MUST alert when storage usage exceeds 80% of quota
- **COST-006**: Maximum artifact size MUST be limited (spec: 100KB, plan: 50KB, tasks: 100KB)

#### API Usage
- **COST-007**: GitHub API calls MUST be batched where possible (bulk status checks)
- **COST-008**: Teams notifications MUST be rate-limited (max 10 per task per hour)
- **COST-009**: Claude API usage MUST be tracked per task for cost attribution

### Functional Requirements

#### Core Pipeline
- **FR-001**: System MUST provide a web form for submitting feature requests with fields: title, description, priority, target repository, acceptance criteria
- **FR-002**: System MUST generate unique task IDs in format `FEAT-{timestamp}-{random}` for each submission
- **FR-003**: System MUST create task envelopes in Azure Blob storage with all submission data and initial status
- **FR-004**: System MUST orchestrate tasks through six phases: Intake, Planning, Implementation, Verification, Review, Release
- **FR-005**: PM Agent MUST create spec.md, plan.md, and tasks.md documents in SpecKit format
- **FR-006**: Dev Agent MUST clone target repositories, create feature branches, implement code changes, and create pull requests
- **FR-007**: System MUST use GitHub App authentication with installation tokens for all git operations
- **FR-008**: QA Agent MUST run tests and verify acceptance criteria, producing verification reports
- **FR-009**: Reviewer Agent MUST check code quality and security, approving or requesting changes
- **FR-010**: System MUST route feedback from QA/Reviewer agents back to Dev Agent for fixes

#### Retry & Escalation
- **FR-011**: System MUST enforce retry limits: 3 cycles for QA, 2 cycles for Review
- **FR-012**: System MUST escalate to human review when retry limits are exceeded
- **FR-013**: System MUST immediately escalate critical security vulnerabilities regardless of retry count

#### Notifications
- **FR-014**: System MUST send Teams notifications at key milestones: submission, clarification needed, PR created, completed, escalated
- **FR-015**: System MUST retry failed notifications 3 times with exponential backoff
- **FR-016**: System MUST batch notifications when rate limits are approached, prioritizing escalations

#### Authentication & Authorization
- **FR-017**: System MUST pause all task processing when Claude authentication failure (exit code 57) is detected
- **FR-018**: System MUST resume paused tasks automatically when authentication is restored
- **FR-019**: System MUST automatically refresh GitHub App installation tokens before expiration
- **FR-020**: System MUST validate repository access permissions before creating task envelope

#### State Management
- **FR-021**: System MUST handle blob lease conflicts (exit code 23) with wait-and-retry strategy
- **FR-022**: System MUST timeout long-running agent executions (exit code 124) after configurable limit
- **FR-023**: System MUST maintain error history in task envelopes for debugging
- **FR-024**: System MUST validate agent outputs against expected schemas before proceeding to next phase
- **FR-025**: System MUST prevent concurrent modifications to the same task via blob lease mechanism
- **FR-026**: System MUST track last successful phase for recovery from partial failures

#### Input Validation & Abuse Prevention
- **FR-027**: System MUST validate repository URLs before accepting form submissions
- **FR-028**: System MUST detect and warn on duplicate submissions (same title+repo within 24 hours)
- **FR-029**: System MUST rate limit form submissions to 5 per hour per user
- **FR-030**: System MUST scan submissions for sensitive data patterns and redact before storage
- **FR-031**: System MUST include prompt injection guards in agent system prompts

#### GitHub Integration Resilience
- **FR-032**: System MUST track GitHub API rate limit headers and pause operations when limits are near
- **FR-033**: System MUST retry GitHub operations with exponential backoff on transient failures
- **FR-034**: System MUST detect and handle merge conflicts, attempting auto-resolution for simple cases
- **FR-035**: System MUST detect protected branch rules and escalate appropriately
- **FR-036**: System MUST detect repository renames/deletions and pause affected tasks

#### Agent Execution Resilience
- **FR-037**: System MUST prioritize context for large codebases (spec, plan, target files only)
- **FR-038**: System MUST retry agent executions with explicit format instructions when schema validation fails
- **FR-039**: System MUST detect and handle truncated agent outputs

#### QA Resilience
- **FR-040**: System MUST run test suites twice on failure to detect flaky tests
- **FR-041**: System MUST handle repositories with no tests by proceeding with acceptance criteria verification only
- **FR-042**: System MUST skip tests requiring external credentials and document skipped tests

#### Task Lifecycle Management
- **FR-043**: System MUST provide task cancellation capability via dashboard
- **FR-044**: System MUST allow task priority changes with appropriate queue reordering
- **FR-045**: System MUST support task dependencies (wait for another task to complete)
- **FR-046**: System MUST mark tasks as "stale" when waiting for clarification >7 days

### Key Entities

- **Task Envelope**: Central state object tracking a feature request through all phases. Contains task_id, status, phase, form data, error history, retry counts, timestamps, and references to artifacts.
- **Specification (spec.md)**: SpecKit-format document with user stories, functional requirements, non-functional requirements, and success criteria.
- **Implementation Plan (plan.md)**: SpecKit-format document with implementation approach, component design, and technical decisions.
- **Task List (tasks.md)**: SpecKit-format document with ordered, dependency-aware implementation tasks.
- **Verification Report**: QA Agent output documenting test results, acceptance criteria status, and recommendation.
- **Review Feedback**: Reviewer Agent output with code comments, security concerns, and approval status.
- **GitHub App Credentials**: Secure authentication mechanism (app ID + private key) for minting repository-scoped tokens.

## Success Criteria

### Measurable Outcomes

| ID | Criterion | Target | Measurement Source | Constraints |
|----|-----------|--------|-------------------|-------------|
| **SC-001** | Well-defined feature requests complete all phases autonomously | ≥80% | `task_count{status="completed"} / task_count{type="well_defined"}` | "Well-defined" = ≤3 acceptance criteria, single repo, no external dependencies |
| **SC-002** | Simple features complete end-to-end | ≤2 hours | `phase_duration_seconds` histogram (sum all phases) | "Simple" = single-file change, ≤100 LOC delta, passing CI on base branch |
| **SC-003** | Concurrent task handling without degradation | 10 tasks | Load test: 10 simultaneous form submissions, measure `phase_duration_seconds` variance | Degradation = >50% latency increase vs single task |
| **SC-004** | Authentication failure detection and alerting | ≤60 seconds | Time from `exit_code=57` to Teams notification timestamp | Measured from Agent Runner response to notification webhook call |
| **SC-005** | Human escalation trigger latency | ≤30 seconds | Time from retry limit exceeded to escalation notification | Measured from `cycle_count >= max_cycles` detection to Teams card |
| **SC-006** | Real-time progress tracking | ≤30 seconds | Dashboard poll interval + backend query latency | Dashboard shows current phase within 30s of state change |
| **SC-007** | Security vulnerability detection rate | ≥95% detection | OWASP benchmark: inject known vulnerability patterns, measure Reviewer Agent detection | Vulnerabilities = OWASP Top 10 patterns (SQLi, XSS, etc.) |
| **SC-008** | Complete audit trail | 100% coverage | Audit export includes all state transitions, agent invocations, escalations | Every task has verifiable decision chain |
| **SC-009** | Automatic recovery from transient failures | ≥95% | `(transient_failures - manual_interventions) / transient_failures` | Transient = blob timeout, network error, pod restart |
| **SC-010** | Feedback loop resolution without human involvement | ≥70% | `feedback_loops_resolved_autonomously / total_feedback_loops` | Excludes security escalations (SEC-020) |

### Success Criteria Clarifications

**SC-002 Constraints**: The 2-hour target applies only to "simple" features defined as:
- Single file modified (not counting tests)
- ≤100 lines of code changed
- Target repository has passing CI on base branch
- No external service dependencies (databases, APIs)
- Clear, unambiguous acceptance criteria

**SC-007 Realism**: "Zero vulnerabilities" is aspirational. The realistic metric is detection rate:
- Reviewer Agent MUST detect ≥95% of injected OWASP Top 10 patterns
- System MUST block PRs with detected critical vulnerabilities
- Undetected vulnerabilities found post-merge are tracked and trigger Reviewer prompt improvements

## Operational Procedures

### Clarification Resolution Flow

When PM Agent sets `needs_clarification`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLARIFICATION RESOLUTION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

  PM Agent detects              System pauses task         Teams notification
  ambiguity                     and updates state          sent to requester
      │                              │                           │
      ▼                              ▼                           ▼
┌─────────────┐              ┌─────────────────┐         ┌─────────────────┐
│ Intake      │              │ Task Envelope   │         │ Adaptive Card   │
│ generates   │─────────────▶│ status: escalated│────────▶│ with questions  │
│ questions   │              │ phase: intake    │         │ and buttons     │
└─────────────┘              └─────────────────┘         └─────────────────┘
                                                                  │
                                                         User interacts
                                                                  │
                              ┌────────────────────────────┬──────┴──────┐
                              │                            │             │
                              ▼                            ▼             ▼
                       ┌─────────────┐              ┌─────────────┐ ┌─────────┐
                       │ User clicks │              │ User types  │ │ Timeout │
                       │ preset      │              │ custom      │ │ 7 days  │
                       │ answer      │              │ answer      │ │         │
                       └──────┬──────┘              └──────┬──────┘ └────┬────┘
                              │                            │             │
                              └────────────┬───────────────┘             │
                                           │                             │
                                           ▼                             ▼
                              ┌─────────────────────┐         ┌─────────────────┐
                              │ Clarification       │         │ Task marked     │
                              │ appended to request │         │ status: stale   │
                              │ Task resumes intake │         │ Admin notified  │
                              └─────────────────────┘         └─────────────────┘
```

**Clarification Capture**:
- Teams webhook receives user response via Power Automate flow
- Response is appended to `task_envelope.request.clarifications[]`
- PM Agent re-processes intake with original request + clarifications
- Maximum 2 clarification rounds before forced escalation to admin

### PR Merge Strategy & Release Gating

**Merge Strategy**: Squash and Merge (single commit per feature)

**Pre-Merge Gates** (all MUST pass):
1. ✅ QA Agent verification report: `recommendation = "approve"`
2. ✅ Reviewer Agent assessment: `assessment = "approve"`
3. ✅ CI pipeline passes on feature branch
4. ✅ No merge conflicts with base branch
5. ✅ No unresolved security comments (blocking severity)

**Merge Execution**:
```yaml
merge_config:
  strategy: squash
  commit_message_template: |
    feat({scope}): {title} (#{pr_number})

    Task: {task_id}

    {body_summary}
  delete_branch_after_merge: true
  auto_merge_enabled: false  # Dev Agent explicitly triggers merge
```

**Post-Merge Actions**:
1. Delete feature branch
2. Update task envelope: `phases.release.status = "completed"`
3. Generate release notes (optional, stored in `agent-release/`)
4. Send completion notification to requester
5. Update dashboard metrics

### Review Agent Responsibilities (Clarified)

The Reviewer Agent performs **code review**, distinct from QA verification:

| Aspect | QA Agent | Reviewer Agent |
|--------|----------|----------------|
| **Focus** | Functional correctness | Code quality & security |
| **Inputs** | Tests, acceptance criteria | PR diff, coding standards |
| **Checks** | Tests pass, criteria met | Patterns, vulnerabilities, style |
| **Output** | verification-report.yml | review-report.yml |
| **Decision** | "Tests pass/fail" | "Approve/Request changes" |

**Reviewer Agent Scope**:
- Security: OWASP Top 10 patterns, credential exposure, injection risks
- Correctness: Logic errors, null checks, error handling
- Performance: O(n²) patterns, memory leaks, unoptimized queries
- Style: Project conventions, naming, documentation
- Dependencies: Version compatibility, license compliance

**Out of Scope for Reviewer Agent**:
- Running tests (QA responsibility)
- Verifying acceptance criteria (QA responsibility)
- Architectural decisions (human review if significant)
- Performance benchmarking (manual if needed)

## Assumptions

- The existing Claude Agent HTTP API (`server.js` with `/run` endpoint) is stable and working
- Azure Blob storage containers are configured and accessible via Workload Identity
- GitHub App is registered with necessary permissions for target repositories
- n8n is deployed and accessible at the expected URL
- Teams webhooks are configured for notifications
- SpecKit templates exist and define expected document formats
- The ops-dashboard is deployed and can be extended for task pipeline visibility
- Power Automate flow exists for Teams → n8n clarification callback
