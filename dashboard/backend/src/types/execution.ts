/**
 * Execution types for manual Claude agent execution
 * Per data-model.md
 */

export type ExecutionStatus = 'success' | 'error' | 'auth_failure' | 'timeout' | 'running';

/**
 * Exit code to status mapping per data-model.md
 */
export const EXIT_CODE_STATUS: Record<number, ExecutionStatus> = {
  0: 'success',
  1: 'error',
  57: 'auth_failure',
  // Timeout is handled separately by duration check
};

export function mapExitCodeToStatus(exitCode: number, timedOut: boolean): ExecutionStatus {
  if (timedOut) {
    return 'timeout';
  }
  return EXIT_CODE_STATUS[exitCode] ?? 'error';
}

export interface ExecutionRecord {
  id: string;
  prompt: string;
  status: ExecutionStatus;
  exitCode?: number;
  output?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ExecutionRequest {
  prompt: string;
}

export interface ExecutionResponse {
  id: string;
  status: ExecutionStatus;
  exitCode?: number;
  output?: string;
  errorMessage?: string;
  durationMs?: number;
}

export interface ExecutionListResponse {
  executions: ExecutionRecord[];
  total: number;
}

export interface ExecutionFilters {
  status?: ExecutionStatus;
  limit?: number;
}

/**
 * Validates execution request
 */
export function validateExecutionRequest(req: ExecutionRequest): { valid: boolean; error?: string } {
  if (!req.prompt || typeof req.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required' };
  }

  // Max 100KB per spec
  const MAX_PROMPT_SIZE = 100 * 1024;
  if (req.prompt.length > MAX_PROMPT_SIZE) {
    return { valid: false, error: `Prompt exceeds maximum size of ${MAX_PROMPT_SIZE} bytes` };
  }

  if (req.prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  return { valid: true };
}
