# Data Model: Operations Dashboard

**Feature Branch**: `009-ops-dashboard`
**Date**: 2026-01-16

## Overview

The Operations Dashboard uses primarily transient data fetched from Kubernetes APIs and the Claude agent service. No persistent database is required. This document defines the TypeScript interfaces for data entities.

---

## Entities

### 1. HealthStatus

Represents the current health state of a system component.

```typescript
interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending';
  lastChecked: string; // ISO 8601 timestamp
  details: HealthDetails;
}

interface HealthDetails {
  // Pod-specific
  phase?: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers?: number;
  totalContainers?: number;
  restartCount?: number;
  lastRestartTime?: string;

  // Auth-specific
  authenticated?: boolean;
  exitCode?: number;
  lastFailureTime?: string;
  expiryEstimate?: string;

  // CronJob-specific
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs?: number;
}
```

**Source**: Kubernetes API (`/api/v1/namespaces/claude-agent/pods`, `/apis/batch/v1/namespaces/claude-agent/cronjobs`)

**Refresh**: Every 30 seconds via polling

---

### 2. TokenRefreshOperation

Represents a token refresh workflow execution with multi-step progress.

```typescript
interface TokenRefreshOperation {
  id: string; // UUID
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string; // ISO 8601
  endTime?: string;
  currentStep: TokenRefreshStep;
  steps: StepStatus[];
  error?: TokenRefreshError;
}

type TokenRefreshStep =
  | 'waiting_credentials'
  | 'deleting_secret'
  | 'creating_secret'
  | 'restarting_deployment'
  | 'verifying_auth'
  | 'complete';

interface StepStatus {
  step: TokenRefreshStep;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  message?: string;
}

interface TokenRefreshError {
  step: TokenRefreshStep;
  message: string;
  details?: string;
  remediation?: string;
}

// Standard remediation messages for each step
const REMEDIATION_MESSAGES: Record<TokenRefreshStep, string> = {
  waiting_credentials: 'Ensure you ran `claude /login` successfully before running the push script.',
  deleting_secret: 'Check RBAC permissions: service account needs delete permission on secrets in claude-agent namespace.',
  creating_secret: 'Check RBAC permissions: service account needs create permission on secrets in claude-agent namespace.',
  restarting_deployment: 'Check RBAC permissions: service account needs patch permission on deployments in claude-agent namespace.',
  verifying_auth: 'Credentials may be invalid or expired. Run `claude /login` again and retry the push.',
  complete: '', // No remediation needed for success
};
```

**Lifecycle**:
1. `waiting_credentials` - Dashboard displays CLI command, waiting for push
2. `deleting_secret` - Deleting old `claude-session` secret
3. `creating_secret` - Creating new secret with pushed credentials
4. `restarting_deployment` - Patching deployment to trigger rollout
5. `verifying_auth` - Running auth check against Claude
6. `complete` - Success

**Storage**: In-memory (server-side), WebSocket/polling for frontend updates

---

### 3. ExecutionRecord

Represents a Claude agent execution (manual or via n8n).

```typescript
interface ExecutionRecord {
  id: string;
  timestamp: string; // ISO 8601
  source: 'dashboard' | 'n8n' | 'cronjob';
  prompt: string; // Truncated to 200 chars for list view
  promptFull?: string; // Full prompt for detail view
  exitCode: number;
  duration: number; // milliseconds
  status: 'success' | 'error' | 'auth_failure' | 'timeout';
  output?: string; // Truncated for list view
  outputFull?: string; // Full output for detail view
  error?: string;
}

// Exit code mapping
const EXIT_CODE_STATUS: Record<number, ExecutionRecord['status']> = {
  0: 'success',
  1: 'error',
  57: 'auth_failure',
  124: 'timeout',
};
```

**Source**:
- Dashboard executions: Stored in-memory (last 50)
- n8n executions: n8n API (if available) or inferred from K8s events

**Retention**: Last 20 displayed, last 50 stored in memory

---

### 4. CronJobRun

Represents an auth watchdog CronJob execution.

```typescript
interface CronJobRun {
  jobName: string;
  cronJobName: string;
  startTime: string; // ISO 8601
  completionTime?: string;
  status: 'running' | 'succeeded' | 'failed';
  exitCode?: number;
  duration?: number; // milliseconds
}
```

**Source**: Kubernetes API (`/apis/batch/v1/namespaces/claude-agent/jobs`)

**Retention**: Last 5 displayed

---

### 5. User (Session)

Represents the authenticated operator.

```typescript
interface User {
  id: string; // Azure AD object ID
  email: string;
  displayName: string;
  groups: string[]; // Azure AD group IDs
  isAuthorized: boolean; // Member of authorized group
}

interface Session {
  user: User;
  accessToken: string;
  expiresAt: string; // ISO 8601
  refreshToken?: string;
}
```

**Source**: Azure AD via MSAL

**Storage**: Frontend sessionStorage (managed by MSAL)

---

### 6. CredentialsPush

Represents credentials pushed from CLI script.

```typescript
interface CredentialsPush {
  credentials: string; // JSON string from .credentials.json
  settings: string; // JSON string from settings.json
}

interface CredentialsPushRequest {
  credentials: string;
  settings: string;
}

interface CredentialsPushResponse {
  success: boolean;
  operationId?: string; // TokenRefreshOperation ID
  error?: string;
}
```

**Validation**:
- `credentials` must be valid JSON with `claudeAiOauth` object
- `settings` must be valid JSON
- Request must include valid session token (Azure AD)

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        User Session                         │
│  (Azure AD authenticated, group membership checked)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard Views                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Health Panel   │  Token Refresh  │  Agent Executor         │
│  HealthStatus[] │  TokenRefresh   │  ExecutionRecord        │
│                 │  Operation      │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│  CronJob Panel  │  Execution      │                         │
│  CronJobRun[]   │  History        │                         │
│                 │  ExecutionRec[] │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes API                           │
│  - Pods, Deployments, Secrets, Jobs, CronJobs              │
└─────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### TokenRefreshOperation State Machine

```
                    ┌──────────────────┐
                    │     pending      │
                    │ (created on UI   │
                    │  button click)   │
                    └────────┬─────────┘
                             │ CLI push received
                             ▼
                    ┌──────────────────┐
                    │   in_progress    │
                    │  (step: delete)  │
                    └────────┬─────────┘
                             │ success
                             ▼
                    ┌──────────────────┐
                    │   in_progress    │
                    │  (step: create)  │
                    └────────┬─────────┘
                             │ success
                             ▼
                    ┌──────────────────┐
                    │   in_progress    │
                    │ (step: restart)  │
                    └────────┬─────────┘
                             │ success
                             ▼
                    ┌──────────────────┐
                    │   in_progress    │
                    │  (step: verify)  │
                    └────────┬─────────┘
                   ┌─────────┴─────────┐
                   │                   │
            success│                   │failure
                   ▼                   ▼
          ┌──────────────┐    ┌──────────────┐
          │  completed   │    │    failed    │
          │              │    │ (with error) │
          └──────────────┘    └──────────────┘
```

### HealthStatus Determination

| Component | Condition | Status |
|-----------|-----------|--------|
| Pod | phase=Running, all containers ready | healthy |
| Pod | phase=Pending | pending |
| Pod | phase=Failed or any container not ready | unhealthy |
| Auth | Last check exit code 0 | healthy |
| Auth | Last check exit code 57 | unhealthy |
| Auth | No recent check | unknown |
| CronJob | lastSuccessfulTime within 35 min | healthy |
| CronJob | lastSuccessfulTime > 35 min ago | unhealthy |

---

## Data Validation Rules

### CredentialsPush Validation

```typescript
function validateCredentials(push: CredentialsPush): ValidationResult {
  const errors: string[] = [];

  // Parse credentials JSON
  let creds;
  try {
    creds = JSON.parse(push.credentials);
  } catch {
    errors.push('Invalid credentials JSON format');
  }

  // Check required fields
  if (creds && !creds.claudeAiOauth) {
    errors.push('Missing claudeAiOauth in credentials');
  }

  if (creds?.claudeAiOauth && !creds.claudeAiOauth.accessToken) {
    errors.push('Missing accessToken in claudeAiOauth');
  }

  // Parse settings JSON
  try {
    JSON.parse(push.settings);
  } catch {
    errors.push('Invalid settings JSON format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### ExecutionRecord Validation

```typescript
function validatePrompt(prompt: string): ValidationResult {
  const errors: string[] = [];

  if (!prompt || typeof prompt !== 'string') {
    errors.push('Prompt is required');
  }

  if (prompt.length > 100000) {
    errors.push('Prompt exceeds maximum length (100KB)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```
