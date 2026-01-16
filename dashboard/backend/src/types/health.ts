export interface HealthDetails {
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

export interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending';
  lastChecked: string;
  details?: HealthDetails;
}

export interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: HealthStatus[];
}

export interface AuthStatus {
  authenticated: boolean;
  lastChecked: string;
  exitCode?: number;
  expiryEstimate?: string;
  lastFailureTime?: string;
  message?: string;
}

// Health status determination logic per data-model.md
export function determinePodStatus(
  phase: string,
  readyContainers: number,
  totalContainers: number
): HealthStatus['status'] {
  if (phase === 'Running' && readyContainers === totalContainers) {
    return 'healthy';
  }
  if (phase === 'Pending') {
    return 'pending';
  }
  if (phase === 'Failed' || readyContainers < totalContainers) {
    return 'unhealthy';
  }
  return 'unknown';
}

export function determineAuthStatus(exitCode: number): HealthStatus['status'] {
  if (exitCode === 0) {
    return 'healthy';
  }
  if (exitCode === 57) {
    return 'unhealthy';
  }
  return 'unknown';
}

export function determineCronJobStatus(lastSuccessfulTime?: string): HealthStatus['status'] {
  if (!lastSuccessfulTime) {
    return 'unknown';
  }

  const thirtyFiveMinAgo = Date.now() - 35 * 60 * 1000;
  const lastSuccess = new Date(lastSuccessfulTime).getTime();

  return lastSuccess > thirtyFiveMinAgo ? 'healthy' : 'unhealthy';
}
