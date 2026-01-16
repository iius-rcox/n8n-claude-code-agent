import { Router, Request, Response, NextFunction } from 'express';
import { ClaudeAgentService } from '../../services/claude-agent.js';

export interface AuthStatusResponse {
  authenticated: boolean;
  lastChecked: string;
  exitCode?: number;
  expiryEstimate?: string;
  lastFailureTime?: string;
  message?: string;
}

export function createAuthRouter(claudeService: ClaudeAgentService): Router {
  const router = Router();

  // GET /api/auth/status - Get Claude authentication status
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await claudeService.checkAuth();

      const response: AuthStatusResponse = {
        authenticated: result.authenticated,
        lastChecked: result.lastChecked,
        exitCode: result.exitCode,
        message: result.message,
      };

      // If authenticated, estimate token expiry (approximate)
      if (result.authenticated) {
        // Claude tokens typically last ~1 hour, estimate from now
        const expiryEstimate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        response.expiryEstimate = expiryEstimate;
      } else {
        // Track failure time
        response.lastFailureTime = result.lastChecked;
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
