import { Router, Request, Response, NextFunction } from 'express';
import { PipelineStateService } from '../../services/pipeline-state.js';

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

  return router;
}
