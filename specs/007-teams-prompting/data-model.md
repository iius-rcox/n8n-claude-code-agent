# Data Model: Teams Prompting

**Feature**: 007-teams-prompting
**Date**: 2026-01-15

## Overview

This feature is primarily infrastructure configuration with minimal data entities. The main "data" is the CronJob configuration and Teams notification payload.

## Entities

### 1. CronJob Configuration

The `claude-auth-watchdog` CronJob defines the authentication monitoring schedule and execution parameters.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| name | string | CronJob identifier | `claude-auth-watchdog` |
| namespace | string | Kubernetes namespace | `claude-agent` |
| schedule | cron | Execution schedule | `*/30 * * * *` (every 30 min) |
| concurrencyPolicy | enum | Overlap handling | `Forbid` (no concurrent runs) |
| startingDeadlineSeconds | int | Max delay before skip | 300 (5 minutes) |
| backoffLimit | int | Retry attempts | 0 (no retries) |
| successfulJobsHistoryLimit | int | Completed jobs to keep | 3 |
| failedJobsHistoryLimit | int | Failed jobs to keep | 3 |

### 2. Teams Webhook Secret

Kubernetes Secret storing the Teams webhook URL.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| name | string | Secret identifier | `teams-webhook` |
| namespace | string | Kubernetes namespace | `claude-agent` |
| data.url | string | Webhook URL | Base64-encoded |

### 3. MessageCard Payload

JSON structure sent to Teams webhook on authentication failure.

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| @type | string | Card type | `MessageCard` |
| @context | string | Schema URL | `http://schema.org/extensions` |
| themeColor | string | Card border color | `FF0000` (red for alerts) |
| summary | string | Card title | Script argument |
| sections[0].activityTitle | string | Section header | `🔴 {title}` |
| sections[0].facts | array | Key-value pairs | Pod name, timestamp |
| sections[0].text | string | Message body | Script argument |
| potentialAction[0] | object | Action button | Link to docs |

### 4. n8n Request Payload

JSON structure for n8n HTTP Request to /run endpoint.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| prompt | string | Claude prompt text | Required, max 100KB |
| timeout | int | Execution timeout (ms) | Optional, max 600000 |
| workdir | string | Working directory | Optional, must be absolute path |

### 5. n8n Response Payload

JSON structure returned from /run endpoint.

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| success | boolean | Execution succeeded | true/false |
| output | string | Claude response text | May be empty on failure |
| exitCode | int | Process exit code | 0=success, 57=auth fail, 124=timeout |
| duration | int | Execution time (ms) | Always present |
| error | string | Error message | Only on failure |

## Relationships

```text
┌─────────────────────────┐
│  CronJob                │
│  (claude-auth-watchdog) │
└───────────┬─────────────┘
            │ runs
            ▼
┌─────────────────────────┐
│  Pod (Job instance)     │
│  - check-auth.sh        │
└───────────┬─────────────┘
            │ on failure
            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  notify.sh              │────▶│  Teams Webhook          │
│  (MessageCard payload)  │     │  (teams-webhook secret) │
└─────────────────────────┘     └─────────────────────────┘


┌─────────────────────────┐     ┌─────────────────────────┐
│  n8n Workflow           │────▶│  Claude Agent Service   │
│  (HTTP Request node)    │     │  (ClusterIP :3000)      │
└─────────────────────────┘     └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │  Claude CLI             │
                                │  (prompt execution)     │
                                └─────────────────────────┘
```

## State Transitions

### Authentication Check States

```text
┌──────────┐    check-auth.sh    ┌──────────────┐
│ CHECKING │─────────────────────▶│ AUTH_SUCCESS │
└────┬─────┘                      └──────────────┘
     │                                   │
     │ timeout/error                     │ exit 0
     │                                   │
     ▼                                   ▼
┌──────────────┐                  ┌──────────────┐
│ AUTH_FAILED  │                  │  NO ACTION   │
└──────┬───────┘                  └──────────────┘
       │
       │ notify.sh
       ▼
┌──────────────┐    exit 57      ┌──────────────┐
│ NOTIFICATION │─────────────────▶│  JOB DONE    │
│   SENT       │                  └──────────────┘
└──────────────┘
```

## Exit Code Reference

| Code | State | n8n Routing |
|------|-------|-------------|
| 0 | AUTH_SUCCESS | Continue workflow |
| 1 | GENERAL_ERROR | Alert operations |
| 57 | AUTH_FAILED | Pause workflows, alert |
| 124 | TIMEOUT | Retry or alert |
