# Contract: GitHub Repositories API

**Feature**: 012-dynamic-repo-dropdown
**Date**: 2026-01-20
**Type**: External API (GitHub REST API v3)

## Endpoint

```
GET https://api.github.com/orgs/{org}/repos
```

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| org | string | Yes | Organization name (e.g., "ii-us") |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | "all" | Filter by repo type: "all", "public", "private", "forks", "sources", "member" |
| sort | string | "created" | Sort by: "created", "updated", "pushed", "full_name" |
| direction | string | "asc" (for full_name) | Sort direction: "asc", "desc" |
| per_page | number | 30 | Results per page (max 100) |
| page | number | 1 | Page number for pagination |

### Headers

| Header | Value | Required |
|--------|-------|----------|
| Authorization | Bearer {token} | Yes |
| Accept | application/vnd.github+json | Recommended |
| X-GitHub-Api-Version | 2022-11-28 | Recommended |

### Example Request

```http
GET https://api.github.com/orgs/ii-us/repos?type=all&sort=full_name&per_page=100
Authorization: Bearer {{ $env.GITHUB_TOKEN }}
Accept: application/vnd.github+json
```

## Response

### Success (200 OK)

```json
[
  {
    "id": 123456789,
    "name": "n8n-claude-code-agent",
    "full_name": "ii-us/n8n-claude-code-agent",
    "html_url": "https://github.com/ii-us/n8n-claude-code-agent",
    "description": "Claude Code Agent infrastructure",
    "private": true,
    "archived": false,
    "visibility": "private",
    "default_branch": "main",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2026-01-20T06:00:00Z"
  },
  {
    "id": 987654321,
    "name": "ops-dashboard",
    "full_name": "ii-us/ops-dashboard",
    "html_url": "https://github.com/ii-us/ops-dashboard",
    "description": "Operations dashboard",
    "private": true,
    "archived": false,
    "visibility": "private",
    "default_branch": "main",
    "created_at": "2024-06-01T12:00:00Z",
    "updated_at": "2026-01-19T18:00:00Z"
  }
]
```

### Relevant Fields for Feature

| Field | Type | Usage |
|-------|------|-------|
| full_name | string | Displayed in dropdown, stored in task envelope |
| archived | boolean | Filter out if `true` |
| visibility | string | May display indicator in UI (optional) |

### Error Responses

| Status | Meaning | Response |
|--------|---------|----------|
| 401 | Unauthorized | `{ "message": "Bad credentials" }` |
| 403 | Forbidden / Rate limited | `{ "message": "API rate limit exceeded" }` |
| 404 | Organization not found | `{ "message": "Not Found" }` |

## Rate Limits

- **Authenticated requests**: 5,000 per hour
- **Unauthenticated requests**: 60 per hour (not applicable - we use auth)

## Pagination

If organization has >100 repos:
- Response includes `Link` header with `next` and `last` URLs
- Must make multiple requests to fetch all repos

```
Link: <https://api.github.com/orgs/ii-us/repos?page=2>; rel="next",
      <https://api.github.com/orgs/ii-us/repos?page=3>; rel="last"
```

## n8n Implementation Notes

### HTTP Request Node Configuration

```json
{
  "method": "GET",
  "url": "https://api.github.com/orgs/ii-us/repos?type=all&sort=full_name&per_page=100",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "githubApi",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Accept",
        "value": "application/vnd.github+json"
      },
      {
        "name": "X-GitHub-Api-Version",
        "value": "2022-11-28"
      }
    ]
  }
}
```

Alternative using environment variable:
```json
{
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $env.GITHUB_TOKEN }}"
      }
    ]
  }
}
```
