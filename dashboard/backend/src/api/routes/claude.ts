/**
 * Claude agent execution routes
 * Handles manual execution and execution history
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeAgentService } from '../../services/claude-agent.js';
import { executionStore } from '../../services/execution-store.js';
import {
  ExecutionRecord,
  ExecutionRequest,
  ExecutionResponse,
  ExecutionListResponse,
  ExecutionStatus,
  validateExecutionRequest,
  mapExitCodeToStatus,
} from '../../types/execution.js';
import { Config } from '../../config.js';

export function createClaudeRoutes(config: Config): Router {
  const router = Router();
  const claudeService = new ClaudeAgentService(config);

  // Default execution timeout (5 minutes)
  const DEFAULT_TIMEOUT_MS = 300000;

  /**
   * POST /api/execute
   * Execute a prompt against Claude agent
   */
  router.post('/execute', async (req: Request, res: Response) => {
    const execRequest = req.body as ExecutionRequest;

    // Validate request
    const validation = validateExecutionRequest(execRequest);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const executionId = uuidv4();
    const startedAt = new Date().toISOString();

    // Create initial execution record
    const record: ExecutionRecord = {
      id: executionId,
      prompt: execRequest.prompt,
      status: 'running',
      startedAt,
    };

    executionStore.upsert(record);

    try {
      // Execute with timeout
      const result = await claudeService.execute(execRequest.prompt, DEFAULT_TIMEOUT_MS);

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Determine status from exit code
      const status = mapExitCodeToStatus(result.exitCode, result.timedOut);

      // Update record
      const updatedRecord: ExecutionRecord = {
        ...record,
        status,
        exitCode: result.exitCode,
        output: result.output,
        errorMessage: result.error,
        completedAt,
        durationMs,
      };

      executionStore.upsert(updatedRecord);

      // Return response
      const response: ExecutionResponse = {
        id: executionId,
        status,
        exitCode: result.exitCode,
        output: result.output,
        errorMessage: result.error,
        durationMs,
      };

      // Use 504 for timeout per spec
      if (status === 'timeout') {
        return res.status(504).json(response);
      }

      return res.json(response);
    } catch (err) {
      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Update record with error
      const updatedRecord: ExecutionRecord = {
        ...record,
        status: 'error',
        errorMessage,
        completedAt,
        durationMs,
      };

      executionStore.upsert(updatedRecord);

      return res.status(500).json({
        id: executionId,
        status: 'error',
        errorMessage,
        durationMs,
      } as ExecutionResponse);
    }
  });

  /**
   * GET /api/executions
   * List recent executions with optional filters
   */
  router.get('/executions', (req: Request, res: Response) => {
    const status = req.query.status as ExecutionStatus | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Validate status if provided
    const validStatuses: ExecutionStatus[] = ['success', 'error', 'auth_failure', 'timeout', 'running'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const executions = executionStore.list({ status, limit });
    const total = executionStore.count(status);

    const response: ExecutionListResponse = {
      executions,
      total,
    };

    return res.json(response);
  });

  /**
   * GET /api/executions/:id
   * Get full execution details
   */
  router.get('/executions/:id', (req: Request, res: Response) => {
    const { id } = req.params;

    const execution = executionStore.get(id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    return res.json(execution);
  });

  return router;
}
