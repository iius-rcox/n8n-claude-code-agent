import { Config } from '../config.js';
import {
  N8nExecution,
  ExecutionListResponse,
  ExecutionDetailResponse,
  ExecutionFilters,
  ExecutionStatus,
  ExecutionMode,
  WorkflowSummary,
  N8nDetails,
  PipelinePhase,
} from '../types/observability.js';

interface N8nApiExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowData?: {
    name: string;
  };
  data?: {
    resultData?: {
      runData?: Record<string, unknown>;
      error?: {
        message: string;
        node?: string;
      };
    };
  };
  status?: string;
}

interface N8nApiWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.n8n.apiUrl;
    this.apiKey = config.n8n.apiKey;
  }

  /**
   * Check if n8n integration is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get n8n workflow executions with optional filters
   */
  async getExecutions(filters: ExecutionFilters = {}): Promise<ExecutionListResponse> {
    if (!this.isConfigured()) {
      return { executions: [], total: 0, hasMore: false };
    }

    const url = new URL(`${this.baseUrl}/api/v1/executions`);

    // Apply filters
    if (filters.limit) url.searchParams.set('limit', String(filters.limit));
    if (filters.cursor) url.searchParams.set('lastId', filters.cursor);
    if (filters.workflowId) url.searchParams.set('workflowId', filters.workflowId);
    if (filters.status && filters.status !== 'running') {
      // n8n API doesn't have a "running" filter - it has success/error/canceled/waiting
      url.searchParams.set('status', filters.status);
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { data?: N8nApiExecution[]; nextCursor?: string };
    const executions = this.transformExecutions(data.data || []);

    // Filter by workflow name client-side if needed
    let filtered = executions;
    if (filters.workflowName) {
      const nameLower = filters.workflowName.toLowerCase();
      filtered = executions.filter((e) =>
        e.workflowName.toLowerCase().includes(nameLower)
      );
    }

    // Filter by taskId client-side (extracted from execution data)
    if (filters.taskId) {
      filtered = filtered.filter((e) => e.taskId === filters.taskId);
    }

    // Filter by date range client-side
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      filtered = filtered.filter((e) => new Date(e.startedAt).getTime() >= startTime);
    }
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      filtered = filtered.filter((e) => new Date(e.startedAt).getTime() <= endTime);
    }

    return {
      executions: filtered,
      total: filtered.length,
      hasMore: data.nextCursor !== undefined,
      cursor: data.nextCursor,
    };
  }

  /**
   * Get detailed information about a specific execution
   */
  async getExecution(executionId: string, includeData: boolean = false): Promise<ExecutionDetailResponse | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const url = new URL(`${this.baseUrl}/api/v1/executions/${executionId}`);
    if (includeData) {
      url.searchParams.set('includeData', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as N8nApiExecution;
    const execution = this.transformExecution(data);

    const result: ExecutionDetailResponse = { execution };

    // Include run data if requested and available
    if (includeData && data.data?.resultData?.runData) {
      result.inputData = this.extractInputData(data.data.resultData.runData);
      result.outputData = this.extractOutputData(data.data.resultData.runData);
      result.nodeExecutions = this.extractNodeExecutions(data.data.resultData.runData);
    }

    return result;
  }

  /**
   * Get list of n8n workflows for filtering
   */
  async getWorkflows(): Promise<WorkflowSummary[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const url = new URL(`${this.baseUrl}/api/v1/workflows`);
    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { data?: N8nApiWorkflow[] };
    return (data.data || []).map((workflow: N8nApiWorkflow) => ({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      createdAt: workflow.createdAt,
    }));
  }

  /**
   * Check n8n health status
   */
  async checkHealth(): Promise<N8nDetails | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      // Try to get workflows to verify connectivity and get stats
      const workflows = await this.getWorkflows();
      const activeWorkflows = workflows.filter((w) => w.active).length;

      // Get recent executions count
      const recentExecutions = await this.getExecutions({ limit: 100 });

      return {
        type: 'n8n',
        activeWorkflows,
        recentExecutions: recentExecutions.total,
      };
    } catch (error) {
      return null;
    }
  }

  // Helper methods

  private getHeaders(): Record<string, string> {
    return {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private transformExecutions(data: N8nApiExecution[]): N8nExecution[] {
    return data.map((item) => this.transformExecution(item));
  }

  private transformExecution(item: N8nApiExecution): N8nExecution {
    const startedAt = item.startedAt;
    const stoppedAt = item.stoppedAt;
    const durationMs = stoppedAt
      ? new Date(stoppedAt).getTime() - new Date(startedAt).getTime()
      : undefined;

    // Extract task ID and phase from execution data if available
    const { taskId, phase } = this.extractTaskInfo(item);

    return {
      id: item.id,
      workflowId: item.workflowId,
      workflowName: item.workflowData?.name || 'Unknown Workflow',
      status: this.mapStatus(item),
      mode: this.mapMode(item.mode),
      startedAt,
      stoppedAt,
      durationMs,
      taskId,
      phase,
      error: item.data?.resultData?.error
        ? {
            message: item.data.resultData.error.message,
            node: item.data.resultData.error.node,
          }
        : undefined,
    };
  }

  private mapStatus(item: N8nApiExecution): ExecutionStatus {
    if (!item.finished) {
      return 'running';
    }
    if (item.status === 'waiting') {
      return 'waiting';
    }
    if (item.data?.resultData?.error) {
      return 'error';
    }
    if (item.status === 'canceled') {
      return 'canceled';
    }
    return 'success';
  }

  private mapMode(mode: string): ExecutionMode {
    switch (mode) {
      case 'manual':
        return 'manual';
      case 'trigger':
        return 'trigger';
      case 'webhook':
        return 'webhook';
      default:
        return 'internal';
    }
  }

  private extractTaskInfo(item: N8nApiExecution): { taskId?: string; phase?: PipelinePhase } {
    // Try to extract taskId and phase from execution data
    // This assumes the workflow passes these in the input data
    try {
      const runData = item.data?.resultData?.runData;
      if (runData) {
        // Check common trigger nodes for task info
        for (const nodeName of Object.keys(runData)) {
          const nodeData = runData[nodeName] as any;
          if (Array.isArray(nodeData) && nodeData.length > 0) {
            const firstRun = nodeData[0];
            const data = firstRun?.data?.main?.[0]?.[0]?.json;
            if (data?.task_id) {
              return {
                taskId: data.task_id,
                phase: data.phase as PipelinePhase,
              };
            }
          }
        }
      }
    } catch {
      // Ignore extraction errors
    }
    return {};
  }

  private extractInputData(runData: Record<string, unknown>): Record<string, unknown> {
    // Get input from the first trigger node
    try {
      for (const nodeName of Object.keys(runData)) {
        const nodeData = runData[nodeName] as any;
        if (Array.isArray(nodeData) && nodeData.length > 0) {
          const firstRun = nodeData[0];
          return firstRun?.data?.main?.[0]?.[0]?.json || {};
        }
      }
    } catch {
      // Ignore extraction errors
    }
    return {};
  }

  private extractOutputData(runData: Record<string, unknown>): Record<string, unknown> {
    // Get output from the last node in the workflow
    try {
      const nodeNames = Object.keys(runData);
      if (nodeNames.length > 0) {
        const lastNodeName = nodeNames[nodeNames.length - 1];
        const nodeData = runData[lastNodeName] as any;
        if (Array.isArray(nodeData) && nodeData.length > 0) {
          const lastRun = nodeData[nodeData.length - 1];
          return lastRun?.data?.main?.[0]?.[0]?.json || {};
        }
      }
    } catch {
      // Ignore extraction errors
    }
    return {};
  }

  private extractNodeExecutions(runData: Record<string, unknown>): ExecutionDetailResponse['nodeExecutions'] {
    const nodeExecutions: ExecutionDetailResponse['nodeExecutions'] = [];

    try {
      for (const [nodeName, nodeData] of Object.entries(runData)) {
        if (Array.isArray(nodeData) && nodeData.length > 0) {
          const run = nodeData[0] as any;
          const startedAt = run.startTime ? new Date(run.startTime).toISOString() : new Date().toISOString();
          const stoppedAt = run.endTime ? new Date(run.endTime).toISOString() : new Date().toISOString();
          const durationMs = run.executionTime || 0;

          nodeExecutions.push({
            nodeName,
            nodeType: run.source?.[0]?.previousNode || 'unknown',
            status: run.error ? 'error' : 'success',
            startedAt,
            stoppedAt,
            durationMs,
            error: run.error?.message,
          });
        }
      }
    } catch {
      // Ignore extraction errors
    }

    return nodeExecutions;
  }
}
