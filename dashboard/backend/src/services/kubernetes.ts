import * as k8s from '@kubernetes/client-node';
import { Config } from '../config.js';
import { CronJobRun } from '../types/cronjob.js';

export interface PodHealth {
  name: string;
  phase: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  readyContainers: number;
  totalContainers: number;
  restartCount: number;
  lastRestartTime?: string;
}

export interface CronJobInfo {
  name: string;
  schedule: string;
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
  activeJobs: number;
  suspended: boolean;
}

export interface JobInfo {
  name: string;
  cronJobName: string;
  startTime?: string;
  completionTime?: string;
  status: 'running' | 'succeeded' | 'failed';
  exitCode?: number;
  durationMs?: number;
}

export class KubernetesService {
  private coreApi: k8s.CoreV1Api;
  private appsApi: k8s.AppsV1Api;
  private batchApi: k8s.BatchV1Api;
  private namespace: string;

  constructor(config: Config) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.batchApi = kc.makeApiClient(k8s.BatchV1Api);
    this.namespace = config.claudeAgent.namespace;
  }

  async listPods(): Promise<PodHealth[]> {
    const response = await this.coreApi.listNamespacedPod(this.namespace);

    return response.body.items.map((pod: k8s.V1Pod) => {
      const containerStatuses = pod.status?.containerStatuses || [];
      const totalContainers = containerStatuses.length;
      const readyContainers = containerStatuses.filter((cs: k8s.V1ContainerStatus) => cs.ready).length;
      const restartCount = containerStatuses.reduce((sum: number, cs: k8s.V1ContainerStatus) => sum + (cs.restartCount || 0), 0);

      let lastRestartTime: string | undefined;
      for (const cs of containerStatuses) {
        if (cs.lastState?.terminated?.finishedAt) {
          const time = cs.lastState.terminated.finishedAt.toISOString();
          if (!lastRestartTime || time > lastRestartTime) {
            lastRestartTime = time;
          }
        }
      }

      return {
        name: pod.metadata?.name || 'unknown',
        phase: (pod.status?.phase as PodHealth['phase']) || 'Unknown',
        readyContainers,
        totalContainers,
        restartCount,
        lastRestartTime,
      };
    });
  }

  async getSecret(name: string): Promise<k8s.V1Secret | null> {
    try {
      const response = await this.coreApi.readNamespacedSecret(name, this.namespace);
      return response.body;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 404) {
          return null;
        }
      }
      throw error;
    }
  }

  async deleteSecret(name: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespacedSecret(name, this.namespace);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 404) {
          return; // Already deleted
        }
      }
      throw error;
    }
  }

  async createSecret(name: string, data: Record<string, string>): Promise<void> {
    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace: this.namespace,
      },
      type: 'Opaque',
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          Buffer.from(value).toString('base64'),
        ])
      ),
    };

    await this.coreApi.createNamespacedSecret(this.namespace, secret);
  }

  async restartDeployment(name: string): Promise<void> {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
            },
          },
        },
      },
    };

    await this.appsApi.patchNamespacedDeployment(
      name,
      this.namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
  }

  async getCronJob(name: string): Promise<CronJobInfo | null> {
    try {
      const response = await this.batchApi.readNamespacedCronJob(name, this.namespace);
      const cronJob = response.body;

      return {
        name: cronJob.metadata?.name || name,
        schedule: cronJob.spec?.schedule || '',
        lastScheduleTime: cronJob.status?.lastScheduleTime?.toISOString(),
        lastSuccessfulTime: cronJob.status?.lastSuccessfulTime?.toISOString(),
        activeJobs: cronJob.status?.active?.length || 0,
        suspended: cronJob.spec?.suspend || false,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 404) {
          return null;
        }
      }
      throw error;
    }
  }

  async listJobs(labelSelector?: string): Promise<JobInfo[]> {
    const response = await this.batchApi.listNamespacedJob(
      this.namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );

    return response.body.items.map((job: k8s.V1Job) => {
      let status: JobInfo['status'] = 'running';
      let exitCode: number | undefined;

      if (job.status?.succeeded && job.status.succeeded > 0) {
        status = 'succeeded';
        exitCode = 0;
      } else if (job.status?.failed && job.status.failed > 0) {
        status = 'failed';
        exitCode = 1;
      }

      const cronJobName =
        job.metadata?.ownerReferences?.find((ref: k8s.V1OwnerReference) => ref.kind === 'CronJob')?.name ||
        job.metadata?.annotations?.['cronjob.kubernetes.io/instantiate'] ||
        '';

      return {
        name: job.metadata?.name || 'unknown',
        cronJobName,
        startTime: job.status?.startTime?.toISOString(),
        completionTime: job.status?.completionTime?.toISOString(),
        status,
        exitCode,
      };
    });
  }

  async createJobFromCronJob(cronJobName: string): Promise<string> {
    const response = await this.batchApi.readNamespacedCronJob(cronJobName, this.namespace);
    const cronJob = response.body;

    const jobName = `${cronJobName}-manual-${Date.now()}`;
    const job: k8s.V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace: this.namespace,
        annotations: {
          'cronjob.kubernetes.io/instantiate': 'manual',
        },
      },
      spec: cronJob.spec?.jobTemplate.spec,
    };

    await this.batchApi.createNamespacedJob(this.namespace, job);
    return jobName;
  }

  async getJobsForCronJob(cronJobName: string, limit: number = 5): Promise<CronJobRun[]> {
    // Get all jobs in namespace
    const jobs = await this.listJobs();

    // Filter to jobs belonging to this CronJob and sort by start time descending
    return jobs
      .filter((job) => job.cronJobName === cronJobName || job.name.startsWith(`${cronJobName}-`))
      .sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((job) => ({
        name: job.name,
        cronJobName: job.cronJobName,
        startTime: job.startTime,
        completionTime: job.completionTime,
        status: job.status,
        exitCode: job.exitCode,
        // Calculate duration if both times are available
        durationMs:
          job.startTime && job.completionTime
            ? new Date(job.completionTime).getTime() - new Date(job.startTime).getTime()
            : undefined,
      }));
  }

  /**
   * Restart multiple pods simultaneously using Promise.allSettled for partial failure handling
   */
  async bulkRestartPods(podNames: string[]): Promise<Array<{
    podName: string;
    success: boolean;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      podNames.map(async (podName) => {
        try {
          await this.coreApi.deleteNamespacedPod(podName, this.namespace);
          return { podName, success: true };
        } catch (error) {
          return {
            podName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        podName: 'unknown',
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    });
  }

  /**
   * Get logs from a specific pod
   */
  async getPodLogs(podName: string, lines: number = 100): Promise<string[]> {
    try {
      const response = await this.coreApi.readNamespacedPodLog(
        podName,
        this.namespace,
        undefined, // container (undefined = first container)
        undefined, // follow
        undefined, // insecureSkipTLSVerifyBackend
        undefined, // limitBytes
        undefined, // pretty
        undefined, // previous
        undefined, // sinceSeconds
        lines, // tailLines
        undefined  // timestamps
      );

      const logText = response.body;
      return logText.split('\n').filter((line: string) => line.trim().length > 0);
    } catch (error) {
      throw new Error(`Failed to fetch logs for pod ${podName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get logs from multiple pods in parallel
   */
  async bulkGetPodLogs(podNames: string[], lines: number = 100): Promise<Array<{
    podName: string;
    logs: string[];
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      podNames.map(async (podName) => {
        try {
          const logs = await this.getPodLogs(podName, lines);
          return { podName, logs };
        } catch (error) {
          return {
            podName,
            logs: [],
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        podName: 'unknown',
        logs: [],
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    });
  }
}
