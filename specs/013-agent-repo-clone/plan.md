# Implementation Plan: Agent Repository Clone and Real Code Workflow

**Branch**: `013-agent-repo-clone` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-agent-repo-clone/spec.md`

## Summary

Transform the agent pipeline from document-based simulation to real code execution. Agents will clone target repositories, create feature branches, run actual builds/tests, and create real GitHub Pull Requests. This addresses the fundamental gap where agents were reviewing specifications instead of actual code, causing issues like the `GlCode` vs `GLCode` case mismatch to slip through undetected.

## Technical Context

**Language/Version**: JavaScript (n8n Code nodes), Node.js 20+ (agent container)
**Primary Dependencies**: n8n workflows, Claude CLI, GitHub CLI (`gh`), Git
**Storage**: Azure Blob Storage (task envelopes), GitHub (code repositories)
**Testing**: Jest (this repo), project-specific test commands (target repos)
**Target Platform**: Linux containers (AKS), n8n workflow engine
**Project Type**: Workflow orchestration (n8n JSON) + container infrastructure
**Performance Goals**: Task completion under 60 minutes, build verification under 5 minutes
**Constraints**: Agent container disk space (~10GB), GitHub rate limits, 60-minute workflow timeout
**Scale/Scope**: Single task per agent instance, sequential processing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Simplicity | ✅ PASS | Modifying existing n8n workflows, no new infrastructure |
| Test-First | ✅ PASS | Build verification is the core feature |
| Integration | ✅ PASS | Uses existing GitHub App auth, blob storage |
| Observability | ✅ PASS | Build output captured in task artifacts |

No violations - proceeding with design.

## Project Structure

### Documentation (this feature)

```text
specs/013-agent-repo-clone/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (workflow JSON patches)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# n8n Workflows (modified via n8n API)
n8n Workflows:
├── Agent Dev Team - Dev Implementation    # Primary changes: add git clone, build, PR steps
├── Agent Dev Team - QA Verification       # Changes: clone repo, run real tests
├── Agent Dev Team - Reviewer              # Changes: fetch PR diff from GitHub
└── Agent Dev Team - Agent Runner          # Changes: extend timeout, add workspace cleanup

# No file system changes needed - all modifications are n8n workflow JSON
```

**Structure Decision**: This feature modifies existing n8n workflows via the n8n API. No new files are created in this repository. The changes are JSON patches to workflow node configurations.

## Complexity Tracking

> No violations to justify - implementation uses existing infrastructure.

| Aspect | Approach | Justification |
|--------|----------|---------------|
| Workflow modification | n8n API updates | Existing pattern, no new infrastructure |
| Git operations | Claude CLI executes git commands | Agent already has git installed |
| Build detection | Heuristic in prompt | Simple file existence checks |
