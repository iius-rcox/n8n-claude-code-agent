# Data Models Codemap

**Freshness:** 2026-01-26T00:00:00Z

## Execution Types

**File:** `dashboard/backend/src/types/execution.ts`

```typescript
type ExecutionStatus = 'success' | 'error' | 'auth_failure' | 'timeout' | 'running'

interface ExecutionRecord {
  id: string                    // UUID
  prompt: string                // Up to 100KB
  status: ExecutionStatus
  exitCode?: number
  output?: string
  errorMessage?: string
  startedAt: string            // ISO timestamp
  completedAt?: string
  durationMs?: number
}

interface ExecutionRequest {
  prompt: string                // Required, validated
}

interface ExecutionResponse {
  id: string
  status: ExecutionStatus
  exitCode?: number
  output?: string
  errorMessage?: string
  durationMs?: number
}
```

## Kubernetes Types

**File:** `dashboard/backend/src/types/cronjob.ts`

```typescript
interface PodHealth {
  name: string
  phase: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown'
  readyContainers: number
  totalContainers: number
  restartCount: number
  lastRestartTime?: string
}

interface CronJobInfo {
  name: string
  schedule: string
  lastScheduleTime?: string
  lastSuccessfulTime?: string
  activeJobs: number
  suspended: boolean
}

interface JobInfo {
  name: string
  cronJobName: string
  startTime?: string
  completionTime?: string
  status: 'running' | 'succeeded' | 'failed'
  exitCode?: number
  durationMs?: number
}
```

## Health Types

**File:** `dashboard/backend/src/types/health.ts`

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  pods: PodHealth[]
  timestamp: string
}

interface AuthStatus {
  authenticated: boolean
  expiresAt?: string
  lastChecked: string
}
```

## Token Refresh Types

**File:** `dashboard/backend/src/types/token-refresh.ts`

```typescript
type RefreshStep =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'updating_secret'
  | 'restarting_pod'
  | 'verifying'
  | 'complete'
  | 'error'

interface RefreshStatus {
  step: RefreshStep
  progress: number              // 0-100
  message: string
  error?: string
  startedAt?: string
  completedAt?: string
}
```

## API Response Patterns

```typescript
// Success response
{ data: T, success: true }

// Error response
{ error: string, success: false, code?: number }

// Paginated response
{ data: T[], total: number, page: number, pageSize: number }
```

## Storage

- **Execution Store:** In-memory (ExecutionStoreService)
- **Credentials:** Kubernetes Secrets (mounted volumes)
- **Session:** Browser sessionStorage (MSAL cache)

## Validation Rules

| Field | Constraint |
|-------|------------|
| prompt | Required, max 100KB |
| exitCode | Integer 0-255 |
| timestamps | ISO 8601 format |
| UUID | v4 format |
