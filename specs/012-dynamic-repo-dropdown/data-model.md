# Data Model: Dynamic Repository Dropdown

**Feature**: 012-dynamic-repo-dropdown
**Date**: 2026-01-20

## Entities

### Repository (from GitHub API)

Represents a GitHub repository fetched from the organization.

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| id | number | GitHub repository ID | GitHub API |
| name | string | Repository name (e.g., "n8n-claude-code-agent") | GitHub API |
| full_name | string | Full repository path (e.g., "ii-us/n8n-claude-code-agent") | GitHub API |
| html_url | string | Repository URL (e.g., "https://github.com/ii-us/n8n-claude-code-agent") | GitHub API |
| archived | boolean | Whether repository is archived | GitHub API |
| visibility | string | "public" or "private" | GitHub API |

**Validation Rules**:
- `archived` must be `false` to appear in dropdown
- `full_name` must be non-empty

### DropdownOption (n8n Form Format)

Represents a single option in the n8n Form dropdown.

| Field | Type | Description |
|-------|------|-------------|
| option | string | Display value and selection value |

**Transformation**: `Repository` → `DropdownOption`
```javascript
repo => ({ option: repo.full_name })
```

### FormFieldDefinition (n8n JSON Form)

Represents a single field in the n8n Form JSON definition.

| Field | Type | Description |
|-------|------|-------------|
| fieldLabel | string | Label shown above field |
| fieldType | string | "dropdown" or "text" |
| fieldOptions | object | (dropdown only) Contains `values` array |
| fieldOptions.values | DropdownOption[] | Array of dropdown options |
| placeholder | string | (text only) Placeholder text |
| requiredField | boolean | Whether field is required |

### TaskEnvelope (Existing - Modified)

The `repository` field already exists in the Task Envelope. No schema change needed.

| Field | Type | Current | After |
|-------|------|---------|-------|
| repository | string | Full URL or path | Full name (e.g., "ii-us/repo-name") |

**Note**: The "Generate Task ID & Envelope" code node already handles both formats:
```javascript
repository: body.repository || body['Target Repository'] || 'ii-us/n8n-claude-code-agent'
```

## State Transitions

```
Form Load
    │
    ▼
Fetch Repositories ─────────────────────┐
    │                                   │
    ▼                                   ▼
 Success                            Failure
    │                                   │
    ▼                                   ▼
Repository[]                     Empty Array
    │                                   │
    ▼                                   ▼
Filter (archived=false)          Show Error Message
    │                                   │
    ▼                                   ▼
Sort (alphabetical)              Fallback Text Input
    │                                   │
    ▼                                   ▼
Transform to DropdownOption[]    Manual Entry
    │                                   │
    ▼                                   ▼
Render Form with Dropdown        Render Form with Text
    │                                   │
    └───────────┬───────────────────────┘
                ▼
          User Selection
                │
                ▼
          Form Submission
                │
                ▼
          Task Envelope Created
```

## Data Flow Diagram

```
GitHub API                 n8n Workflow                    Form UI
    │                          │                              │
    │   GET /orgs/ii-us/repos  │                              │
    │<─────────────────────────│                              │
    │                          │                              │
    │   Repository[]           │                              │
    │─────────────────────────>│                              │
    │                          │                              │
    │                          │  Filter & Transform          │
    │                          │──────────────┐               │
    │                          │              │               │
    │                          │<─────────────┘               │
    │                          │                              │
    │                          │  FormFieldDefinition[]       │
    │                          │─────────────────────────────>│
    │                          │                              │
    │                          │                              │  User selects
    │                          │                              │  repository
    │                          │                              │
    │                          │  Selected: "ii-us/repo"      │
    │                          │<─────────────────────────────│
    │                          │                              │
    │                          │  Create TaskEnvelope         │
    │                          │──────────────┐               │
    │                          │              │               │
    │                          │<─────────────┘               │
    │                          │                              │
```
