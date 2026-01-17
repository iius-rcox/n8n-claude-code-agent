import { Config } from '../config.js';

export interface AuthCheckResult {
  authenticated: boolean;
  exitCode: number;
  message?: string;
  lastChecked: string;
}

export interface ExecutionResult {
  exitCode: number;
  output: string;
  duration: number;
  error?: string;
  timedOut: boolean;
}

interface HealthCheckResponse {
  authenticated?: boolean;
  message?: string;
}

interface ExecuteResponse {
  exitCode?: number;
  output?: string;
  error?: string;
}

export class ClaudeAgentService {
  private serviceUrl: string;

  constructor(config: Config) {
    this.serviceUrl = config.claudeAgent.serviceUrl;
  }

  async checkAuth(): Promise<AuthCheckResult> {
    const lastChecked = new Date().toISOString();

    try {
      // Try to reach the Claude agent health endpoint
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json() as HealthCheckResponse;
        return {
          authenticated: data.authenticated !== false,
          exitCode: data.authenticated === false ? 57 : 0,
          message: data.message,
          lastChecked,
        };
      }

      // Non-OK response
      return {
        authenticated: false,
        exitCode: 1,
        message: `Health check returned status ${response.status}`,
        lastChecked,
      };
    } catch (error) {
      // Connection failed
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        authenticated: false,
        exitCode: 1,
        message: `Failed to connect to Claude agent: ${message}`,
        lastChecked,
      };
    }
  }

  async execute(prompt: string, timeoutMs: number = 300000): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.serviceUrl}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const data = await response.json() as ExecuteResponse;

      if (response.ok) {
        return {
          exitCode: data.exitCode ?? 0,
          output: data.output ?? '',
          duration,
          error: data.error,
          timedOut: false,
        };
      }

      // Error response from Claude agent
      return {
        exitCode: data.exitCode ?? 1,
        output: data.output ?? '',
        duration,
        error: data.error ?? `Request failed with status ${response.status}`,
        timedOut: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          exitCode: 124,
          output: '',
          duration,
          error: 'Execution timed out',
          timedOut: true,
        };
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        exitCode: 1,
        output: '',
        duration,
        error: `Execution failed: ${message}`,
        timedOut: false,
      };
    }
  }
}
