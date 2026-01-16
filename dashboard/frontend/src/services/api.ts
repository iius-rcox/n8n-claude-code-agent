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

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || 'Request failed', error.details);
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
  component: 'pod' | 'service' | 'auth' | 'cronjob';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending';
  lastChecked: string;
  details?: HealthDetails;
}

export interface HealthDetails {
  phase?: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers?: number;
  totalContainers?: number;
  restartCount?: number;
  lastRestartTime?: string;
  authenticated?: boolean;
  exitCode?: number;
  lastFailureTime?: string;
  expiryEstimate?: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs?: number;
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
  cliCommand: string;
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
