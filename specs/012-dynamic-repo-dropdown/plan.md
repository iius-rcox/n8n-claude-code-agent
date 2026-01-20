# Implementation Plan: Dynamic Repository Dropdown

**Branch**: `012-dynamic-repo-dropdown` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-dynamic-repo-dropdown/spec.md`

## Summary

Replace the static text input for Target Repository in the Feature Request Form with a dynamic dropdown populated from the ii-us GitHub organization's active repositories. The implementation uses n8n's multi-step form architecture with a GitHub API integration to fetch repositories at form load time, with graceful fallback to text input on API failure.

## Technical Context

**Language/Version**: JavaScript (n8n Code nodes)
**Primary Dependencies**: n8n (workflow automation), GitHub REST API
**Storage**: Azure Blob Storage (existing - task envelopes)
**Testing**: Manual n8n workflow testing, form submission verification
**Target Platform**: n8n Cloud (n8n.ii-us.com)
**Project Type**: Workflow automation (n8n)
**Performance Goals**: Form loads with repository list within 3 seconds
**Constraints**: Must work with n8n Form Trigger limitations (no dynamic fields at trigger level)
**Scale/Scope**: ii-us organization (~10-50 repositories expected)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No project-specific constitution defined. Following general best practices:

| Principle | Status | Notes |
|-----------|--------|-------|
| Simplicity | ✅ Pass | Uses native n8n nodes, minimal custom code |
| Error Handling | ✅ Pass | Fallback to text input on API failure |
| Security | ✅ Pass | GitHub token stored in n8n environment variables |
| Testability | ✅ Pass | Each workflow step independently testable |

## Project Structure

### Documentation (this feature)

```text
specs/012-dynamic-repo-dropdown/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Technical research
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Implementation guide
├── contracts/           # Phase 1: API contracts
│   ├── github-repos-api.md
│   └── n8n-form-json-schema.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
n8n-workflows/
└── stage-1/
    └── feature-request-form.json    # Modified workflow export
```

**Structure Decision**: This feature modifies an existing n8n workflow rather than creating new source code files. The workflow JSON export will be stored in `n8n-workflows/stage-1/` for version control.

## Complexity Tracking

No violations requiring justification. Implementation uses:
- Native n8n nodes (HTTP Request, Code, IF, Form, Merge)
- Standard GitHub REST API
- Simple JavaScript for data transformation

## Implementation Approach

### Key Architecture Decision

**Problem**: n8n Form Trigger cannot dynamically populate dropdown options - they're defined at design time.

**Solution**: Use two-step form:
1. Step 1 (Form Trigger): Collect Title, Description, Priority, Acceptance Criteria
2. Step 2 (Form node): Dynamically render Target Repository dropdown using JSON form definition

### Workflow Modifications

```
BEFORE:
[Form Trigger (all fields)] → [Generate Task] → [Store] → [Notify] → [Merge] → [Response] → [Orchestrator]

AFTER:
[Form Trigger (Step 1)]
        │
        ▼
[HTTP: Fetch Repos from GitHub API]
        │
        ▼
[Code: Filter archived, format for dropdown]
        │
        ▼
[IF: Repos loaded successfully?]
        │
   ┌────┴────┐
   ▼         ▼
[Form:    [Form:
Dropdown] Fallback]
   │         │
   └────┬────┘
        ▼
[Generate Task] → [Store] → [Notify] → [Merge] → [Response] → [Orchestrator]
```

### New Nodes Required

| Node | Type | Purpose |
|------|------|---------|
| Fetch Organization Repos | HTTP Request | Call GitHub API |
| Transform Repo Response | Code | Filter archived, format for dropdown |
| Check Repos Loaded | IF | Branch for success/failure |
| Select Repository (Success) | Form | Dynamic dropdown |
| Select Repository (Fallback) | Form | Text input with error |
| Merge Form Results | Merge | Rejoin success/failure paths |

### Environment Requirements

| Variable | Value | Notes |
|----------|-------|-------|
| GITHUB_TOKEN | GitHub App installation token | Must have `repo` scope for ii-us org |

## Artifacts Generated

| Phase | Artifact | Path | Status |
|-------|----------|------|--------|
| 0 | Research | [research.md](./research.md) | ✅ Complete |
| 1 | Data Model | [data-model.md](./data-model.md) | ✅ Complete |
| 1 | GitHub API Contract | [contracts/github-repos-api.md](./contracts/github-repos-api.md) | ✅ Complete |
| 1 | Form JSON Schema | [contracts/n8n-form-json-schema.md](./contracts/n8n-form-json-schema.md) | ✅ Complete |
| 1 | Quickstart Guide | [quickstart.md](./quickstart.md) | ✅ Complete |
| 2 | Tasks | tasks.md | ⏳ Pending (`/speckit.tasks`) |

## Next Steps

Run `/speckit.tasks` to generate the actionable task list for implementation.
