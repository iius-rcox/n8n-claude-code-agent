# Research: Dynamic Repository Dropdown

**Feature**: 012-dynamic-repo-dropdown
**Date**: 2026-01-20

## Research Questions

### RQ-1: How to implement dynamic dropdown options in n8n Form Trigger?

**Decision**: Use multi-step form architecture with n8n Form node's "Define Form Using JSON" capability

**Rationale**:
- n8n Form Trigger's dropdown options are statically defined at design-time
- n8n Form (continuation node) supports "Define Form > Using JSON" allowing dynamic field generation
- A two-step workflow can: (1) trigger with minimal fields, (2) fetch repos, (3) render second form page with dynamic dropdown

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Query parameters to pre-populate | Requires external system to build URL with all repos encoded - shifts complexity outside n8n |
| Custom HTML form outside n8n | Loses n8n form benefits (styling, validation, integration) - significant additional development |
| Static dropdown with manual updates | Doesn't meet requirement for automatic sync with org repos |
| Webhook with custom frontend | Over-engineered for the use case |

### RQ-2: How to fetch GitHub organization repositories?

**Decision**: Use GitHub REST API via n8n HTTP Request node with GitHub App authentication

**Rationale**:
- GitHub REST API `GET /orgs/{org}/repos` returns all repos the authenticated app can access
- n8n HTTP Request node can make authenticated API calls using environment variables
- GitHub App installation token (per CLAUDE.md) is already configured for the ii-us org
- API supports filtering by `type=all` and sorting by `full_name` (alphabetical)

**API Endpoint**:
```
GET https://api.github.com/orgs/ii-us/repos?type=all&sort=full_name&per_page=100
```

**Response filtering needed**:
- Filter out `archived: true` repos
- Map to dropdown format: `{ option: repo.full_name }`

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| GraphQL API | More complex for simple list retrieval, REST is sufficient |
| Hardcoded list | Doesn't meet dynamic requirement |
| GitHub MCP server | Would require additional MCP setup in n8n environment |

### RQ-3: How to handle authentication for GitHub API in n8n?

**Decision**: Use environment variable `$env.GITHUB_TOKEN` with Bearer authentication

**Rationale**:
- n8n already uses environment variables for secrets (e.g., `$env.AZURE_STORAGE_SAS_TOKEN`)
- GitHub App installation token can be stored as `GITHUB_TOKEN` environment variable
- Simple Bearer token auth works for GitHub REST API

**Implementation**:
```javascript
// n8n HTTP Request node header
Authorization: Bearer {{ $env.GITHUB_TOKEN }}
```

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| n8n GitHub credential | Would need to set up OAuth app - more complex than env var |
| Hardcoded token | Security risk, not suitable for production |

### RQ-4: How to implement search/filter functionality?

**Decision**: Use n8n Form's native dropdown with filtering (browser-side)

**Rationale**:
- n8n Form dropdown with many options already supports type-to-filter in browser
- No server-side implementation needed for P2 requirement
- If native filtering is insufficient, can revisit with Custom HTML select2/chosen

**Testing needed**: Verify n8n dropdown supports type-ahead filtering natively

### RQ-5: How to handle error states and fallback?

**Decision**: Implement IF node to check API response, branch to fallback text input on failure

**Rationale**:
- n8n IF node can check `{{ $json.statusCode }}` or array length
- On failure path, render form with text input field instead of dropdown
- Form node's JSON definition can be dynamically chosen based on success/failure

**Flow**:
```
Form Trigger → Fetch Repos → IF (success?)
                              ├─ Yes → Form with dropdown
                              └─ No  → Form with text input + error message
```

## Technical Architecture

### Workflow Structure (Updated)

```
[Form Trigger: Step 1]          # Title, Description, Priority, Acceptance Criteria
        │
        ▼
[HTTP Request: Fetch Repos]     # GET /orgs/ii-us/repos
        │
        ▼
[Code: Transform Response]      # Filter archived, format for dropdown
        │
        ▼
[IF: Repos Loaded?]
   │         │
   ▼         ▼
[Form: With Dropdown]    [Form: With Text Input + Error]
        │                        │
        └────────┬───────────────┘
                 ▼
[Code: Generate Task Envelope]   # Existing logic
        │
        ▼
[... rest of existing workflow ...]
```

### Form Field JSON Schema (Dynamic)

```javascript
// Success case - dropdown with repos
[
  {
    "fieldLabel": "Target Repository",
    "fieldType": "dropdown",
    "fieldOptions": {
      "values": $json.repos.map(r => ({ option: r.full_name }))
    },
    "requiredField": true
  }
]

// Fallback case - text input
[
  {
    "fieldLabel": "Target Repository",
    "fieldType": "text",
    "placeholder": "https://github.com/ii-us/repo-name",
    "requiredField": true
  }
]
```

## Key Findings

1. **n8n Form node supports JSON-defined forms** - This is the key enabler for dynamic dropdowns
2. **Two-step form required** - Cannot dynamically populate Form Trigger, must use Form continuation
3. **GitHub App token available** - Per CLAUDE.md, authentication mechanism already exists
4. **Filtering is browser-native** - n8n dropdowns support type-to-filter without additional work
5. **Error fallback straightforward** - IF node branching handles graceful degradation

## Dependencies Identified

| Dependency | Status | Notes |
|------------|--------|-------|
| GitHub App installation token | Assumed available | Per CLAUDE.md, exists as `GITHUB_TOKEN` env var |
| n8n Form node | Available | Part of n8n core nodes |
| n8n HTTP Request node | Available | Already used in workflow |
| GitHub REST API | Available | Public API, auth required for private repos |

## Risks

| Risk | Mitigation |
|------|------------|
| GitHub API rate limiting (5000 req/hour) | Cache repo list if needed; low risk given form usage volume |
| Token expiration | Monitor and refresh GitHub App token as needed |
| Many repos (>100) | Paginate API calls; implement virtual scrolling if UX degraded |
