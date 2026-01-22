# Research: Agent Repository Clone and Real Code Workflow

**Feature**: 013-agent-repo-clone
**Date**: 2026-01-20

## Research Questions

### 1. How should the agent clone repositories securely?

**Decision**: Use GitHub App installation tokens already configured in the agent container

**Rationale**:
- The claude-agent container already has GitHub App tokens mounted (per CLAUDE.md)
- GitHub CLI (`gh`) is installed and can authenticate using these tokens
- No additional credential management required

**Alternatives Considered**:
- SSH keys: Would require additional secret management
- Personal Access Tokens: Less secure, harder to rotate
- OAuth flow: Too complex for automated agents

**Implementation**:
```bash
# Clone with GitHub CLI (handles auth automatically)
gh repo clone {owner}/{repo} /tmp/workspace/{task-id}
```

---

### 2. How should build commands be detected per project type?

**Decision**: Use file-based heuristics with fallback to explicit prompt instruction

**Rationale**:
- Most projects have standard manifest files (package.json, *.csproj, Makefile)
- Claude can examine files and determine appropriate commands
- Explicit instructions in prompt ensure consistent behavior

**Detection Rules**:
| File Present | Build Command | Test Command |
|--------------|---------------|--------------|
| `package.json` | `npm run build` or `npm run compile` | `npm test` |
| `*.csproj` | `dotnet build` | `dotnet test` |
| `Cargo.toml` | `cargo build` | `cargo test` |
| `Makefile` | `make` | `make test` |
| `pom.xml` | `mvn compile` | `mvn test` |
| `build.gradle` | `./gradlew build` | `./gradlew test` |

**Fallback**: If no recognized file, agent asks for clarification or marks task as blocked.

---

### 3. What is the optimal prompt structure for implementation agents?

**Decision**: Explicit, step-by-step workflow instructions in the system prompt

**Rationale**:
- Current vague instructions led to document-based simulation
- Explicit git commands ensure consistent behavior
- Build verification step is mandatory, not optional

**New Prompt Structure**:
```
MANDATORY WORKFLOW (FOLLOW EXACTLY):
1. Clone: gh repo clone {repository} /tmp/workspace/{task-id}
2. Branch: git checkout -b feat/{task-id}
3. Explore: Read relevant files to understand codebase patterns
4. Implement: Make changes per the task specification
5. Build: Run appropriate build command, fix any errors
6. Test: Run test command if available
7. Commit: git add . && git commit -m "feat: {description}"
8. Push: git push -u origin feat/{task-id}
9. PR: gh pr create --title "{title}" --body "{body}"
10. Report: Include PR URL in output

CRITICAL: Build MUST pass before commit. Retry up to 3 times.
```

---

### 4. How should build failures be handled?

**Decision**: Retry loop with error context, max 3 attempts, then block for human review

**Rationale**:
- Many build errors are simple fixes (typos, missing imports)
- Agent should attempt self-correction before blocking
- Human checkpoint prevents infinite loops

**Retry Flow**:
```
attempt = 1
while attempt <= 3:
    result = run_build()
    if result.success:
        proceed_to_commit()
        break
    else:
        analyze_error(result.stderr)
        apply_fix()
        attempt += 1

if attempt > 3:
    mark_blocked("Build failed after 3 attempts")
    route_to_human_checkpoint()
```

---

### 5. How should QA verification access the real code?

**Decision**: Clone repo and checkout the PR branch using PR URL from task envelope

**Rationale**:
- PR URL is recorded in task envelope after implementation phase
- QA agent can extract branch name from PR metadata
- Running real tests provides actual pass/fail results

**Implementation**:
```bash
# Extract PR branch from URL
pr_number=$(echo $pr_url | grep -oE '[0-9]+$')
branch=$(gh pr view $pr_number --json headRefName -q '.headRefName')

# Clone and checkout
gh repo clone {repository} /tmp/qa-workspace/{task-id}
cd /tmp/qa-workspace/{task-id}
git checkout $branch

# Run tests
npm test  # or appropriate test command
```

---

### 6. How should code review access the PR diff?

**Decision**: Use `gh pr diff` to fetch actual code changes

**Rationale**:
- GitHub CLI provides direct access to PR diff
- No need to clone full repo for review
- Diff includes file paths and line numbers

**Implementation**:
```bash
# Get PR diff
gh pr diff $pr_number --repo {repository}

# Get PR files list
gh pr view $pr_number --json files -q '.files[].path'
```

---

### 7. How should workspace cleanup be managed?

**Decision**: Cleanup at end of agent execution, with periodic cleanup job as backup

**Rationale**:
- Immediate cleanup prevents disk exhaustion
- Backup cleanup handles cases where agent terminates unexpectedly
- Simple directory removal is sufficient for temp directories

**Implementation** (in n8n workflow post-processing):
```javascript
// Cleanup workspace after agent completes
const { spawnSync } = require('child_process');
spawnSync('rm', ['-rf', `/tmp/workspace/${taskId}`]);
```

**Backup Cleanup** (hourly cron):
```bash
find /tmp/workspace -maxdepth 1 -mmin +60 -type d -exec rm -rf {} \;
```

---

## Summary of Decisions

| Question | Decision |
|----------|----------|
| Repository cloning | GitHub CLI with existing App tokens |
| Build detection | File-based heuristics with prompt fallback |
| Prompt structure | Explicit 10-step mandatory workflow |
| Build failure handling | 3-attempt retry, then block for human |
| QA verification | Clone repo, checkout PR branch, run tests |
| Code review | Use `gh pr diff` for actual diff |
| Workspace cleanup | Post-execution cleanup + hourly cron backup |

All NEEDS CLARIFICATION items resolved. Ready for Phase 1.
