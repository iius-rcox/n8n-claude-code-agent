# Data Model: Docker Image

**Feature**: 004-docker-image
**Date**: 2026-01-14

## Overview

This feature creates container artifacts rather than persistent data entities. The "data model" describes the request/response structures for the HTTP API and the configuration entities.

## Entities

### Container Image

The deployable artifact containing all tools and scripts.

| Attribute | Type | Description |
|-----------|------|-------------|
| registry | string | Azure Container Registry URL (`iiusacr.azurecr.io`) |
| repository | string | Image repository name (`claude-agent`) |
| tag | string | Semantic version tag (`v4.6.2`) |
| digest | string | SHA256 content digest (immutable reference) |

**Full Image Reference**: `iiusacr.azurecr.io/claude-agent:v4.6.2`

### HTTP Server

Lightweight server handling health checks and prompt execution.

| Attribute | Type | Description |
|-----------|------|-------------|
| port | number | Listening port (3000) |
| host | string | Bind address (0.0.0.0) |
| activeRequests | number | Count of in-flight requests |
| isShuttingDown | boolean | Graceful shutdown flag |

### Health Response

Response structure for `/health` endpoint.

| Field | Type | Description |
|-------|------|-------------|
| status | string | "healthy" or "shutting_down" |
| timestamp | string | ISO 8601 timestamp |
| activeRequests | number | Current in-flight request count |

**Example**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T10:30:00Z",
  "activeRequests": 0
}
```

### Run Request

Request structure for `/run` endpoint.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | The prompt text to send to Claude |
| timeout | number | No | Timeout in milliseconds (default: 300000) |
| workdir | string | No | Working directory for Claude (default: /home/claude-agent) |

**Example**:
```json
{
  "prompt": "List the files in the current directory",
  "timeout": 60000,
  "workdir": "/workspace"
}
```

### Run Response

Response structure for `/run` endpoint.

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether the prompt completed successfully |
| output | string | Claude's response output |
| exitCode | number | Process exit code |
| duration | number | Execution time in milliseconds |
| error | string | Error message (only if success=false) |

**Success Example**:
```json
{
  "success": true,
  "output": "file1.txt\nfile2.txt\n",
  "exitCode": 0,
  "duration": 2340
}
```

**Error Example**:
```json
{
  "success": false,
  "output": "",
  "exitCode": 57,
  "duration": 1200,
  "error": "Authentication failed - session tokens expired"
}
```

### Auth Check Result

Result structure for authentication monitoring.

| Field | Type | Description |
|-------|------|-------------|
| authenticated | boolean | Whether Claude authentication succeeded |
| exitCode | number | Script exit code (0=success, 57=auth failure) |
| timestamp | string | ISO 8601 timestamp |
| notificationSent | boolean | Whether Teams notification was triggered |

### Teams Notification

Notification payload for authentication failures.

| Field | Type | Description |
|-------|------|-------------|
| @type | string | "MessageCard" |
| summary | string | Brief alert description |
| themeColor | string | Color indicator ("FF0000" for error) |
| sections | array | Message content sections |
| potentialAction | array | Action buttons |

## State Transitions

### Server Lifecycle

```
STARTING → RUNNING → SHUTTING_DOWN → STOPPED
    ↓          ↓           ↓
  (error)   (SIGTERM)   (requests=0)
```

### Request Lifecycle

```
RECEIVED → PROCESSING → COMPLETED
    ↓           ↓
  (parse   (timeout/
   error)   error)
```

## Validation Rules

### Run Request Validation

| Field | Rule | Error Response |
|-------|------|----------------|
| prompt | Required, non-empty string | 400: "prompt is required" |
| prompt | Max length 100,000 chars | 400: "prompt exceeds maximum length" |
| timeout | If present, must be positive integer | 400: "timeout must be positive integer" |
| timeout | Max value 600,000 (10 minutes) | 400: "timeout exceeds maximum" |
| workdir | If present, must be absolute path | 400: "workdir must be absolute path" |

### Health Response Codes

| HTTP Status | Condition |
|-------------|-----------|
| 200 | Server healthy |
| 503 | Server shutting down |

### Run Response Codes

| HTTP Status | Condition |
|-------------|-----------|
| 200 | Request processed (check success field) |
| 400 | Invalid request body |
| 500 | Internal server error |
| 503 | Server shutting down |

## Relationships

```
Container Image
    │
    ├── contains → HTTP Server (server.js)
    │                  │
    │                  ├── exposes → /health endpoint
    │                  └── exposes → /run endpoint
    │
    ├── contains → Auth Check Script (check-auth.sh)
    │                  │
    │                  └── triggers → Notification Script
    │
    └── contains → Notification Script (notify.sh)
                       │
                       └── sends → Teams Webhook
```
