import { Router, Request, Response, NextFunction } from 'express';
import { TokenRefreshService } from '../../services/token-refresh.js';
import { Config } from '../../config.js';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/error.js';
import { CredentialsPush } from '../../types/token-refresh.js';

export function createCredentialsRouter(
  tokenRefreshService: TokenRefreshService,
  _config: Config
): Router {
  const router = Router();

  // POST /api/credentials/refresh - Initiate token refresh workflow
  router.post('/refresh', (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if there's already a pending operation
      const existing = tokenRefreshService.getPendingOperation();
      if (existing) {
        throw new ConflictError('A token refresh operation is already in progress');
      }

      // Get dashboard URL from request
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const dashboardUrl = `${protocol}://${host}`;

      // Get session token from authorization header for CLI command
      const authHeader = req.headers.authorization || '';
      const sessionToken = authHeader.replace('Bearer ', '');

      // Create new operation
      const operation = tokenRefreshService.createOperation(dashboardUrl);

      // Calculate expiry (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      res.json({
        operationId: operation.id,
        status: 'waiting_credentials',
        instruction: 'Run "claude /login" in your terminal. Credentials will be detected automatically.',
        expiresAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/credentials/push - Receive credentials from CLI
  router.post('/push', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const push: CredentialsPush = req.body;

      // Validate credentials
      const validation = tokenRefreshService.validateCredentials(push);
      if (!validation.valid) {
        throw new ValidationError('Invalid credentials', validation.errors);
      }

      // Find pending operation
      const operation = tokenRefreshService.getPendingOperation();
      if (!operation) {
        throw new NotFoundError('No pending refresh operation found. Initiate refresh from dashboard first.');
      }

      // Execute refresh asynchronously
      tokenRefreshService.executeRefresh(operation.id, push).catch((error) => {
        console.error('Token refresh failed:', error);
      });

      res.json({
        success: true,
        operationId: operation.id,
        message: 'Credentials received. Refresh in progress.',
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/credentials/refresh/:operationId - Get operation status
  router.get('/refresh/:operationId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { operationId } = req.params;

      const operation = tokenRefreshService.getOperation(operationId);
      if (!operation) {
        throw new NotFoundError('Operation not found');
      }

      res.json(operation);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
