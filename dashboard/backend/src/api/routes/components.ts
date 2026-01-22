import { Router, Request, Response } from 'express';
import { KubernetesService } from '../../services/kubernetes.js';

export function createComponentsRouter(k8sService: KubernetesService): Router {
  const router = Router();

  /**
   * POST /api/components/bulk-restart
   * Restart multiple pods simultaneously
   */
  router.post('/bulk-restart', async (req: Request, res: Response): Promise<void> => {
    const { componentIds } = req.body;

    if (!Array.isArray(componentIds) || componentIds.length === 0) {
      res.status(400).json({
        error: 'componentIds must be a non-empty array of pod names'
      });
      return;
    }

    try {
      // Kubernetes pod names are the component IDs in this context
      const podNames = componentIds as string[];

      // Execute bulk restart
      const results = await k8sService.bulkRestartPods(podNames);

      // Count successes and failures
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        success: failed === 0,
        message: `Restarted ${successful} of ${componentIds.length} components`,
        summary: {
          total: componentIds.length,
          successful,
          failed
        },
        results
      });
    } catch (error) {
      res.status(500).json({
        error: 'Bulk restart operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/components/logs
   * Get logs from multiple pods
   */
  router.post('/logs', async (req: Request, res: Response): Promise<void> => {
    const { componentIds, lines = 100 } = req.body;

    if (!Array.isArray(componentIds) || componentIds.length === 0) {
      res.status(400).json({
        error: 'componentIds must be a non-empty array of pod names'
      });
      return;
    }

    if (typeof lines !== 'number' || lines < 1 || lines > 1000) {
      res.status(400).json({
        error: 'lines must be a number between 1 and 1000'
      });
      return;
    }

    try {
      // Kubernetes pod names are the component IDs in this context
      const podNames = componentIds as string[];

      // Fetch logs from all pods
      const results = await k8sService.bulkGetPodLogs(podNames, lines);

      // Count successes and failures
      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;

      res.json({
        success: failed === 0,
        message: `Retrieved logs from ${successful} of ${componentIds.length} components`,
        summary: {
          total: componentIds.length,
          successful,
          failed
        },
        results
      });
    } catch (error) {
      res.status(500).json({
        error: 'Bulk logs operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
