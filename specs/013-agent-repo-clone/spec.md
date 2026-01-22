# Feature Specification: Agent Repository Clone and Real Code Workflow

**Feature Branch**: `013-agent-repo-clone`
**Created**: 2026-01-20
**Status**: Draft
**Input**: User description: "Fix agent pipeline to clone repositories and work with real code instead of document simulation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dev Agent Clones Repository and Creates Feature Branch (Priority: P1)

When a feature request enters the Implementation phase, the Dev Agent must clone the target repository from GitHub, create a dedicated feature branch, and work with the actual codebase rather than generating code based on documentation alone.

**Why this priority**: This is the core capability that enables all other improvements. Without actual repository access, agents cannot verify their code compiles, run tests, or create real pull requests.

**Independent Test**: Submit a feature request for a simple change (e.g., add a comment to a file). The agent should clone the repo, create a branch, make the change, and the change should be visible in the GitHub repository.

**Acceptance Scenarios**:

1. **Given** a task envelope with a valid GitHub repository URL, **When** the Dev Agent starts implementation, **Then** the agent clones the repository to a working directory
2. **Given** a cloned repository, **When** the Dev Agent begins work, **Then** a feature branch is created with the naming convention `feat/{task-id}`
3. **Given** a task in the implementation phase, **When** the agent completes its work, **Then** all changes exist in the actual repository (not just in blob storage documents)

---

### User Story 2 - Dev Agent Runs Build Verification (Priority: P1)

After making code changes, the Dev Agent must run the project's build command to verify the code compiles successfully. Build failures must block progression to the next phase.

**Why this priority**: Build verification catches syntax errors, typos, and type mismatches (like `GlCode` vs `GLCode`) that document-based review cannot detect.

**Independent Test**: Submit a feature request that intentionally introduces a build error. The agent should detect the failure and attempt to fix it rather than proceeding.

**Acceptance Scenarios**:

1. **Given** code changes have been made, **When** the Dev Agent prepares to commit, **Then** the build command is executed first
2. **Given** the build fails, **When** the Dev Agent receives the error output, **Then** the agent attempts to fix the error (up to 3 retries)
3. **Given** the build succeeds, **When** the Dev Agent proceeds, **Then** the changes are committed and pushed
4. **Given** the build fails after 3 retry attempts, **When** the agent cannot fix the issue, **Then** the task is marked as blocked and routed to human review

---

### User Story 3 - Dev Agent Creates Real Pull Request (Priority: P1)

After successful build verification, the Dev Agent must push the feature branch and create an actual GitHub Pull Request with a descriptive title and body.

**Why this priority**: Pull requests are the artifact that enables code review, CI/CD pipelines, and eventual merge to production.

**Independent Test**: Complete an implementation task and verify a real PR appears in the GitHub repository with the agent's changes.

**Acceptance Scenarios**:

1. **Given** changes are committed on the feature branch, **When** implementation completes, **Then** the branch is pushed to GitHub
2. **Given** the branch is pushed, **When** the Dev Agent finalizes, **Then** a Pull Request is created via GitHub CLI
3. **Given** a PR is created, **When** the task envelope is updated, **Then** the PR URL is recorded in the `release.pr_url` field

---

### User Story 4 - QA Agent Verifies Against Real Code (Priority: P2)

The QA Agent must clone the repository, checkout the feature branch, run tests, and verify the implementation against the actual code rather than reviewing specification documents.

**Why this priority**: QA verification is only meaningful when testing real code. Document-based verification provides false confidence.

**Independent Test**: After a Dev Agent creates a PR, the QA Agent should run actual tests and report real test results.

**Acceptance Scenarios**:

1. **Given** a task in the verification phase with a PR URL, **When** the QA Agent starts, **Then** it clones the repo and checks out the PR branch
2. **Given** the QA Agent has the code, **When** verification runs, **Then** actual test commands are executed
3. **Given** tests pass, **When** verification completes, **Then** the verification report includes real test output
4. **Given** tests fail, **When** the QA Agent reports, **Then** specific failure details are included and the task routes back to implementation

---

### User Story 5 - Review Agent Reviews Actual PR Code (Priority: P2)

The Review Agent must access the actual GitHub Pull Request and review the code diff rather than reviewing specification documents.

**Why this priority**: Code review catches implementation issues that specifications cannot reveal.

**Independent Test**: After QA passes, the Review Agent should provide feedback on actual code changes visible in the PR diff.

**Acceptance Scenarios**:

1. **Given** a task in the review phase with a PR URL, **When** the Review Agent starts, **Then** it fetches the PR diff from GitHub
2. **Given** the PR diff is available, **When** the Review Agent analyzes, **Then** feedback references actual code lines and files
3. **Given** the review finds issues, **When** the report is generated, **Then** specific code locations are cited

---

### Edge Cases

- What happens when the repository URL is invalid or inaccessible? The task fails immediately with a clear error message indicating the repository could not be accessed
- What happens when the agent lacks write access to the repository? The task fails with a permissions error, clearly stating which permissions are missing
- What happens when the feature branch already exists? The agent checks out the existing branch and continues work, or creates a unique suffix if conflicts exist
- What happens when the build command is unknown for the project type? The agent attempts to detect from project files (package.json, *.csproj, Makefile, etc.) and falls back to asking for human input if detection fails
- What happens when disk space is insufficient for clone? The agent reports a resource error with specific details about space requirements
- What happens when the clone times out for large repositories? Configurable timeout with automatic retry using shallow clone as fallback

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST clone the target repository using the URL from the task envelope `repository` field
- **FR-002**: System MUST create a feature branch named `feat/{task-id}` before making changes
- **FR-003**: System MUST detect the project type and determine the appropriate build command
- **FR-004**: System MUST execute the build command after code changes and before committing
- **FR-005**: System MUST retry failed builds up to 3 times with error-driven fixes
- **FR-006**: System MUST push the feature branch to GitHub after successful build
- **FR-007**: System MUST create a GitHub Pull Request using the GitHub CLI
- **FR-008**: System MUST record the PR URL in the task envelope upon successful creation
- **FR-009**: System MUST provide actual test output in verification reports (not document-based assertions)
- **FR-010**: System MUST access the real PR diff for code review (not specification documents)
- **FR-011**: System MUST clean up working directories after task completion to manage disk space
- **FR-012**: System MUST handle GitHub authentication using existing GitHub App tokens

### Key Entities

- **Task Envelope**: Contains repository URL, task ID, phase status, and PR URL after release
- **Working Directory**: Temporary directory where repository is cloned for agent work
- **Feature Branch**: Git branch created for the task with naming convention `feat/{task-id}`
- **Build Configuration**: Project-type-specific build commands detected or configured

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of implementation tasks result in actual Git commits in the target repository (vs. 0% currently)
- **SC-002**: Build errors are detected before PR creation, reducing post-PR CI failures by 90%
- **SC-003**: QA verification reports include real test execution output with pass/fail counts
- **SC-004**: Code review feedback references actual file paths and line numbers from the PR diff
- **SC-005**: Task completion time remains under 60 minutes for typical features
- **SC-006**: Agent working directories are cleaned up within 1 hour of task completion

## Assumptions

- GitHub App tokens are already configured and available to the agent container
- The GitHub CLI is installed in the agent container
- Target repositories have standard build tooling that can be auto-detected
- The agent container has sufficient disk space for repository clones
- Network access from the agent container to GitHub is available

## Out of Scope

- Supporting private repositories that require additional authentication beyond GitHub App
- Supporting non-GitHub version control systems (GitLab, Bitbucket)
- Automatic dependency installation for complex build environments
- Parallel implementation of multiple tasks in the same repository
