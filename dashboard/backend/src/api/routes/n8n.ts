import { Router, Request, Response, NextFunction } from 'express';
import { N8nClient } from '../../services/n8n-client.js';
import { ExecutionFilters, ExecutionStatus } from '../../types/observability.js';

export function createN8nRouter(n8nClient: N8nClient): Router {
  const router = Router();

  /**
   * GET /api/n8n/executions
   * List n8n workflow executions with optional filters
   */
  router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!n8nClient.isConfigured()) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'n8n integration is not configured',
        });
        return;
      }

      const filters: ExecutionFilters = {};

      // Parse query parameters
      if (req.query.workflowId) {
        filters.workflowId = String(req.query.workflowId);
      }
      if (req.query.workflowName) {
        filters.workflowName = String(req.query.workflowName);
      }
      if (req.query.status) {
        filters.status = String(req.query.status) as ExecutionStatus;
      }
      if (req.query.taskId) {
        filters.taskId = String(req.query.taskId);
      }
      if (req.query.startDate) {
        filters.startDate = String(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.endDate = String(req.query.endDate);
      }
      if (req.query.limit) {
        filters.limit = parseInt(String(req.query.limit), 10);
      }
      if (req.query.cursor) {
        filters.cursor = String(req.query.cursor);
      }

      const executions = await n8nClient.getExecutions(filters);
      res.json(executions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/n8n/executions/:executionId
   * Get detailed information about a specific execution
   */
  router.get('/executions/:executionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!n8nClient.isConfigured()) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'n8n integration is not configured',
        });
        return;
      }

      const { executionId } = req.params;
      const includeData = req.query.includeData === 'true';

      const execution = await n8nClient.getExecution(executionId, includeData);

      if (!execution) {
        res.status(404).json({
          error: 'Not Found',
          message: `Execution ${executionId} not found`,
        });
        return;
      }

      res.json(execution);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/n8n/workflows
   * List available n8n workflows for filtering
   */
  router.get('/workflows', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!n8nClient.isConfigured()) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'n8n integration is not configured',
        });
        return;
      }

      const workflows = await n8nClient.getWorkflows();
      res.json({ workflows });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
