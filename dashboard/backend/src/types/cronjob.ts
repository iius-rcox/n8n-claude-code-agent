/**
 * CronJob types for auth watchdog management
 * Per data-model.md
 */

export type CronJobRunStatus = 'running' | 'succeeded' | 'failed';

export interface CronJobRun {
  name: string;
  cronJobName: string;
  startTime?: string;
  completionTime?: string;
  status: CronJobRunStatus;
  exitCode?: number;
  durationMs?: number;
}

export interface CronJobInfo {
  name: string;
  schedule: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs: number;
  suspended: boolean;
}

export interface CronJobStatus extends CronJobInfo {
  recentRuns: CronJobRun[];
}

export interface CronJobTriggerResponse {
  success: boolean;
  jobName: string;
  message?: string;
}

/**
 * Determine job status from Kubernetes Job conditions
 */
export function determineJobStatus(
  active: number | undefined,
  succeeded: number | undefined,
  failed: number | undefined
): CronJobRunStatus {
  if (active && active > 0) {
    return 'running';
  }
  if (succeeded && succeeded > 0) {
    return 'succeeded';
  }
  if (failed && failed > 0) {
    return 'failed';
  }
  return 'running'; // Default to running if no conditions met
}
