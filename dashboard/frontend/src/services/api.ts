import { IPublicClientApplication } from '@azure/msal-browser';
import { loginRequest } from '@/lib/msal-config';

let msalInstance: IPublicClientApplication | null = null;

export function setMsalInstance(instance: IPublicClientApplication) {
  msalInstance = instance;
}

async function getIdToken(): Promise<string> {
  if (!msalInstance) {
    throw new Error('MSAL instance not initialized');
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('No authenticated account');
  }

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    // Use ID token for API calls - access token is a Microsoft Graph opaque token
    return response.idToken;
  } catch (error) {
    // Silent token acquisition failed, try interactive
    const response = await msalInstance.acquireTokenPopup(loginRequest);
    return response.idToken;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${url}` : url;
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    // Use message field if available (e.g., "n8n integration is not configured")
    // Fall back to error field, then generic message
    const errorMessage = error.message || error.error || 'Request failed';
    throw new ApiError(response.status, errorMessage, error.details);
  }

  return response;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Health API
export interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: HealthStatus[];
}

export interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob' | 'storage' | 'n8n';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending' | 'warning';
  lastChecked: string;
  details?: HealthDetails;
}

export interface HealthDetails {
  // Common
  type?: 'pod' | 'auth' | 'cronjob' | 'storage' | 'n8n';
  error?: string;

  // Pod details
  phase?: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers?: number;
  totalContainers?: number;
  restartCount?: number;
  lastRestartTime?: string;

  // Auth details
  authenticated?: boolean;
  exitCode?: number;
  message?: string;
  lastFailureTime?: string;
  expiryEstimate?: string;

  // CronJob details
  schedule?: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs?: number;

  // Storage details
  account?: string;
  containers?: string[];
  accessibleContainers?: number;
  // Note: totalContainers is already defined above (used by both pod and storage)

  // n8n details
  version?: string;
  activeWorkflows?: number;
  recentExecutions?: number;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetchWithAuth('/api/health');
  return response.json();
}

export async function getPodHealth(): Promise<HealthStatus[]> {
  const response = await fetchWithAuth('/api/health/pods');
  return response.json();
}

// Auth API
export interface AuthStatus {
  authenticated: boolean;
  lastChecked: string;
  exitCode?: number;
  expiryEstimate?: string;
  lastFailureTime?: string;
  message?: string;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await fetchWithAuth('/api/auth/status');
  return response.json();
}

// Credentials API
export interface RefreshInitResponse {
  operationId: string;
  status: 'waiting_credentials';
  instruction: string;
  expiresAt: string;
}

export interface TokenRefreshOperation {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  currentStep: string;
  steps: StepStatus[];
  error?: TokenRefreshError;
}

export interface StepStatus {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  message?: string;
}

export interface TokenRefreshError {
  step: string;
  message: string;
  details?: string;
  remediation?: string;
}

export async function initiateRefresh(): Promise<RefreshInitResponse> {
  const response = await fetchWithAuth('/api/credentials/refresh', { method: 'POST' });
  return response.json();
}

export async function getRefreshStatus(operationId: string): Promise<TokenRefreshOperation> {
  const response = await fetchWithAuth(`/api/credentials/refresh/${operationId}`);
  return response.json();
}

export interface CredentialsPushRequest {
  credentials: string;
  settings: string;
}

export interface CredentialsPushResponse {
  success: boolean;
  operationId: string;
  message: string;
}

export async function pushCredentials(request: CredentialsPushRequest): Promise<CredentialsPushResponse> {
  const response = await fetchWithAuth('/api/credentials/push', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
}

export interface OAuthTokenRequest {
  token: string;
}

export interface OAuthTokenResponse {
  success: boolean;
  message: string;
}

export async function pushOAuthToken(request: OAuthTokenRequest): Promise<OAuthTokenResponse> {
  const response = await fetchWithAuth('/api/credentials/oauth-token', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
}

// Execute API
export interface ExecuteRequest {
  prompt: string;
}

export type ExecutionStatus = 'success' | 'error' | 'auth_failure' | 'timeout' | 'running';

export interface ExecutionResponse {
  id: string;
  status: ExecutionStatus;
  exitCode?: number;
  output?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface ExecutionRecord {
  id: string;
  prompt: string;
  status: ExecutionStatus;
  exitCode?: number;
  output?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ExecutionListResponse {
  executions: ExecutionRecord[];
  total: number;
}

export async function executePrompt(request: ExecuteRequest): Promise<ExecutionResponse> {
  const response = await fetchWithAuth('/api/execute', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function getExecutions(
  status?: ExecutionStatus,
  limit?: number
): Promise<ExecutionListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', limit.toString());

  const url = `/api/executions${params.toString() ? `?${params}` : ''}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getExecution(id: string): Promise<ExecutionRecord> {
  const response = await fetchWithAuth(`/api/executions/${id}`);
  return response.json();
}

// CronJob API
export interface CronJobStatus {
  name: string;
  schedule: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs: number;
  suspended: boolean;
  recentRuns: CronJobRun[];
}

export interface CronJobRun {
  name: string;
  cronJobName: string;
  startTime?: string;
  completionTime?: string;
  status: 'running' | 'succeeded' | 'failed';
  exitCode?: number;
  durationMs?: number;
}

export interface CronJobTriggerResponse {
  success: boolean;
  jobName: string;
  message?: string;
}

export async function getCronJobs(): Promise<CronJobStatus> {
  const response = await fetchWithAuth('/api/cronjobs');
  return response.json();
}

export async function triggerCronJob(): Promise<CronJobTriggerResponse> {
  const response = await fetchWithAuth('/api/cronjobs/trigger', { method: 'POST' });
  return response.json();
}

// Pipeline API
export type PipelinePhase =
  | 'intake'
  | 'planning'
  | 'implementation'
  | 'verification'
  | 'review'
  | 'release';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'stuck'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_human';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface PipelineTask {
  taskId: string;
  title: string;
  phase: PipelinePhase;
  status: TaskStatus;
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

export interface PhaseColumn {
  phase: PipelinePhase;
  displayName: string;
  agent: string;
  tasks: PipelineTask[];
}

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

export interface ArtifactPreview {
  path: string;
  lastModified: string;
  contentPreview?: string;
}

export interface TaskDetailResponse {
  task: PipelineTask;
  envelope: Record<string, unknown>;
  artifacts: {
    spec?: ArtifactPreview;
    plan?: ArtifactPreview;
    verification?: ArtifactPreview;
    review?: ArtifactPreview;
  };
  phaseHistory: PhaseHistoryEntry[];
  errorHistory: ErrorHistoryEntry[];
}

export async function getPipeline(): Promise<PipelineResponse> {
  const response = await fetchWithAuth('/api/pipeline');
  return response.json();
}

export async function getTaskDetail(taskId: string): Promise<TaskDetailResponse> {
  const response = await fetchWithAuth(`/api/pipeline/tasks/${taskId}`);
  return response.json();
}

// n8n Execution API
export type N8nExecutionStatus = 'running' | 'success' | 'error' | 'canceled' | 'waiting';
export type N8nExecutionMode = 'manual' | 'trigger' | 'webhook' | 'internal';

export interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: N8nExecutionStatus;
  mode: N8nExecutionMode;
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

export interface N8nExecutionListResponse {
  executions: N8nExecution[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface N8nExecutionDetailResponse {
  execution: N8nExecution;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  nodeExecutions?: {
    nodeName: string;
    nodeType: string;
    status: 'success' | 'error';
    startedAt: string;
    stoppedAt: string;
    durationMs: number;
    error?: string;
  }[];
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface N8nWorkflowsResponse {
  workflows: N8nWorkflow[];
}

export interface N8nExecutionFilters {
  workflowId?: string;
  workflowName?: string;
  status?: N8nExecutionStatus;
  taskId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
}

export async function getN8nExecutions(
  filters: N8nExecutionFilters = {}
): Promise<N8nExecutionListResponse> {
  const params = new URLSearchParams();
  if (filters.workflowId) params.set('workflowId', filters.workflowId);
  if (filters.workflowName) params.set('workflowName', filters.workflowName);
  if (filters.status) params.set('status', filters.status);
  if (filters.taskId) params.set('taskId', filters.taskId);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.limit) params.set('limit', filters.limit.toString());
  if (filters.cursor) params.set('cursor', filters.cursor);

  const url = `/api/n8n/executions${params.toString() ? `?${params}` : ''}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getN8nExecution(
  executionId: string,
  includeData: boolean = false
): Promise<N8nExecutionDetailResponse> {
  const url = `/api/n8n/executions/${executionId}${includeData ? '?includeData=true' : ''}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getN8nWorkflows(): Promise<N8nWorkflowsResponse> {
  const response = await fetchWithAuth('/api/n8n/workflows');
  return response.json();
}

// Storage API
export interface StorageContainer {
  name: string;
  lastModified?: string;
}

export interface StorageContainersResponse {
  containers: StorageContainer[];
}

export interface BlobItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: string;
  contentType?: string;
  leaseState?: string;
  leaseStatus?: string;
}

export interface ListBlobsResponse {
  container: string;
  path: string;
  blobs: BlobItem[];
  continuationToken?: string;
  hasMore: boolean;
}

export interface BlobContentResponse {
  container: string;
  blobPath: string;
  content: string;
  contentType: string;
  size: number;
  truncated: boolean;
  encoding: 'utf-8' | 'base64';
}

export interface BlobDownloadUrlResponse {
  container: string;
  blobPath: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface BlobDeleteResponse {
  success: boolean;
  message: string;
}

export interface BlobBreakLeaseResponse {
  success: boolean;
  message: string;
}

export async function getStorageContainers(): Promise<StorageContainersResponse> {
  const response = await fetchWithAuth('/api/storage/containers');
  return response.json();
}

export async function listBlobs(
  container: string,
  path: string = '',
  limit: number = 50,
  continuationToken?: string
): Promise<ListBlobsResponse> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (limit) params.set('limit', limit.toString());
  if (continuationToken) params.set('continuationToken', continuationToken);

  const url = `/api/storage/containers/${encodeURIComponent(container)}/blobs${params.toString() ? `?${params}` : ''}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getBlobContent(
  container: string,
  blobPath: string,
  maxSize: number = 102400
): Promise<BlobContentResponse> {
  const params = new URLSearchParams();
  params.set('maxSize', maxSize.toString());

  const url = `/api/storage/containers/${encodeURIComponent(container)}/blobs/${blobPath}?${params}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function getBlobDownloadUrl(
  container: string,
  blobPath: string,
  expiresInMinutes: number = 15
): Promise<BlobDownloadUrlResponse> {
  const params = new URLSearchParams();
  params.set('download', 'true');
  params.set('expiresIn', expiresInMinutes.toString());

  const url = `/api/storage/containers/${encodeURIComponent(container)}/blobs/${blobPath}?${params}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

export async function deleteBlob(
  container: string,
  blobPath: string
): Promise<BlobDeleteResponse> {
  const url = `/api/storage/containers/${encodeURIComponent(container)}/blobs/${blobPath}`;
  const response = await fetchWithAuth(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  return response.json();
}

export async function breakBlobLease(
  container: string,
  blobPath: string
): Promise<BlobBreakLeaseResponse> {
  const url = `/api/storage/containers/${encodeURIComponent(container)}/blobs/${blobPath}/break-lease`;
  const response = await fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  return response.json();
}
