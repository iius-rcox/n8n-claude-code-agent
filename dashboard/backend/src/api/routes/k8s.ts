/**
 * Kubernetes CronJob management routes
 */

import { Router, Request, Response } from 'express';
import { KubernetesService } from '../../services/kubernetes.js';
import { CronJobStatus, CronJobTriggerResponse } from '../../types/cronjob.js';

export function createK8sRouter(k8sService: KubernetesService): Router {
  const router = Router();

  /**
   * GET /api/cronjobs
   * Get auth watchdog CronJob status and recent runs
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const cronJobInfo = await k8sService.getCronJob('auth-watchdog');

      if (!cronJobInfo) {
        return res.status(404).json({
          error: 'CronJob not found',
          message: 'The auth-watchdog CronJob does not exist in the cluster',
        });
      }

      // Get recent job runs
      const recentRuns = await k8sService.getJobsForCronJob('auth-watchdog', 5);

      const response: CronJobStatus = {
        ...cronJobInfo,
        recentRuns,
      };

      return res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get CronJob status';
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/cronjobs/trigger
   * Manually trigger the auth watchdog CronJob
   */
  router.post('/trigger', async (_req: Request, res: Response) => {
    try {
      const jobName = await k8sService.createJobFromCronJob('auth-watchdog');

      const response: CronJobTriggerResponse = {
        success: true,
        jobName,
        message: `Job ${jobName} created successfully`,
      };

      return res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger CronJob';
      return res.status(500).json({
        success: false,
        jobName: '',
        message,
      } as CronJobTriggerResponse);
    }
  });

  return router;
}
