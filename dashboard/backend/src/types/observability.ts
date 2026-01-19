/**
 * Shared types for Dashboard Observability features
 * Feature: 010-dashboard-observability
 */

// ============================================================================
// System Health Types
// ============================================================================

export interface SystemHealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: ComponentHealth[];
}

export interface ComponentHealth {
  component: 'pod' | 'service' | 'auth' | 'cronjob' | 'storage' | 'n8n';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending' | 'warning';
  lastChecked: string;
  message?: string;
  details?: ComponentDetails;
}

export type ComponentDetails =
  | PodDetails
  | AuthDetails
  | CronJobDetails
  | StorageDetails
  | N8nDetails;

export interface PodDetails {
  type: 'pod';
  phase: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers: number;
  totalContainers: number;
  restartCount: number;
  lastRestartTime?: string;
  version?: string;
}

export interface AuthDetails {
  type: 'auth';
  authenticated: boolean;
  expiresAt?: string;
  expiresInHours?: number;
  lastFailureTime?: string;
}

export interface CronJobDetails {
  type: 'cronjob';
  schedule: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  nextScheduledTime?: string;
  activeJobs: number;
}

export interface StorageDetails {
  type: 'storage';
  account: string;
  containers: string[];
  accessibleContainers: number;
  totalContainers: number;
}

export interface N8nDetails {
  type: 'n8n';
  version?: string;
  activeWorkflows: number;
  recentExecutions: number;
}

// ============================================================================
// Task Pipeline Types
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'stuck'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PipelinePhase =
  | 'intake'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'release';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface PhaseState {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  agent?: string;
  error?: string;
}

export type TaskEvent =
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

export interface TaskHistoryEntry {
  timestamp: string;
  event: TaskEvent;
  phase?: PipelinePhase;
  actor?: string;
  message?: string;
  durationMs?: number;
}

export interface TaskArtifacts {
  specification?: string;
  plan?: string;
  verification?: string;
  review?: string;
  prUrl?: string;
}

/**
 * TaskEnvelope as stored in YAML (snake_case format from blob storage)
 */
export interface TaskEnvelope {
  task_id: string;
  title?: string;
  description?: string;
  status: TaskStatus | 'waiting_human';
  phase: PipelinePhase;
  priority?: TaskPriority;
  repository?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  current_agent?: string;
  phase_started_at?: string;
  phases?: Record<PipelinePhase, PhaseState>;
  retry_counts?: {
    verification_attempts: number;
    implementation_attempts: number;
  };
  artifacts?: TaskArtifacts;
  phase_history?: PhaseHistoryEntry[];
  error_history?: ErrorHistoryEntry[];
}

export interface PhaseHistoryEntry {
  phase: PipelinePhase;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
  agent?: string;
  duration_ms?: number;
}

export interface ErrorHistoryEntry {
  phase: PipelinePhase;
  attempt: number;
  error: string;
  resolution?: string;
  timestamp: string;
}

export interface TaskSummary {
  taskId: string;
  title: string;
  status: TaskStatus;
  currentPhase: PipelinePhase;
  priority: TaskPriority;
  timeInPhase: number;
  isStuck: boolean;
  currentAgent?: string;
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseStats {
  total: number;
  inProgress: number;
  completed: number;
  failed: number;
  stuck: number;
}

/**
 * PipelineTask - A task as displayed in the pipeline board
 */
export interface PipelineTask {
  taskId: string;
  title: string;
  phase: PipelinePhase;
  status: TaskStatus | 'waiting_human';
  agent?: string;
  timeInPhase: number;
  isStuck: boolean;
  priority?: TaskPriority;
  repository?: string;
  createdAt?: string;
  updatedAt?: string;
  phaseStartedAt?: string;
  retryCount: number;
}

/**
 * PhaseColumn - A column in the Kanban board representing a pipeline phase
 */
export interface PhaseColumn {
  phase: PipelinePhase;
  displayName: string;
  agent: string;
  tasks: PipelineTask[];
}

/**
 * PipelineSummary - Aggregate statistics for the pipeline
 */
export interface PipelineSummary {
  totalTasks: number;
  activeTasks: number;
  stuckTasks: number;
  tasksByPhase: Record<PipelinePhase, number>;
}

export interface PipelineResponse {
  columns: PhaseColumn[];
  summary: PipelineSummary;
  timestamp: string;
}

export interface ArtifactPreview {
  path: string;
  lastModified: string;
  contentPreview?: string;
}

export interface TaskDetailResponse {
  task: PipelineTask;
  envelope: TaskEnvelope;
  artifacts: {
    spec?: ArtifactPreview;
    plan?: ArtifactPreview;
    verification?: ArtifactPreview;
    review?: ArtifactPreview;
  };
  phaseHistory: PhaseHistoryEntry[];
  errorHistory: ErrorHistoryEntry[];
}

// ============================================================================
// n8n Execution Types
// ============================================================================

export type ExecutionStatus =
  | 'running'
  | 'success'
  | 'error'
  | 'canceled'
  | 'waiting';

export type ExecutionMode = 'manual' | 'trigger' | 'webhook' | 'internal';

export interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;
  taskId?: string;
  phase?: PipelinePhase;
  error?: {
    message: string;
    node?: string;
  };
}

export interface ExecutionListResponse {
  executions: N8nExecution[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface NodeExecution {
  nodeName: string;
  nodeType: string;
  status: 'success' | 'error';
  startedAt: string;
  stoppedAt: string;
  durationMs: number;
  error?: string;
}

export interface ExecutionDetailResponse {
  execution: N8nExecution;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  nodeExecutions?: NodeExecution[];
}

export interface ExecutionFilters {
  workflowId?: string;
  workflowName?: string;
  status?: ExecutionStatus;
  taskId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

// ============================================================================
// Blob Storage Types
// ============================================================================

export type LeaseState =
  | 'available'
  | 'leased'
  | 'expired'
  | 'breaking'
  | 'broken';

export type LeaseStatus = 'locked' | 'unlocked';

export interface StorageContainer {
  name: string;
  purpose: string;
  blobCount?: number;
  lastModified?: string;
}

export interface StorageBlob {
  name: string;
  path: string;
  container: string;
  size: number;
  contentType: string;
  lastModified: string;
  leaseState: LeaseState;
  leaseStatus: LeaseStatus;
  isFolder: boolean;
  extension?: string;
}

export interface ContainerListResponse {
  containers: StorageContainer[];
}

export interface BlobListResponse {
  container: string;
  path: string;
  blobs: StorageBlob[];
  folders: string[];
  hasMore: boolean;
  continuationToken?: string;
}

export interface BlobContentResponse {
  blob: StorageBlob;
  content: string;
  truncated: boolean;
}

export interface BlobDownloadResponse {
  blob: StorageBlob;
  downloadUrl: string;
  expiresAt: string;
}

export interface BlobDeleteRequest {
  container: string;
  blobPath: string;
  confirm: boolean;
}

export interface LeaseBreakRequest {
  container: string;
  blobPath: string;
  confirm: boolean;
}

export interface BlobOperationResponse {
  success: boolean;
  message: string;
  blob?: StorageBlob;
}

// ============================================================================
// Shared Types
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: string;
  statusCode: number;
  timestamp: string;
}

export interface PaginatedRequest {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

// Container purpose mapping for agent storage containers
export const CONTAINER_PURPOSES: Record<string, string> = {
  'agent-state': 'Task lease management and envelope storage',
  'agent-spec': 'Feature specifications (spec.md)',
  'agent-plan': 'Implementation plans (plan.md, tasks.md)',
  'agent-verification': 'Test results and verification reports',
  'agent-review': 'Code review feedback',
  'agent-release': 'Release artifacts and deployment records',
};

// Pipeline phase display information
export const PHASE_INFO: Record<
  PipelinePhase,
  { displayName: string; agent: string; description: string }
> = {
  intake: { displayName: 'Intake', agent: 'pm', description: 'Analyzing requirements and creating specification' },
  planning: { displayName: 'Planning', agent: 'pm', description: 'Creating implementation plan and tasks' },
  implementation: { displayName: 'Implementation', agent: 'dev', description: 'Writing code and creating PR' },
  verification: { displayName: 'Verification', agent: 'qa', description: 'Running tests and validating changes' },
  review: { displayName: 'Review', agent: 'reviewer', description: 'Code review and approval' },
  release: { displayName: 'Release', agent: 'dev', description: 'Merging PR and completing task' },
};

// Stuck task threshold (30 minutes in milliseconds)
export const STUCK_THRESHOLD_MS = 30 * 60 * 1000;
