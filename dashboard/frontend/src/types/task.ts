/**
 * Task phase in the autonomous dev team pipeline
 */
export type TaskPhase =
  | 'intake'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'release';

/**
 * Error information from a failed task execution
 */
export interface TaskError {
  message: string;
  phase?: TaskPhase;
  timestamp: Date;
  logs?: string[];
  code?: string;
  errorCode?: string;
  stackTrace?: string;
}

/**
 * Escalation status tracking for stuck tasks
 */
export interface EscalationStatus {
  escalatedAt: Date;
  escalatedBy: string;
  teamsMessageId?: string;
  status: 'pending' | 'acknowledged' | 'resolved';
}

/**
 * Represents a task that has been stuck in a single phase for >30 minutes
 */
export interface StuckTask {
  id: string;
  title: string;
  currentPhase: TaskPhase;
  stuckSince: Date;
  stuckDuration: number; // milliseconds
  lastError?: TaskError;
  retryCount: number;
  escalationStatus?: EscalationStatus;
}

/**
 * Response from task retry operation
 */
export interface RetryResult {
  success: boolean;
  executionId?: string;
  message?: string;
  error?: string;
}

/**
 * Response from task escalation operation
 */
export interface EscalationResult {
  success: boolean;
  messageId?: string;
  notifiedAt: Date;
  error?: string;
}

/**
 * Retry attempt history entry
 */
export interface RetryAttempt {
  timestamp: Date;
  result: 'success' | 'failure';
  message: string;
  executionId?: string;
}

/**
 * System health status indicators
 */
export interface SystemState {
  n8nStatus: 'healthy' | 'degraded' | 'down';
  agentStatus: 'healthy' | 'degraded' | 'down';
  storageStatus: 'healthy' | 'degraded' | 'down';
}

/**
 * Detailed diagnostic information for stuck task analysis
 */
export interface TaskDiagnostics {
  taskId: string;
  currentPhase: TaskPhase | string;
  stuckSince: Date;
  stuckDuration: number;
  lastError: TaskError;
  executionId?: string;
  retryHistory: RetryAttempt[];
  upstreamErrors?: string[];
  systemState: SystemState;
  diagnosticLogs?: string[];
  agentHealth?: {
    status: string;
    message: string;
  };
}

/**
 * Task age tracking for heat map visualization
 */
export type AgeCategory = 'new' | 'normal' | 'aging' | 'stale';

/**
 * Task age information for heat map coloring
 */
export interface TaskAge {
  taskId: string;
  currentPhase: TaskPhase;
  enteredPhaseAt: Date;
  timeInPhase: number; // milliseconds
  ageCategory: AgeCategory;
  displayDuration: string; // Human-readable: "45m", "3h 20m", "2d"
}
