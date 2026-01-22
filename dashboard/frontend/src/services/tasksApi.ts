import { TaskDiagnostics, RetryResult, EscalationResult } from '../types/task';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Tasks API client for stuck task management operations
 */
export const tasksApi = {
  /**
   * Retry a stuck task by triggering its n8n workflow restart
   */
  async retryTask(taskId: string): Promise<RetryResult> {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to retry task');
    }

    const data = await response.json();

    return {
      success: data.success,
      executionId: data.executionId,
      message: data.message,
      error: data.error,
    };
  },

  /**
   * Get diagnostic information for a stuck task
   */
  async getDiagnostics(taskId: string): Promise<TaskDiagnostics> {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/diagnostics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to fetch diagnostics');
    }

    const data = await response.json();

    return {
      taskId: data.taskId,
      currentPhase: data.currentPhase,
      stuckSince: new Date(data.stuckSince || Date.now()),
      stuckDuration: data.stuckDuration || 0,
      lastError: data.lastError
        ? {
            message: data.lastError.message || 'Unknown error',
            code: data.lastError.code,
            timestamp: new Date(data.lastError.timestamp || Date.now()),
            stackTrace: data.lastError.stackTrace,
          }
        : {
            message: 'No error information available',
            timestamp: new Date(),
          },
      executionId: data.executionId,
      retryHistory: data.retryHistory || [],
      systemState: data.systemState || {
        agentHealth: 'unknown',
        workflowStatus: 'unknown',
        lastHeartbeat: undefined,
      },
      diagnosticLogs: data.diagnosticLogs || [],
      agentHealth: data.agentHealth,
    };
  },

  /**
   * Escalate a stuck task to the on-call team via Teams notification
   */
  async escalateTask(
    taskId: string,
    options?: {
      reason?: string;
      escalatedBy?: string;
    }
  ): Promise<EscalationResult> {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/escalate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        reason: options?.reason,
        escalatedBy: options?.escalatedBy,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to escalate task');
    }

    const data = await response.json();

    return {
      success: data.success,
      messageId: data.messageId,
      notifiedAt: data.notifiedAt ? new Date(data.notifiedAt) : new Date(),
      error: data.error,
    };
  },
};
