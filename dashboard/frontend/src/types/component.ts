/**
 * Kubernetes component type
 */
export type ComponentType = 'pod' | 'deployment' | 'cronjob' | 'service';

/**
 * Component health status
 */
export type ComponentStatus =
  | 'Running'
  | 'Pending'
  | 'Failed'
  | 'CrashLoopBackOff'
  | 'Unknown';

/**
 * Kubernetes component representation
 */
export interface Component {
  id: string; // Format: "namespace/resource-type/name"
  name: string;
  type: ComponentType;
  namespace: string;
  status: ComponentStatus;
  restartable: boolean;
}

/**
 * Bulk operation type
 */
export type BulkOperation = 'restart' | 'view-logs' | 'delete';

/**
 * Result of a component operation
 */
export interface ComponentOperationResult {
  componentId: string;
  componentName: string;
  status: 'success' | 'failure' | 'pending';
  message: string;
  timestamp: Date;
}

/**
 * Bulk action state management
 */
export interface BulkActionState {
  selectedComponentIds: string[];
  operation?: BulkOperation;
  results?: ComponentOperationResult[];
  inProgress: boolean;
}

/**
 * Response summary from bulk operations
 */
export interface BulkOperationSummary {
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
}

/**
 * Bulk restart API response
 */
export interface BulkRestartResponse {
  results: ComponentOperationResult[];
  summary: BulkOperationSummary;
}

/**
 * Component logs entry
 */
export interface ComponentLogs {
  componentId: string;
  componentName: string;
  lines: string[];
  timestamp: string; // ISO 8601
}

/**
 * Bulk logs API response
 */
export interface BulkLogsResponse {
  logs: ComponentLogs[];
}
