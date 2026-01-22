import { Router } from 'express';
import { Config } from '../../config.js';
import { createAuthMiddleware, requireAuthorizedGroup } from '../middleware/auth.js';
import { createHealthRouter } from './health.js';
import { createAuthRouter } from './auth.js';
import { createCredentialsRouter } from './credentials.js';
import { createClaudeRoutes } from './claude.js';
import { createK8sRouter } from './k8s.js';
import { createPipelineRouter } from './pipeline.js';
import { createN8nRouter } from './n8n.js';
import { createStorageRouter } from './storage.js';
import { createTasksRouter } from './tasks.js';
import { createComponentsRouter } from './components.js';
import { KubernetesService } from '../../services/kubernetes.js';
import { TokenRefreshService } from '../../services/token-refresh.js';
import { ClaudeAgentService } from '../../services/claude-agent.js';
import { CredentialsWatcherService } from '../../services/credentials-watcher.js';
import { BlobStorageService } from '../../services/blob-storage.js';
import { N8nClient } from '../../services/n8n-client.js';
import { PipelineStateService } from '../../services/pipeline-state.js';
import { TeamsWebhookService } from '../../services/teamsWebhookService.js';

export function createApiRouter(config: Config): Router {
  const router = Router();

  // Initialize services
  const k8sService = new KubernetesService(config);
  const claudeService = new ClaudeAgentService(config);
  const tokenRefreshService = new TokenRefreshService(config, k8sService, claudeService);
  const blobStorageService = new BlobStorageService(config);
  const n8nClient = new N8nClient(config);
  const pipelineService = new PipelineStateService(blobStorageService);
  const teamsService = new TeamsWebhookService(config);

  // Start credentials file watcher for auto-push on claude /login
  const credentialsWatcher = new CredentialsWatcherService(tokenRefreshService);
  credentialsWatcher.start();

  // Auth middleware
  const authMiddleware = createAuthMiddleware(config);

  // All API routes require authentication
  router.use(authMiddleware);
  router.use(requireAuthorizedGroup);

  // Mount routers
  router.use('/health', createHealthRouter(k8sService, claudeService, blobStorageService, n8nClient));
  router.use('/auth', createAuthRouter(claudeService));
  router.use('/credentials', createCredentialsRouter(tokenRefreshService, config));
  router.use('/', createClaudeRoutes(config)); // Handles /execute and /executions
  router.use('/cronjobs', createK8sRouter(k8sService));
  router.use('/pipeline', createPipelineRouter(pipelineService));
  router.use('/n8n', createN8nRouter(n8nClient));
  router.use('/storage', createStorageRouter(blobStorageService));
  router.use('/tasks', createTasksRouter(blobStorageService, n8nClient, teamsService));
  router.use('/components', createComponentsRouter(k8sService));

  return router;
}
