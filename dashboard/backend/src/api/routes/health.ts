import { Router, Request, Response, NextFunction } from 'express';
import { KubernetesService, PodHealth } from '../../services/kubernetes.js';
import { ClaudeAgentService } from '../../services/claude-agent.js';
import { BlobStorageService } from '../../services/blob-storage.js';
import { N8nClient } from '../../services/n8n-client.js';

export interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob' | 'storage' | 'n8n';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending' | 'warning';
  lastChecked: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: HealthStatus[];
}

function mapPodToHealthStatus(pod: PodHealth): HealthStatus {
  let status: HealthStatus['status'] = 'unknown';

  if (pod.phase === 'Running' && pod.readyContainers === pod.totalContainers) {
    status = 'healthy';
  } else if (pod.phase === 'Pending') {
    status = 'pending';
  } else if (pod.phase === 'Failed' || pod.readyContainers < pod.totalContainers) {
    status = 'unhealthy';
  }

  return {
    component: 'pod',
    name: pod.name,
    status,
    lastChecked: new Date().toISOString(),
    details: {
      phase: pod.phase,
      readyContainers: pod.readyContainers,
      totalContainers: pod.totalContainers,
      restartCount: pod.restartCount,
      lastRestartTime: pod.lastRestartTime,
    },
  };
}

export function createHealthRouter(
  k8sService: KubernetesService,
  claudeService: ClaudeAgentService,
  blobStorageService?: BlobStorageService,
  n8nClient?: N8nClient
): Router {
  const router = Router();

  // GET /api/health - Aggregate health status
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const timestamp = new Date().toISOString();
      const components: HealthStatus[] = [];

      // Get pod health
      const pods = await k8sService.listPods();
      for (const pod of pods) {
        components.push(mapPodToHealthStatus(pod));
      }

      // Get auth status
      const authResult = await claudeService.checkAuth();

      // Note: Token expiry detection would require parsing ~/.claude session files
      // For now, we only show warning status based on authentication check result
      components.push({
        component: 'auth',
        name: 'claude-auth',
        status: authResult.authenticated ? 'healthy' : 'unhealthy',
        lastChecked: authResult.lastChecked,
        details: {
          type: 'auth',
          authenticated: authResult.authenticated,
          exitCode: authResult.exitCode,
          message: authResult.message,
        },
      });

      // Get CronJob status
      const cronJob = await k8sService.getCronJob('claude-auth-watchdog');
      if (cronJob) {
        const thirtyFiveMinAgo = Date.now() - 35 * 60 * 1000;
        const lastSuccess = cronJob.lastSuccessfulTime
          ? new Date(cronJob.lastSuccessfulTime).getTime()
          : 0;
        const isHealthy = lastSuccess > thirtyFiveMinAgo;

        components.push({
          component: 'cronjob',
          name: cronJob.name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastChecked: timestamp,
          details: {
            schedule: cronJob.schedule,
            lastScheduleTime: cronJob.lastScheduleTime,
            lastSuccessfulTime: cronJob.lastSuccessfulTime,
            activeJobs: cronJob.activeJobs,
          },
        });
      }

      // Get Azure Storage health (if service is available)
      if (blobStorageService) {
        const storageHealth = await blobStorageService.checkHealth();
        components.push({
          component: 'storage',
          name: 'azure-blob-storage',
          status: storageHealth.healthy ? 'healthy' : 'unhealthy',
          lastChecked: timestamp,
          details: {
            type: 'storage',
            account: 'iiusagentstore',
            containers: storageHealth.containers,
            accessibleContainers: storageHealth.containers.length,
            totalContainers: storageHealth.containers.length,
            error: storageHealth.error,
          },
        });
      }

      // Get n8n health (if client is configured)
      if (n8nClient && n8nClient.isConfigured()) {
        const n8nHealth = await n8nClient.checkHealth();
        components.push({
          component: 'n8n',
          name: 'n8n-workflows',
          status: n8nHealth ? 'healthy' : 'unhealthy',
          lastChecked: timestamp,
          details: n8nHealth ? {
            type: 'n8n',
            version: n8nHealth.version,
            activeWorkflows: n8nHealth.activeWorkflows,
            recentExecutions: n8nHealth.recentExecutions,
          } : {
            type: 'n8n',
            error: 'Unable to connect to n8n',
          },
        });
      }

      // Determine overall status
      const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
      const hasWarning = components.some((c) => c.status === 'warning');
      const hasPending = components.some((c) => c.status === 'pending');
      const allHealthy = components.every((c) => c.status === 'healthy');

      let overall: HealthResponse['overall'] = 'healthy';
      if (hasUnhealthy) {
        overall = 'unhealthy';
      } else if (hasPending || hasWarning || !allHealthy) {
        overall = 'degraded';
      }

      const response: HealthResponse = {
        timestamp,
        overall,
        components,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/health/pods - Pod-specific health
  router.get('/pods', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const pods = await k8sService.listPods();
      const healthStatuses = pods.map(mapPodToHealthStatus);
      res.json(healthStatuses);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
