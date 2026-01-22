# Quickstart: Agent Repository Clone and Real Code Workflow

**Feature**: 013-agent-repo-clone
**Branch**: `013-agent-repo-clone`

## Overview

This feature transforms the agent pipeline from document-based simulation to real code execution. After implementation, agents will:

1. **Clone** target repositories from GitHub
2. **Create** feature branches
3. **Run** actual builds and tests
4. **Create** real Pull Requests
5. **Review** actual code diffs

## Prerequisites

Verify the agent container has required tools:

```bash
# Check from inside the agent container
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl exec -n claude-agent deploy/claude-code-agent -- which gh git"
```

Expected output should show paths for both `gh` and `git`.

## Implementation Steps

### Step 1: Update Dev Implementation Workflow

Update the "Build Implementation Prompt" node in `Agent Dev Team - Dev Implementation` workflow:

```javascript
// Replace the existing systemPrompt with the new prompt from
// contracts/implementation-prompt.md
```

Key changes:
- Add explicit `gh repo clone` command
- Add mandatory build verification step
- Add explicit `gh pr create` command

### Step 2: Update QA Verification Workflow

Update the prompt in `Agent Dev Team - QA Verification` workflow:

```javascript
// Replace with the new prompt from
// contracts/verification-prompt.md
```

Key changes:
- Add `gh repo clone` and checkout PR branch
- Add mandatory `npm test` / `dotnet test` execution
- Include real test output in verification report

### Step 3: Update Reviewer Workflow

Update the prompt in `Agent Dev Team - Reviewer` workflow:

```javascript
// Replace with the new prompt from
// contracts/review-prompt.md
```

Key changes:
- Add `gh pr diff` to fetch actual code changes
- Require file:line references for issues
- Add CHANGES_REQUESTED verdict routing

### Step 4: Update Agent Runner Timeout

Extend timeout in `Agent Dev Team - Agent Runner` workflow to accommodate git operations:

```javascript
// In Call Claude Agent HTTP Request node
timeout_ms: 3600000  // 60 minutes (up from current value)
```

### Step 5: Add Workspace Cleanup

Add cleanup logic to each agent workflow's completion handler:

```javascript
// After agent execution completes
const taskId = $input.json.task_id;
const { spawnSync } = require('child_process');
spawnSync('rm', ['-rf', `/tmp/workspace/${taskId}`]);
spawnSync('rm', ['-rf', `/tmp/qa-workspace/${taskId}`]);
```

## Testing the Changes

### Test 1: Simple Implementation

1. Submit a feature request for a trivial change:
   - Repository: `https://github.com/iius-rcox/ExpenseTrack`
   - Description: "Add a comment to the README.md file"

2. Verify:
   - [ ] Agent clones the repository
   - [ ] Feature branch is created
   - [ ] Change is committed
   - [ ] PR is created with URL in output

### Test 2: Build Verification

1. Submit a feature request that requires code changes:
   - Repository: Any .NET or Node.js project
   - Description: "Add a new utility function"

2. Verify:
   - [ ] Agent runs build command
   - [ ] Build output is captured
   - [ ] PR only created if build passes

### Test 3: QA Verification

1. After a PR is created, observe QA phase:

2. Verify:
   - [ ] QA agent clones repo and checks out PR branch
   - [ ] Test command is executed
   - [ ] Report includes actual test output (not simulated)

### Test 4: Code Review

1. After QA passes, observe Review phase:

2. Verify:
   - [ ] Review agent uses `gh pr diff`
   - [ ] Feedback references specific file:line locations
   - [ ] Review is based on actual code, not spec documents

## Troubleshooting

### "gh: command not found"

The GitHub CLI is not installed in the agent container. Add to Dockerfile:

```dockerfile
RUN apk add --no-cache github-cli
```

### "Permission denied" when pushing

GitHub App tokens may not have write access. Verify in GitHub App settings:
- Repository permissions: Contents (Write)
- Repository permissions: Pull requests (Write)

### Build command not detected

Agent couldn't determine project type. Add explicit build instructions to the task specification.

### Disk space errors

Workspace cleanup not running. Check that cleanup logic executes in the workflow's finally block.

## Rollback

To revert to document-based behavior:

1. Restore original prompts in each workflow
2. Remove workspace cleanup logic
3. Reduce timeout back to original value

The changes are isolated to n8n workflow configurations and can be reverted by restoring previous workflow versions.
