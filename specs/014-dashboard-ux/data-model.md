# Data Model - Dashboard UX Improvements

**Feature**: 014-dashboard-ux
**Phase**: 1 - Data Model Definition
**Created**: 2026-01-21

## Overview

This document defines the TypeScript interfaces, types, and data structures for the Dashboard UX Improvements feature. All entities are designed for type safety, immutability where appropriate, and clear separation of concerns between frontend state management and backend API contracts.

## Core Entities

### Stuck Task Management

#### StuckTask

Represents a task that has been stuck in a single phase for longer than the threshold (30 minutes).

```typescript
interface StuckTask {
  id: string;
  title: string;
  currentPhase: TaskPhase;
  stuckSince: Date;
  stuckDuration: number; // milliseconds
  lastError?: TaskError;
  retryCount: number;
  escalationStatus?: EscalationStatus;
}

type TaskPhase =
  | 'intake'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'release';

interface TaskError {
  message: string;
  phase: TaskPhase;
  timestamp: Date;
  logs: string[];
  errorCode?: string;
  stackTrace?: string;
}

interface EscalationStatus {
  escalatedAt: Date;
  escalatedBy: string;
  teamsMessageId?: string;
  status: 'pending' | 'acknowledged' | 'resolved';
}
```

#### RetryResult

Response from task retry operation.

```typescript
interface RetryResult {
  status: 'retrying' | 'failed' | 'already-running';
  executionId?: string;
  message: string;
  error?: string;
}
```

#### TaskDiagnostics

Detailed diagnostic information for stuck task analysis.

```typescript
interface TaskDiagnostics {
  taskId: string;
  currentPhase: TaskPhase;
  stuckSince: Date;
  stuckDuration: number;
  lastError: TaskError;
  executionId: string;
  retryHistory: RetryAttempt[];
  upstreamErrors?: string[];
  systemState: {
    n8nStatus: 'healthy' | 'degraded' | 'down';
    agentStatus: 'healthy' | 'degraded' | 'down';
    storageStatus: 'healthy' | 'degraded' | 'down';
  };
}

interface RetryAttempt {
  timestamp: Date;
  result: 'success' | 'failure';
  message: string;
  executionId?: string;
}
```

### Token Expiration Tracking

#### TokenExpiration

Represents the current state of Claude API authentication tokens.

```typescript
interface TokenExpiration {
  method: 'session' | 'long-lived';
  expiresAt?: Date; // undefined for long-lived tokens
  remainingMs?: number; // undefined for long-lived tokens
  urgencyLevel: 'safe' | 'warning' | 'critical';
  lastRefreshed?: Date;
}

interface TokenStatus {
  authenticated: boolean;
  method: 'session' | 'long-lived';
  expiresAt?: string; // ISO 8601 timestamp
  error?: string;
}
```

### Task Age Visualization

#### TaskAge

Represents the age of a task within its current phase for heat map visualization.

```typescript
interface TaskAge {
  taskId: string;
  currentPhase: TaskPhase;
  enteredPhaseAt: Date;
  timeInPhase: number; // milliseconds
  ageCategory: AgeCategory;
  displayDuration: string; // Human-readable: "45m", "3h 20m", "2d"
}

type AgeCategory = 'new' | 'normal' | 'aging' | 'stale';

// Age category thresholds
const AGE_THRESHOLDS = {
  new: 0,           // 0-1 hour
  normal: 3600000,  // 1-4 hours
  aging: 14400000,  // 4-12 hours
  stale: 43200000   // 12+ hours
} as const;
```

### Bulk Component Operations

#### BulkActionState

Manages state for bulk operations on multiple components.

```typescript
interface BulkActionState {
  selectedComponentIds: string[];
  operation?: BulkOperation;
  results?: ComponentOperationResult[];
  inProgress: boolean;
}

type BulkOperation = 'restart' | 'view-logs' | 'delete';

interface ComponentOperationResult {
  componentId: string;
  componentName: string;
  status: 'success' | 'failure' | 'pending';
  message: string;
  timestamp: Date;
}

interface Component {
  id: string; // Format: "namespace/resource-type/name"
  name: string;
  type: 'pod' | 'deployment' | 'cronjob' | 'service';
  namespace: string;
  status: ComponentStatus;
  restartable: boolean;
}

type ComponentStatus =
  | 'Running'
  | 'Pending'
  | 'Failed'
  | 'CrashLoopBackOff'
  | 'Unknown';
```

### File Search

#### FileSearchState

Manages state for storage browser file search functionality.

```typescript
interface FileSearchState {
  query: string;
  filteredBlobs: BlobItem[];
  matchCount: number;
  totalCount: number;
  searchActive: boolean;
}

interface BlobItem {
  name: string; // Full path: "container/folder/file.json"
  container: string;
  size: number; // bytes
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface SearchMatch {
  blob: BlobItem;
  matchIndex: number; // Position of match in blob name
  matchLength: number;
}
```

## Frontend State Management

### Custom Hooks

The following custom hooks manage local component state:

```typescript
// Hook: useStuckTasks
interface UseStuckTasksReturn {
  stuckTasks: StuckTask[];
  retryTask: (taskId: string) => Promise<RetryResult>;
  showDiagnostics: (taskId: string) => Promise<TaskDiagnostics>;
  escalateTask: (taskId: string) => Promise<void>;
  isRetrying: boolean;
  error: string | null;
}

// Hook: useTokenExpiration
interface UseTokenExpirationReturn {
  expiration: TokenExpiration | null;
  refreshToken: () => void;
  isLoading: boolean;
  error: string | null;
}

// Hook: useTaskAge
interface UseTaskAgeReturn {
  taskAges: Map<string, TaskAge>;
  getTaskAge: (taskId: string) => TaskAge | undefined;
  refreshAges: () => void;
}

// Hook: useBulkActions
interface UseBulkActionsReturn {
  state: BulkActionState;
  selectComponent: (componentId: string) => void;
  deselectComponent: (componentId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  executeOperation: (operation: BulkOperation) => Promise<ComponentOperationResult[]>;
  isOperationInProgress: boolean;
}

// Hook: useFileSearch
interface UseFileSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  filteredBlobs: BlobItem[];
  matchCount: number;
  totalCount: number;
  clearSearch: () => void;
}
```

### TanStack Query Keys

Query keys for cache management:

```typescript
const queryKeys = {
  tasks: ['tasks'] as const,
  stuckTasks: ['tasks', 'stuck'] as const,
  taskDiagnostics: (taskId: string) => ['tasks', taskId, 'diagnostics'] as const,
  tokenStatus: ['auth', 'token-status'] as const,
  components: ['components'] as const,
  componentLogs: (componentId: string) => ['components', componentId, 'logs'] as const,
  blobs: (container: string) => ['storage', container, 'blobs'] as const,
};
```

## Backend API Response Types

### API Error Response

Standard error response format:

```typescript
interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
```

### Task Retry API

```typescript
// POST /api/tasks/:id/retry
interface RetryTaskRequest {
  // No body - task ID in URL params
}

interface RetryTaskResponse {
  status: 'retrying' | 'failed' | 'already-running';
  executionId?: string;
  message: string;
  taskId: string;
  timestamp: string; // ISO 8601
}
```

### Task Diagnostics API

```typescript
// GET /api/tasks/:id/diagnostics
interface GetDiagnosticsResponse {
  taskId: string;
  currentPhase: TaskPhase;
  stuckSince: string; // ISO 8601
  stuckDuration: number;
  lastError: {
    message: string;
    phase: TaskPhase;
    timestamp: string; // ISO 8601
    logs: string[];
    errorCode?: string;
    stackTrace?: string;
  };
  executionId: string;
  retryHistory: Array<{
    timestamp: string; // ISO 8601
    result: 'success' | 'failure';
    message: string;
    executionId?: string;
  }>;
  systemState: {
    n8nStatus: 'healthy' | 'degraded' | 'down';
    agentStatus: 'healthy' | 'degraded' | 'down';
    storageStatus: 'healthy' | 'degraded' | 'down';
  };
}
```

### Task Escalation API

```typescript
// POST /api/tasks/:id/escalate
interface EscalateTaskRequest {
  reason?: string;
}

interface EscalateTaskResponse {
  taskId: string;
  escalatedAt: string; // ISO 8601
  teamsMessageId: string;
  status: 'pending';
}
```

### Token Status API

```typescript
// GET /api/auth/status
interface GetTokenStatusResponse {
  authenticated: boolean;
  method: 'session' | 'long-lived';
  expiresAt?: string; // ISO 8601, undefined for long-lived
  lastRefreshed?: string; // ISO 8601
  error?: string;
}
```

### Bulk Component Operations API

```typescript
// POST /api/components/bulk-restart
interface BulkRestartRequest {
  componentIds: string[];
}

interface BulkRestartResponse {
  results: Array<{
    componentId: string;
    componentName: string;
    status: 'success' | 'failure' | 'pending';
    message: string;
    timestamp: string; // ISO 8601
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
  };
}

// POST /api/components/logs
interface GetBulkLogsRequest {
  componentIds: string[];
  lines?: number; // Default: 100
}

interface GetBulkLogsResponse {
  logs: Array<{
    componentId: string;
    componentName: string;
    lines: string[];
    timestamp: string; // ISO 8601
  }>;
}
```

## Validation Schemas

### Input Validation

Using Zod for runtime validation:

```typescript
import { z } from 'zod';

const TaskPhaseSchema = z.enum([
  'intake',
  'planning',
  'implementation',
  'verification',
  'review',
  'release'
]);

const RetryTaskRequestSchema = z.object({
  // No body params
});

const EscalateTaskRequestSchema = z.object({
  reason: z.string().optional()
});

const BulkRestartRequestSchema = z.object({
  componentIds: z.array(z.string()).min(1).max(50)
});

const GetBulkLogsRequestSchema = z.object({
  componentIds: z.array(z.string()).min(1).max(10),
  lines: z.number().int().min(1).max(1000).optional()
});
```

## Constants

```typescript
// Timing thresholds
export const STUCK_TASK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const TOKEN_WARNING_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
export const TOKEN_CRITICAL_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const TOKEN_POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

// Age category thresholds
export const TASK_AGE_THRESHOLDS = {
  new: 0,
  normal: 60 * 60 * 1000,       // 1 hour
  aging: 4 * 60 * 60 * 1000,    // 4 hours
  stale: 12 * 60 * 60 * 1000    // 12 hours
} as const;

// Performance targets
export const SEARCH_PERFORMANCE_TARGET_MS = 50;
export const AGE_CALCULATION_TARGET_MS = 10;

// Limits
export const MAX_BULK_RESTART_COMPONENTS = 50;
export const MAX_BULK_LOGS_COMPONENTS = 10;
export const MAX_LOG_LINES = 1000;
export const MAX_SEARCH_RESULTS = 1000;
```

## Type Guards

```typescript
export function isStuckTask(task: unknown): task is StuckTask {
  return (
    typeof task === 'object' &&
    task !== null &&
    'id' in task &&
    'stuckSince' in task &&
    'stuckDuration' in task &&
    task.stuckDuration >= STUCK_TASK_THRESHOLD_MS
  );
}

export function isTokenExpired(expiration: TokenExpiration): boolean {
  if (expiration.method === 'long-lived') return false;
  if (!expiration.remainingMs) return false;
  return expiration.remainingMs <= 0;
}

export function isTokenCritical(expiration: TokenExpiration): boolean {
  if (expiration.method === 'long-lived') return false;
  if (!expiration.remainingMs) return false;
  return expiration.remainingMs <= TOKEN_CRITICAL_THRESHOLD_MS;
}

export function getAgeCategory(timeInPhase: number): AgeCategory {
  if (timeInPhase < TASK_AGE_THRESHOLDS.normal) return 'new';
  if (timeInPhase < TASK_AGE_THRESHOLDS.aging) return 'normal';
  if (timeInPhase < TASK_AGE_THRESHOLDS.stale) return 'aging';
  return 'stale';
}
```

## Utility Functions

```typescript
// Duration formatting
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Component ID parsing
export function parseComponentId(componentId: string): {
  namespace: string;
  resourceType: string;
  name: string;
} {
  const [namespace, resourceType, name] = componentId.split('/');
  return { namespace, resourceType, name };
}

// Substring search with highlighting
export function highlightMatch(text: string, query: string): {
  before: string;
  match: string;
  after: string;
} {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return { before: text, match: '', after: '' };
  }

  return {
    before: text.slice(0, index),
    match: text.slice(index, index + query.length),
    after: text.slice(index + query.length)
  };
}
```

## Notes

- All timestamps use ISO 8601 format for API responses
- All durations are in milliseconds for precision
- Frontend uses Date objects, backend uses ISO 8601 strings
- Component IDs use format: `namespace/resource-type/name`
- Blob paths use format: `container/folder/file.ext`
- All API responses include error field for failed operations
- Bulk operations use Promise.allSettled for partial failure handling
