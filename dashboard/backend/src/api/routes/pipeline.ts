import { Router, Request, Response, NextFunction } from 'express';
import { PipelineStateService } from '../../services/pipeline-state.js';
import { websocketService } from '../../services/websocket.js';

export function createPipelineRouter(pipelineService: PipelineStateService): Router {
  const router = Router();

  /**
   * GET /api/pipeline
   * Returns the full pipeline state with tasks grouped by phase
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const pipelineState = await pipelineService.getPipelineState();
      res.json(pipelineState);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/pipeline/tasks/:taskId
   * Returns detailed information about a specific task
   */
  router.get('/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const taskDetail = await pipelineService.getTaskDetail(taskId);

      if (!taskDetail) {
        res.status(404).json({
          error: 'Not Found',
          message: `Task ${taskId} not found`,
        });
        return;
      }

      res.json(taskDetail);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/pipeline/tasks/:taskId/cancel
   * Cancels a task that is in progress
   */
  router.post('/tasks/:taskId/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { reason } = req.body || {};

      const result = await pipelineService.cancelTask(taskId, reason);

      if (!result.success) {
        res.status(400).json({
          error: 'Cancel Failed',
          message: result.message,
        });
        return;
      }

      // Emit WebSocket event to notify all clients
      websocketService.emitTaskCancelled(taskId);

      res.json({
        success: true,
        message: result.message,
        taskId,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
