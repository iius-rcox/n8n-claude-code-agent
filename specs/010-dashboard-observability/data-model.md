# Data Model: Dashboard Observability Enhancements

**Feature**: 010-dashboard-observability
**Date**: 2026-01-18
**Phase**: 1 (Design)

## Overview

This document defines the data models and TypeScript interfaces for the four observability features. All types are designed to be shared between backend and frontend.

---

## 1. System Health Overview

### Extended Health Response

```typescript
// Extends existing HealthStatus with new component types
interface SystemHealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: ComponentHealth[];
}

interface ComponentHealth {
  component: 'pod' | 'service' | 'auth' | 'cronjob' | 'storage' | 'n8n';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending' | 'warning';
  lastChecked: string;
  message?: string;
  details?: ComponentDetails;
}

// Discriminated union for component-specific details
type ComponentDetails =
  | PodDetails
  | AuthDetails
  | CronJobDetails
  | StorageDetails
  | N8nDetails;

interface PodDetails {
  type: 'pod';
  phase: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers: number;
  totalContainers: number;
  restartCount: number;
  lastRestartTime?: string;
  version?: string;
}

interface AuthDetails {
  type: 'auth';
  authenticated: boolean;
  expiresAt?: string;
  expiresInHours?: number;
  lastFailureTime?: string;
}

interface CronJobDetails {
  type: 'cronjob';
  schedule: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  nextScheduledTime?: string;
  activeJobs: number;
}

interface StorageDetails {
  type: 'storage';
  account: string;
  containers: string[];
  accessibleContainers: number;
  totalContainers: number;
}

interface N8nDetails {
  type: 'n8n';
  version?: string;
  activeWorkflows: number;
  recentExecutions: number;
}
```

---

## 2. Task Pipeline

### Task Envelope

```typescript
interface TaskEnvelope {
  taskId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  currentPhase: PipelinePhase;
  priority: TaskPriority;
  repository?: string;

  createdAt: string;
  updatedAt: string;
  createdBy?: string;

  phases: Record<PipelinePhase, PhaseState>;

  retryCounts?: {
    verificationAttempts: number;
    implementationAttempts: number;
  };

  artifacts?: TaskArtifacts;

  history: TaskHistoryEntry[];
}

type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'stuck'
  | 'completed'
  | 'failed'
  | 'cancelled';

type PipelinePhase =
  | 'intake'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'release';

type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

interface PhaseState {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  agent?: string;
  error?: string;
}

interface TaskArtifacts {
  specification?: string;  // URL to spec.md
  plan?: string;           // URL to plan.md
  verification?: string;   // URL to verification-report.md
  review?: string;         // URL to review-feedback.md
  prUrl?: string;          // GitHub PR URL
}

interface TaskHistoryEntry {
  timestamp: string;
  event: TaskEvent;
  phase?: PipelinePhase;
  actor?: string;
  message?: string;
  durationMs?: number;
}

type TaskEvent =
  | 'task_created'
  | 'phase_started'
  | 'phase_completed'
  | 'phase_failed'
  | 'task_paused'
  | 'task_resumed'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'human_intervention_requested'
  | 'human_intervention_completed';
```

### Pipeline View Models

```typescript
// API response for pipeline board
interface PipelineResponse {
  timestamp: string;
  tasks: TaskSummary[];
  phaseStats: Record<PipelinePhase, PhaseStats>;
}

interface TaskSummary {
  taskId: string;
  title: string;
  status: TaskStatus;
  currentPhase: PipelinePhase;
  priority: TaskPriority;
  timeInPhase: number;        // milliseconds
  isStuck: boolean;           // timeInPhase > 30 minutes
  currentAgent?: string;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface PhaseStats {
  total: number;
  inProgress: number;
  completed: number;
  failed: number;
  stuck: number;
}

// Task detail view
interface TaskDetailResponse {
  task: TaskEnvelope;
  artifacts: {
    specification?: ArtifactPreview;
    plan?: ArtifactPreview;
    verification?: ArtifactPreview;
    review?: ArtifactPreview;
  };
}

interface ArtifactPreview {
  path: string;
  size: number;
  lastModified: string;
  contentPreview?: string;  // First 500 chars
}
```

---

## 3. n8n Execution Feed

### Execution Types

```typescript
interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;

  // Task correlation
  taskId?: string;
  phase?: PipelinePhase;

  // Error info (for failed executions)
  error?: {
    message: string;
    node?: string;
  };
}

type ExecutionStatus =
  | 'running'
  | 'success'
  | 'error'
  | 'canceled'
  | 'waiting';

type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'internal';

// API responses
interface ExecutionListResponse {
  executions: N8nExecution[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

interface ExecutionDetailResponse {
  execution: N8nExecution;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  nodeExecutions?: NodeExecution[];
}

interface NodeExecution {
  nodeName: string;
  nodeType: string;
  status: 'success' | 'error';
  startedAt: string;
  stoppedAt: string;
  durationMs: number;
  error?: string;
}

// Query filters
interface ExecutionFilters {
  workflowId?: string;
  workflowName?: string;
  status?: ExecutionStatus;
  taskId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}
```

---

## 4. Blob Storage Browser

### Storage Types

```typescript
interface StorageContainer {
  name: string;
  purpose: string;
  blobCount?: number;
  lastModified?: string;
}

interface StorageBlob {
  name: string;
  path: string;           // Full path including folders
  container: string;
  size: number;
  contentType: string;
  lastModified: string;

  // Lease information
  leaseState: LeaseState;
  leaseStatus: LeaseStatus;

  // For display
  isFolder: boolean;
  extension?: string;
}

type LeaseState =
  | 'available'
  | 'leased'
  | 'expired'
  | 'breaking'
  | 'broken';

type LeaseStatus = 'locked' | 'unlocked';

// API responses
interface ContainerListResponse {
  containers: StorageContainer[];
}

interface BlobListResponse {
  container: string;
  path: string;           // Current folder path
  blobs: StorageBlob[];
  folders: string[];      // Subfolder names
  hasMore: boolean;
  continuationToken?: string;
}

interface BlobContentResponse {
  blob: StorageBlob;
  content: string;        // Text content
  truncated: boolean;     // True if content exceeds max size
}

interface BlobDownloadResponse {
  blob: StorageBlob;
  downloadUrl: string;    // SAS URL for download
  expiresAt: string;
}

// Operations
interface BlobDeleteRequest {
  container: string;
  blobPath: string;
  confirm: boolean;       // Must be true to proceed
}

interface LeaseBreakRequest {
  container: string;
  blobPath: string;
  confirm: boolean;
}

interface BlobOperationResponse {
  success: boolean;
  message: string;
  blob?: StorageBlob;
}
```

---

## 5. Shared Types

### API Error Response

```typescript
interface ApiErrorResponse {
  error: string;
  message: string;
  details?: string;
  statusCode: number;
  timestamp: string;
}
```

### Pagination

```typescript
interface PaginatedRequest {
  limit?: number;
  offset?: number;
  cursor?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}
```

### Time Helpers

```typescript
// For display formatting
interface TimeInfo {
  timestamp: string;      // ISO 8601
  relative: string;       // "5 minutes ago"
  formatted: string;      // "Jan 18, 2026 2:30 PM"
}
```

---

## 6. Database/Storage Schema

### No Additional Database Required

All data is stored in existing systems:
- **Azure Blob Storage**: Task envelopes, artifacts
- **n8n Internal DB**: Workflow executions
- **Kubernetes API**: Pod/CronJob status

### Caching Layer (Optional)

If performance requires caching:

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: string;
  expiresAt: string;
  ttlMs: number;
}

// Cache keys
const CACHE_KEYS = {
  HEALTH: 'health:system',
  PIPELINE: 'pipeline:tasks',
  CONTAINERS: 'storage:containers',
  N8N_WORKFLOWS: 'n8n:workflows',
} as const;
```

---

## 7. Configuration Types

```typescript
interface ObservabilityConfig {
  // n8n integration
  n8n: {
    apiUrl: string;
    apiKey: string;
    timeoutMs: number;
  };

  // Azure Storage
  storage: {
    accountName: string;
    containers: string[];
    maxPreviewSize: number;  // bytes
  };

  // Polling intervals
  polling: {
    healthIntervalMs: number;
    pipelineIntervalMs: number;
    executionsIntervalMs: number;
  };

  // Thresholds
  thresholds: {
    stuckTaskMinutes: number;      // Default: 30
    authWarningHours: number;      // Default: 24
    executionRetentionDays: number; // Default: 7
  };
}
```

---

## 8. Event Types (for real-time updates if needed later)

```typescript
// WebSocket events (future enhancement)
type ObservabilityEvent =
  | { type: 'health_changed'; data: SystemHealthResponse }
  | { type: 'task_updated'; data: TaskSummary }
  | { type: 'execution_started'; data: N8nExecution }
  | { type: 'execution_completed'; data: N8nExecution };
```
