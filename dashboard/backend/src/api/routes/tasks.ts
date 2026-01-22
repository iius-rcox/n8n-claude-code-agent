import { Router, Request, Response } from 'express';
import { BlobStorageService } from '../../services/blob-storage.js';
import { N8nClient } from '../../services/n8n-client.js';
import { TeamsWebhookService } from '../../services/teamsWebhookService.js';

export function createTasksRouter(
  blobStorage: BlobStorageService,
  n8nClient: N8nClient,
  teamsService: TeamsWebhookService
): Router {
  const router = Router();

  /**
   * POST /api/tasks/:id/retry
   * Retry a stuck task by triggering its n8n workflow restart
   */
  router.post('/:id/retry', async (req: Request, res: Response): Promise<void> => {
    const { id: taskId } = req.params;

    try {
      // Fetch task envelope to get workflow ID
      const envelope = await blobStorage.getTaskEnvelope(taskId);

      if (!envelope) {
        res.status(404).json({ error: `Task ${taskId} not found` });
        return;
      }

      // Extract workflow ID from envelope
      const workflowId = envelope.workflow_id as string | undefined;

      if (!workflowId) {
        res.status(400).json({ error: 'Task envelope missing workflow_id' });
        return;
      }

      // Trigger workflow retry via n8n
      const result = await n8nClient.retryWorkflow(workflowId, { taskId });

      if (!result.success) {
        res.status(500).json({
          error: 'Workflow retry failed',
          details: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: `Task ${taskId} retry initiated`,
        executionId: result.executionId,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retry task',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/tasks/:id/diagnostics
   * Get diagnostic information for a stuck task
   */
  router.get('/:id/diagnostics', async (req: Request, res: Response): Promise<void> => {
    const { id: taskId } = req.params;

    try {
      // Fetch task envelope
      const envelope = await blobStorage.getTaskEnvelope(taskId);

      if (!envelope) {
        res.status(404).json({ error: `Task ${taskId} not found` });
        return;
      }

      // Extract execution ID and workflow ID
      const executionId = envelope.execution_id as string | undefined;
      const workflowId = envelope.workflow_id as string | undefined;
      const currentPhase = envelope.current_phase as string | undefined;
      const lastError = envelope.last_error as string | undefined;

      // TODO: Fetch real execution logs from n8n once n8n-client supports it
      const diagnosticLogs: string[] = [
        '[Placeholder] Execution logs will appear here once n8n API integration is complete',
      ];

      // TODO: Actually check agent pod status via Kubernetes API
      const agentHealth = {
        status: 'healthy',
        message: 'Agent pod running normally',
      };

      res.json({
        taskId,
        currentPhase: currentPhase || 'unknown',
        executionId,
        workflowId,
        lastError,
        diagnosticLogs,
        agentHealth,
        envelope, // Include full envelope for debugging
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch diagnostics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/tasks/:id/escalate
   * Escalate a stuck task to the on-call team via Teams notification
   */
  router.post('/:id/escalate', async (req: Request, res: Response): Promise<void> => {
    const { id: taskId } = req.params;
    const { reason, escalatedBy } = req.body;

    try {
      // Fetch task envelope
      const envelope = await blobStorage.getTaskEnvelope(taskId);

      if (!envelope) {
        res.status(404).json({ error: `Task ${taskId} not found` });
        return;
      }

      const title = (envelope.title as string) || taskId;
      const currentPhase = (envelope.current_phase as string) || 'unknown';
      const lastError = (envelope.last_error as string) || undefined;

      // Calculate stuck duration (assuming task has created_at timestamp)
      const createdAt = envelope.created_at
        ? new Date(envelope.created_at as string)
        : new Date();
      const stuckDuration = Date.now() - createdAt.getTime();
      const stuckMinutes = Math.floor(stuckDuration / 60000);
      const stuckHours = Math.floor(stuckMinutes / 60);
      const stuckDurationStr = stuckHours > 0
        ? `${stuckHours}h ${stuckMinutes % 60}m`
        : `${stuckMinutes}m`;

      // Construct dashboard URL
      const dashboardUrl = `${req.protocol}://${req.get('host')}/tasks/${taskId}`;

      // Send Teams notification
      const result = await teamsService.sendEscalation({
        taskId,
        title,
        currentPhase,
        stuckDuration: stuckDurationStr,
        lastError,
        dashboardUrl,
        escalatedBy,
        reason,
      });

      if (!result.success) {
        res.status(500).json({
          error: 'Teams escalation failed',
          details: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: `Task ${taskId} escalated to on-call team`,
        messageId: result.messageId,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to escalate task',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
