import { Router, Request, Response, NextFunction } from 'express';
import { KubernetesService, PodHealth } from '../../services/kubernetes.js';
import { ClaudeAgentService } from '../../services/claude-agent.js';

export interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending';
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
  claudeService: ClaudeAgentService
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
      components.push({
        component: 'auth',
        name: 'claude-auth',
        status: authResult.authenticated ? 'healthy' : 'unhealthy',
        lastChecked: authResult.lastChecked,
        details: {
          authenticated: authResult.authenticated,
          exitCode: authResult.exitCode,
          message: authResult.message,
        },
      });

      // Get CronJob status
      const cronJob = await k8sService.getCronJob('auth-watchdog');
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
            lastScheduleTime: cronJob.lastScheduleTime,
            lastSuccessfulTime: cronJob.lastSuccessfulTime,
            activeJobs: cronJob.activeJobs,
          },
        });
      }

      // Determine overall status
      const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
      const hasPending = components.some((c) => c.status === 'pending');
      const allHealthy = components.every((c) => c.status === 'healthy');

      let overall: HealthResponse['overall'] = 'healthy';
      if (hasUnhealthy) {
        overall = 'unhealthy';
      } else if (hasPending || !allHealthy) {
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
