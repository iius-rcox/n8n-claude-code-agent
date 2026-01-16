import { Router } from 'express';
import { Config } from '../../config.js';
import { createAuthMiddleware, requireAuthorizedGroup } from '../middleware/auth.js';
import { createHealthRouter } from './health.js';
import { createAuthRouter } from './auth.js';
import { createCredentialsRouter } from './credentials.js';
import { createClaudeRoutes } from './claude.js';
import { createK8sRouter } from './k8s.js';
import { KubernetesService } from '../../services/kubernetes.js';
import { TokenRefreshService } from '../../services/token-refresh.js';
import { ClaudeAgentService } from '../../services/claude-agent.js';

export function createApiRouter(config: Config): Router {
  const router = Router();

  // Initialize services
  const k8sService = new KubernetesService(config);
  const claudeService = new ClaudeAgentService(config);
  const tokenRefreshService = new TokenRefreshService(config, k8sService, claudeService);

  // Auth middleware
  const authMiddleware = createAuthMiddleware(config);

  // All API routes require authentication
  router.use(authMiddleware);
  router.use(requireAuthorizedGroup);

  // Mount routers
  router.use('/health', createHealthRouter(k8sService, claudeService));
  router.use('/auth', createAuthRouter(claudeService));
  router.use('/credentials', createCredentialsRouter(tokenRefreshService, config));
  router.use('/', createClaudeRoutes(config)); // Handles /execute and /executions
  router.use('/cronjobs', createK8sRouter(k8sService));

  return router;
}
