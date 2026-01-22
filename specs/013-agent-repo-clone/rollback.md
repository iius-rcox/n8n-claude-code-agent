# Rollback Documentation: Agent Repository Clone Feature

**Feature**: 013-agent-repo-clone
**Created**: 2026-01-20

This document provides procedures to rollback the real code workflow changes if issues are encountered.

---

## Overview

The 013-agent-repo-clone feature modified three n8n workflows to enable real code execution:

| Workflow | Changes | Backup Location |
|----------|---------|-----------------|
| Dev Implementation | Clone repo, build verification, PR creation | `backups/dev-implementation.json` |
| QA Verification | Clone repo, real test execution | `backups/qa-verification.json` |
| Reviewer | PR diff review | `backups/reviewer.json` |

---

## Rollback Procedures

### Option 1: Full Rollback (Restore Original Workflows)

Use this if the entire real-code workflow needs to be reverted.

#### Step 1: Access n8n
```
URL: https://n8n.ii-us.com
```

#### Step 2: Restore Dev Implementation Workflow
1. Navigate to **Agent Dev Team - Dev Implementation** workflow
2. Open Settings → Import from File
3. Upload `specs/013-agent-repo-clone/backups/dev-implementation.json`
4. Save and activate workflow

#### Step 3: Restore QA Verification Workflow
1. Navigate to **Agent Dev Team - QA Verification** workflow
2. Open Settings → Import from File
3. Upload `specs/013-agent-repo-clone/backups/qa-verification.json`
4. Save and activate workflow

#### Step 4: Restore Reviewer Workflow
1. Navigate to **Agent Dev Team - Reviewer** workflow
2. Open Settings → Import from File
3. Upload `specs/013-agent-repo-clone/backups/reviewer.json`
4. Save and activate workflow

#### Step 5: Verify Rollback
- Submit a test feature request
- Confirm agents use document-based simulation (no `gh` commands)

---

### Option 2: Partial Rollback (Specific Components)

#### Disable Build Verification Only
In the Dev Implementation workflow, edit the "Build Implementation Prompt" node:
1. Remove Step 6 (Build Verification - CRITICAL)
2. Remove the 3-retry logic section
3. Keep clone/branch/PR creation intact

#### Disable Real Test Execution (QA)
In the QA Verification workflow, edit the "Build Verification Prompt" node:
1. Remove Step 5 (Run Tests - CRITICAL - MANDATORY)
2. Replace with simulated test assertion checking
3. Keep PR checkout and review intact

#### Disable PR Diff Review
In the Reviewer workflow, edit the "Build Review Prompt" node:
1. Remove Step 3 (Review PR Diff)
2. Revert to spec.md document-based review
3. Keep verdict routing intact

---

### Option 3: Timeout Rollback

If extended timeouts cause issues, reduce `timeout_ms` parameter:

#### In Each Workflow (Dev, QA, Reviewer):
1. Find the "Call Agent Runner" node
2. Edit the input parameters
3. Change `timeout_ms` from `3600000` to `300000` (5 minutes)

---

## Verification Checklist

After rollback, verify:

- [ ] Agents complete within expected timeframes
- [ ] No `gh repo clone` commands in agent output
- [ ] No `gh pr diff` commands in agent output
- [ ] Verification reports show simulated test assertions
- [ ] Review reports reference spec.md, not actual code

---

## Backup File Locations

All original workflow JSON files are stored in:
```
specs/013-agent-repo-clone/backups/
├── dev-implementation.json     # Original Dev workflow
├── qa-verification.json        # Original QA workflow
├── reviewer.json               # Original Reviewer workflow
└── agent-runner.json           # Agent Runner (unchanged)
```

---

## Emergency Contacts

If rollback fails or causes additional issues:
1. Check n8n execution logs for specific errors
2. Review Azure Blob state in `agent-state` container
3. Contact infrastructure team for AKS/container issues

---

## CLAUDE.md Rollback

To revert CLAUDE.md documentation changes, restore the "Autonomous Dev Team" section to its original form (prior to the "Agent Workflow: Real Code Execution" subsection).

The original section documented only:
- Agent roles and phases table
- Submit Feature Request form URL
- Track Task Progress dashboard URL
- n8n Workflow URLs (Stage 1 only)

Remove the following subsections:
- "Agent Workflow: Real Code Execution"
- "Verdict Routing"
- "GitHub Authentication"
- "Task Envelope Schema"
- "Timeouts"
- Stage 3 and Stage 4 workflow references
