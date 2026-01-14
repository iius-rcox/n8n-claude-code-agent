# Data Model: Claude Session Tokens

**Feature**: 003-claude-session-tokens
**Date**: 2026-01-14

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Local Machine                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 User Profile ($env:USERPROFILE)                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    .claude/ directory                        │   │   │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │   │   │
│  │  │  │ Session Token │  │  Config File  │  │  Other Files  │   │   │   │
│  │  │  │    Files      │  │               │  │               │   │   │   │
│  │  │  └───────────────┘  └───────────────┘  └───────────────┘   │   │   │
│  │  └──────────────────────────────┬──────────────────────────────┘   │   │
│  └─────────────────────────────────┼──────────────────────────────────┘   │
│                                    │                                       │
│                                    │ kubectl create secret                 │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              claude-session-secret.yaml (local file)                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  apiVersion: v1                                              │   │   │
│  │  │  kind: Secret                                                │   │   │
│  │  │  metadata:                                                   │   │   │
│  │  │    name: claude-session                                      │   │   │
│  │  │  type: Opaque                                                │   │   │
│  │  │  data:                                                       │   │   │
│  │  │    <filename>: <base64-encoded-content>                      │   │   │
│  │  │    ...                                                       │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │
                                      │ (Sprint 5: kubectl apply)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Kubernetes Cluster                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    claude-agent namespace                            │   │
│  │  ┌─────────────────┐         ┌─────────────────────────────────┐   │   │
│  │  │ Secret:         │────────▶│      Pod Volume Mount           │   │   │
│  │  │ claude-session  │  mount  │  /home/claude-agent/.claude/    │   │   │
│  │  └─────────────────┘         └─────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entities

### Session Token Files

| Attribute | Type | Description |
|-----------|------|-------------|
| Location | Path | `$env:USERPROFILE\.claude` on Windows |
| Contents | Binary/Text | Authentication tokens and configuration |
| Lifecycle | Ephemeral | Created on login, expire after period |
| Access | User-only | Stored in user profile, readable by owner |

**Lifecycle**:
1. Created when user runs `claude login`
2. Updated on subsequent authentications
3. Invalidated when user runs `claude logout`
4. Expire after server-defined period (requires re-login)

### Kubernetes Secret

| Attribute | Type | Description |
|-----------|------|-------------|
| Name | String | `claude-session` |
| Namespace | String | `claude-agent` (applied in Sprint 5) |
| Type | String | `Opaque` |
| Data | Map | Key-value pairs of filename → base64 content |

**Lifecycle**:
1. Generated locally via `kubectl create secret --dry-run`
2. Saved to `claude-session-secret.yaml`
3. Applied to cluster in Sprint 5
4. Mounted into pod as files
5. Replaced when tokens expire and new secret applied

### YAML File (Output Artifact)

| Attribute | Type | Description |
|-----------|------|-------------|
| Filename | String | `claude-session-secret.yaml` |
| Location | Path | Repository root (temporary) |
| Git Status | Ignored | Listed in `.gitignore` |
| Security | Sensitive | Contains base64-encoded tokens |

**Lifecycle**:
1. Created by `kubectl create secret --dry-run -o yaml`
2. Stored temporarily in repository root
3. Applied to cluster in Sprint 5
4. Should be deleted after successful apply

## Relationships

| From | To | Cardinality | Description |
|------|-----|-------------|-------------|
| .claude directory | Session files | 1:N | One directory contains multiple files |
| Session files | Kubernetes Secret | N:1 | All files bundled into one secret |
| Kubernetes Secret | Pod | 1:N | One secret mounted by multiple pods |

## State Transitions

### Session Token Lifecycle

```
[No Session] ──login──▶ [Active Session] ──logout──▶ [No Session]
                              │
                              │ time passes
                              ▼
                        [Expired Session] ──login──▶ [Active Session]
```

### Secret YAML Lifecycle

```
[Not Exists] ──kubectl create──▶ [Generated] ──kubectl apply──▶ [Applied to Cluster]
                                      │                               │
                                      │                               │
                                      └────── delete local file ──────┘
```

## Validation Rules

| Entity | Rule | Error |
|--------|------|-------|
| .claude directory | Must exist before export | "Run claude login first" |
| Session files | Must have non-zero size | "Session files corrupted" |
| Test prompt | Must return success | "Authentication failed" |
| Secret YAML | Must contain data keys | "Invalid secret structure" |
| Git status | YAML must be ignored | "Secret exposed in git" |
