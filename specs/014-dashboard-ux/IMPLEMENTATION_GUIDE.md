# Dashboard UX Improvements - Implementation Guide

**Feature**: 014-dashboard-ux
**Status**: Phase 1 Complete, Phase 2 Partial (4/14), Phases 3-4 Not Started
**Target**: MVP (User Stories 1 & 2)

This guide provides complete implementation details for all remaining tasks to deliver the MVP functionality.

---

## 📊 Current Progress

### ✅ Phase 1: COMPLETE (T001-T007)
All type definitions, constants, and utilities created:
- `dashboard/frontend/src/types/task.ts` - StuckTask, TaskError, TaskDiagnostics
- `dashboard/frontend/src/types/auth.ts` - TokenExpiration, TokenStatus
- `dashboard/frontend/src/types/component.ts` - BulkActionState, Component
- `dashboard/frontend/src/types/storage.ts` - FileSearchState, BlobItem
- `dashboard/frontend/src/constants/thresholds.ts` - All timing constants
- `dashboard/frontend/src/utils/formatting.ts` - Duration/parsing utilities

### 🔄 Phase 2: IN PROGRESS (4/14 complete)
**Completed**:
- T008: n8n-client.ts - Added `retryWorkflow()` method
- T009: teamsWebhookService.ts - Full Teams integration
- T010: kubernetes.ts - Added bulk operations methods
- T011: blob-storage.ts - **NEEDS COMPLETION** (see below)

**Remaining**: T012-T021 (API routes and integration)

---

## 🛠️ Remaining Implementation Tasks

---

## Phase 2: Foundational Backend (Remaining)

### T011: Azure Blob Storage Service Extensions (INCOMPLETE)

**File**: `dashboard/backend/src/services/blob-storage.ts`

**Add before closing brace `}`**:

```typescript
/**
 * Get task envelope from blob storage
 */
async getTaskEnvelope(taskId: string): Promise<{
  taskId: string;
  title: string;
  currentPhase: string;
  phases: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
} | null> {
  try {
    const containerClient = this.blobServiceClient.getContainerClient('agent-state');
    const blobClient = containerClient.getBlobClient(`${taskId}/task-envelope.yml`);

    const downloadResponse = await blobClient.download();
    const content = await this.streamToString(downloadResponse.readableStreamBody!);

    // Parse YAML (note: you'll need to add 'js-yaml' package)
    const yaml = require('js-yaml');
    const envelope = yaml.load(content);

    return envelope;
  } catch (error) {
    if ((error as any)?.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Search blobs in container by substring matching
 */
async searchBlobs(
  containerName: string,
  query: string,
  limit: number = 1000
): Promise<Array<{
  name: string;
  container: string;
  size: number;
  lastModified: string;
  matchIndex: number;
}>> {
  const startTime = Date.now();
  const results: Array<{
    name: string;
    container: string;
    size: number;
    lastModified: string;
    matchIndex: number;
  }> = [];

  try {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const lowerQuery = query.toLowerCase();

    for await (const blob of containerClient.listBlobsFlat()) {
      const lowerName = blob.name.toLowerCase();
      const matchIndex = lowerName.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        results.push({
          name: blob.name,
          container: containerName,
          size: blob.properties.contentLength || 0,
          lastModified: blob.properties.lastModified?.toISOString() || '',
          matchIndex,
        });

        if (results.length >= limit) {
          break;
        }
      }
    }

    // Sort by match position (earlier matches first)
    results.sort((a, b) => a.matchIndex - b.matchIndex);

    return results;
  } catch (error) {
    throw new Error(`Failed to search blobs in ${containerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Install dependency**:
```bash
cd dashboard/backend
npm install js-yaml
npm install --save-dev @types/js-yaml
```

---

### T012: POST /api/tasks/:id/retry Endpoint

**File**: `dashboard/backend/src/api/routes/tasks.ts`

**Create new file** (if doesn't exist):

```typescript
import { Router, Request, Response } from 'express';
import { N8nClient } from '../../services/n8n-client.js';
import { BlobStorageService } from '../../services/blob-storage.js';
import { Config } from '../../config.js';

export function createTasksRouter(config: Config): Router {
  const router = Router();
  const n8nClient = new N8nClient(config);
  const blobStorage = new BlobStorageService(config);

  /**
   * POST /api/tasks/:id/retry
   * Retry a stuck task by restarting the n8n workflow
   */
  router.post('/:taskId/retry', async (req: Request, res: Response) => {
    const { taskId } = req.params;

    try {
      // 1. Get task envelope to verify it exists and is stuck
      const envelope = await blobStorage.getTaskEnvelope(taskId);
      if (!envelope) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task ${taskId} not found in Azure Blob Storage`,
          statusCode: 404,
        });
      }

      // 2. Check if task is actually stuck (>30 minutes in current phase)
      const currentPhase = envelope.phases[envelope.currentPhase];
      if (currentPhase?.startedAt) {
        const startedAt = new Date(currentPhase.startedAt);
        const durationMs = Date.now() - startedAt.getTime();
        const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

        if (durationMs < STUCK_THRESHOLD_MS) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Task ${taskId} is not stuck (current duration: ${Math.round(durationMs / 60000)} minutes)`,
            statusCode: 400,
          });
        }
      }

      // 3. Get the workflow ID for this phase
      // Assume workflow naming convention: "Agent Dev Team - {phase}"
      const workflowName = `Agent Dev Team - ${envelope.currentPhase}`;
      const workflows = await n8nClient.getWorkflows();
      const workflow = workflows.find(w => w.name === workflowName);

      if (!workflow) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: `Workflow not found for phase: ${envelope.currentPhase}`,
          statusCode: 500,
        });
      }

      // 4. Retry the workflow
      const retryResult = await n8nClient.retryWorkflow(workflow.id, {
        taskId: taskId,
        phase: envelope.currentPhase,
      });

      if (!retryResult.success) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: `Failed to retry workflow: ${retryResult.error}`,
          statusCode: 500,
        });
      }

      // 5. Return success
      res.json({
        status: 'retrying',
        executionId: retryResult.executionId,
        message: 'Task retry initiated successfully',
        taskId: taskId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Error retrying task ${taskId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });

  return router;
}
```

---

### T013: GET /api/tasks/:id/diagnostics Endpoint

**File**: `dashboard/backend/src/api/routes/tasks.ts` (add to existing router)

**Add after retry endpoint**:

```typescript
  /**
   * GET /api/tasks/:id/diagnostics
   * Get diagnostic information for a stuck task
   */
  router.get('/:taskId/diagnostics', async (req: Request, res: Response) => {
    const { taskId } = req.params;

    try {
      // 1. Get task envelope
      const envelope = await blobStorage.getTaskEnvelope(taskId);
      if (!envelope) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task ${taskId} not found`,
          statusCode: 404,
        });
      }

      // 2. Get current phase info
      const currentPhase = envelope.phases[envelope.currentPhase];
      const startedAt = new Date(currentPhase?.startedAt || Date.now());
      const stuckDuration = Date.now() - startedAt.getTime();

      // 3. Get execution history from n8n
      const executions = await n8nClient.getExecutions({
        taskId: taskId,
        limit: 10,
      });

      // 4. Extract last error and retry history
      const failedExecutions = executions.executions.filter(e => e.status === 'error');
      const lastError = failedExecutions[0]?.error;

      const retryHistory = failedExecutions.slice(0, 5).map(exec => ({
        timestamp: exec.startedAt,
        result: 'failure',
        message: exec.error?.message || 'Unknown error',
        executionId: exec.id,
      }));

      // 5. Check system health
      const n8nHealth = await n8nClient.checkHealth();

      // 6. Build diagnostics response
      res.json({
        taskId: taskId,
        currentPhase: envelope.currentPhase,
        stuckSince: startedAt.toISOString(),
        stuckDuration: stuckDuration,
        lastError: lastError ? {
          message: lastError.message,
          phase: envelope.currentPhase,
          timestamp: failedExecutions[0].startedAt,
          logs: ['See n8n execution logs for details'], // TODO: Fetch actual logs
          errorCode: lastError.node ? 'NODE_EXECUTION_FAILED' : 'WORKFLOW_FAILED',
        } : undefined,
        executionId: currentPhase?.executionId || 'unknown',
        retryHistory: retryHistory,
        systemState: {
          n8nStatus: n8nHealth ? 'healthy' : 'down',
          agentStatus: 'healthy', // TODO: Check agent pod status
          storageStatus: 'healthy', // Blob storage is working if we got here
        },
      });
    } catch (error) {
      console.error(`Error getting diagnostics for task ${taskId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });
```

---

### T014: POST /api/tasks/:id/escalate Endpoint

**File**: `dashboard/backend/src/api/routes/tasks.ts` (add to existing router)

**Import at top**:
```typescript
import { TeamsWebhookService } from '../../services/teamsWebhookService.js';
```

**Add to router creation**:
```typescript
const teamsWebhook = new TeamsWebhookService(config);
```

**Add after diagnostics endpoint**:

```typescript
  /**
   * POST /api/tasks/:id/escalate
   * Escalate a stuck task to on-call team via Teams
   */
  router.post('/:taskId/escalate', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { reason } = req.body;

    try {
      // 1. Get task envelope
      const envelope = await blobStorage.getTaskEnvelope(taskId);
      if (!envelope) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task ${taskId} not found`,
          statusCode: 404,
        });
      }

      // 2. Calculate stuck duration
      const currentPhase = envelope.phases[envelope.currentPhase];
      const startedAt = new Date(currentPhase?.startedAt || Date.now());
      const stuckDuration = Date.now() - startedAt.getTime();

      // Format duration as human-readable
      const hours = Math.floor(stuckDuration / (60 * 60 * 1000));
      const minutes = Math.floor((stuckDuration % (60 * 60 * 1000)) / (60 * 1000));
      const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // 3. Get last error if available
      const executions = await n8nClient.getExecutions({
        taskId: taskId,
        limit: 1,
        status: 'error',
      });
      const lastError = executions.executions[0]?.error?.message;

      // 4. Send Teams notification
      const result = await teamsWebhook.sendEscalation({
        taskId: taskId,
        title: envelope.title || taskId,
        currentPhase: envelope.currentPhase,
        stuckDuration: durationStr,
        lastError: lastError,
        dashboardUrl: `${config.dashboard.url}/tasks/${taskId}`,
        escalatedBy: req.user?.email || 'Dashboard Operator', // Assumes auth middleware sets req.user
        reason: reason,
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: `Failed to send Teams notification: ${result.error}`,
          statusCode: 500,
          details: {
            teamsError: result.error,
          },
        });
      }

      // 5. Return success
      res.json({
        taskId: taskId,
        escalatedAt: new Date().toISOString(),
        teamsMessageId: result.messageId,
        status: 'pending',
      });
    } catch (error) {
      console.error(`Error escalating task ${taskId}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });
```

---

### T015: GET /api/auth/status Endpoint

**File**: `dashboard/backend/src/api/routes/auth.ts`

**Check if file exists, if so extend it. Otherwise create**:

```typescript
import { Router, Request, Response } from 'express';
import { KubernetesService } from '../../services/kubernetes.js';
import { Config } from '../../config.js';

export function createAuthRouter(config: Config): Router {
  const router = Router();
  const k8sService = new KubernetesService(config);

  /**
   * GET /api/auth/status
   * Get current authentication token status including expiration
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      // 1. Read claude-session secret from Kubernetes
      const secret = await k8sService.getSecret('claude-session');

      if (!secret || !secret.data) {
        return res.json({
          authenticated: false,
          method: 'session',
          error: 'Token not configured',
        });
      }

      // 2. Parse session data to determine token type and expiration
      // The secret contains base64-encoded session data
      // Format depends on Claude CLI session structure

      // Decode the session data
      const sessionData = secret.data['session.json'];
      if (!sessionData) {
        return res.json({
          authenticated: false,
          method: 'session',
          error: 'Session data not found',
        });
      }

      const sessionStr = Buffer.from(sessionData, 'base64').toString('utf-8');
      const session = JSON.parse(sessionStr);

      // 3. Determine token type and expiration
      let method: 'session' | 'long-lived' = 'session';
      let expiresAt: string | undefined;

      if (session.expiresAt) {
        expiresAt = session.expiresAt;
      } else if (session.expires_at) {
        expiresAt = session.expires_at;
      } else {
        // No expiration means long-lived token
        method = 'long-lived';
      }

      // 4. Return status
      res.json({
        authenticated: true,
        method: method,
        expiresAt: expiresAt,
        lastRefreshed: secret.metadata?.creationTimestamp,
      });
    } catch (error) {
      console.error('Error getting auth status:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to read authentication secret from Kubernetes',
        statusCode: 500,
      });
    }
  });

  return router;
}
```

---

### T016: POST /api/components/bulk-restart Endpoint

**File**: `dashboard/backend/src/api/routes/components.ts`

**Create new file**:

```typescript
import { Router, Request, Response } from 'express';
import { KubernetesService } from '../../services/kubernetes.js';
import { Config } from '../../config.js';

export function createComponentsRouter(config: Config): Router {
  const router = Router();
  const k8sService = new KubernetesService(config);

  /**
   * POST /api/components/bulk-restart
   * Restart multiple components simultaneously
   */
  router.post('/bulk-restart', async (req: Request, res: Response) => {
    const { componentIds } = req.body;

    // Validate request
    if (!Array.isArray(componentIds) || componentIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'componentIds must be a non-empty array',
        statusCode: 400,
      });
    }

    if (componentIds.length > 50) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 50 components allowed per bulk restart request',
        statusCode: 400,
      });
    }

    try {
      // Extract pod names from component IDs
      // Format: "namespace/pod/name" -> extract "name"
      const podNames = componentIds.map(id => {
        const parts = id.split('/');
        if (parts.length !== 3 || parts[1] !== 'pod') {
          throw new Error(`Invalid component ID format: ${id}`);
        }
        return parts[2];
      });

      // Execute bulk restart
      const results = await k8sService.bulkRestartPods(podNames);

      // Transform results to match API contract
      const apiResults = results.map(result => ({
        componentId: `${config.claudeAgent.namespace}/pod/${result.podName}`,
        componentName: result.podName,
        status: result.success ? 'success' : 'failure',
        message: result.success ? 'Pod restart initiated' : result.error || 'Unknown error',
        timestamp: new Date().toISOString(),
      }));

      // Calculate summary
      const summary = {
        total: apiResults.length,
        succeeded: apiResults.filter(r => r.status === 'success').length,
        failed: apiResults.filter(r => r.status === 'failure').length,
        pending: 0,
      };

      res.json({
        results: apiResults,
        summary: summary,
      });
    } catch (error) {
      console.error('Error in bulk restart:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });

  return router;
}
```

---

### T017: POST /api/components/logs Endpoint

**File**: `dashboard/backend/src/api/routes/components.ts` (add to existing router)

**Add after bulk-restart endpoint**:

```typescript
  /**
   * POST /api/components/logs
   * Fetch logs for multiple components
   */
  router.post('/logs', async (req: Request, res: Response) => {
    const { componentIds, lines = 100 } = req.body;

    // Validate request
    if (!Array.isArray(componentIds) || componentIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'componentIds must be a non-empty array',
        statusCode: 400,
      });
    }

    if (componentIds.length > 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Maximum 10 components allowed per bulk logs request',
        statusCode: 400,
      });
    }

    if (lines < 1 || lines > 1000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'lines must be between 1 and 1000',
        statusCode: 400,
      });
    }

    try {
      // Extract pod names from component IDs
      const podNames = componentIds.map(id => {
        const parts = id.split('/');
        if (parts.length !== 3 || parts[1] !== 'pod') {
          throw new Error(`Invalid component ID format: ${id}`);
        }
        return parts[2];
      });

      // Fetch logs in parallel
      const results = await k8sService.bulkGetPodLogs(podNames, lines);

      // Transform to API format
      const apiResults = results.map(result => ({
        componentId: `${config.claudeAgent.namespace}/pod/${result.podName}`,
        componentName: result.podName,
        lines: result.logs,
        timestamp: new Date().toISOString(),
      }));

      res.json({
        logs: apiResults,
      });
    } catch (error) {
      console.error('Error fetching bulk logs:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });
```

---

### T018: GET /api/storage/:container/search Endpoint

**File**: `dashboard/backend/src/api/routes/storage.ts`

**Check if exists and extend, or create**:

```typescript
import { Router, Request, Response } from 'express';
import { BlobStorageService } from '../../services/blob-storage.js';
import { Config } from '../../config.js';

export function createStorageRouter(config: Config): Router {
  const router = Router();
  const blobStorage = new BlobStorageService(config);

  /**
   * GET /api/storage/:container/search
   * Search files in storage container
   */
  router.get('/:container/search', async (req: Request, res: Response) => {
    const { container } = req.params;
    const { query, limit = '1000' } = req.query;

    // Validate container name
    const validContainers = [
      'agent-state',
      'agent-spec',
      'agent-plan',
      'agent-verification',
      'agent-review',
      'agent-release',
    ];

    if (!validContainers.includes(container)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid container name. Must be one of: ${validContainers.join(', ')}`,
        statusCode: 400,
      });
    }

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query cannot be empty',
        statusCode: 400,
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query must be 100 characters or less',
        statusCode: 400,
      });
    }

    try {
      const startTime = Date.now();
      const limitNum = Math.min(parseInt(limit as string) || 1000, 1000);

      // Perform search
      const results = await blobStorage.searchBlobs(container, query, limitNum);

      // Get total blob count in container (for context)
      const allBlobs = await blobStorage.listBlobs(container, '');
      const totalCount = allBlobs.blobs.length;

      const performanceMs = Date.now() - startTime;

      res.json({
        query: query,
        container: container,
        results: results,
        matchCount: results.length,
        totalCount: totalCount,
        performanceMs: performanceMs,
      });
    } catch (error) {
      console.error(`Error searching storage container ${container}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      });
    }
  });

  return router;
}
```

---

### T019: Register New Routes in Express App

**File**: `dashboard/backend/src/api/routes/index.ts`

**Check current structure and add imports**:

```typescript
import { createTasksRouter } from './tasks.js';
import { createComponentsRouter } from './components.js';
// ... existing imports

export function registerRoutes(app: Express, config: Config): void {
  // ... existing route registrations

  // New routes for dashboard UX improvements
  app.use('/api/tasks', createTasksRouter(config));
  app.use('/api/components', createComponentsRouter(config));

  // Storage route likely already exists, but ensure search endpoint is available
  // If not, add: app.use('/api/storage', createStorageRouter(config));
}
```

**Alternative if index.ts structure is different**:

Check `dashboard/backend/src/index.ts` or `dashboard/backend/src/api/routes/index.ts` for the actual Express app setup and add routes there.

---

### T020: Add Request Validation Middleware

**File**: `dashboard/backend/src/api/middleware/validation.ts`

**Create or extend**:

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Validate task ID format
 */
export function validateTaskId(req: Request, res: Response, next: NextFunction): void {
  const { taskId } = req.params;

  // Task ID format: TASK-001 or FEAT-1234567890-abc
  const taskIdPattern = /^[A-Z]+-[0-9a-z-]+$/;

  if (!taskIdPattern.test(taskId)) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Invalid task ID format: ${taskId}`,
      statusCode: 400,
    });
    return;
  }

  next();
}

/**
 * Validate component ID format
 */
export function validateComponentId(componentId: string): boolean {
  // Format: namespace/resource-type/name
  const parts = componentId.split('/');
  return parts.length === 3 && ['pod', 'deployment', 'cronjob'].includes(parts[1]);
}

/**
 * Validate request body for bulk operations
 */
export function validateBulkRequest(
  maxItems: number
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { componentIds } = req.body;

    if (!Array.isArray(componentIds)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'componentIds must be an array',
        statusCode: 400,
      });
      return;
    }

    if (componentIds.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'componentIds cannot be empty',
        statusCode: 400,
      });
      return;
    }

    if (componentIds.length > maxItems) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Maximum ${maxItems} items allowed`,
        statusCode: 400,
      });
      return;
    }

    // Validate each component ID format
    for (const id of componentIds) {
      if (typeof id !== 'string' || !validateComponentId(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid component ID format: ${id}`,
          statusCode: 400,
        });
        return;
      }
    }

    next();
  };
}
```

**Apply validation to routes**:

In `tasks.ts`:
```typescript
import { validateTaskId } from '../middleware/validation.js';

router.post('/:taskId/retry', validateTaskId, async (req, res) => { ... });
router.get('/:taskId/diagnostics', validateTaskId, async (req, res) => { ... });
router.post('/:taskId/escalate', validateTaskId, async (req, res) => { ... });
```

In `components.ts`:
```typescript
import { validateBulkRequest } from '../middleware/validation.js';

router.post('/bulk-restart', validateBulkRequest(50), async (req, res) => { ... });
router.post('/logs', validateBulkRequest(10), async (req, res) => { ... });
```

---

### T021: Add Error Handling Middleware

**File**: `dashboard/backend/src/api/middleware/errorHandler.ts`

**Create or extend**:

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler for API routes
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('API Error:', err);

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Determine status code
  let statusCode = 500;
  let errorType = 'Internal Server Error';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'Bad Request';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorType = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorType = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorType = 'Not Found';
  }

  // Send error response
  res.status(statusCode).json({
    error: errorType,
    message: message,
    statusCode: statusCode,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
}
```

**Register in Express app**:

```typescript
// In dashboard/backend/src/index.ts or similar

import { errorHandler, notFoundHandler } from './api/middleware/errorHandler.js';

// ... after all route registrations

app.use(notFoundHandler);
app.use(errorHandler);
```

---

## ✅ Phase 2 Complete Checklist

After implementing T011-T021:

```bash
# Test backend services
cd dashboard/backend
npm run build
npm run lint

# Verify TypeScript compiles
tsc --noEmit

# Test individual endpoints (requires backend running)
curl -X POST http://localhost:3001/api/tasks/TASK-001/retry
curl http://localhost:3001/api/tasks/TASK-001/diagnostics
curl http://localhost:3001/api/auth/status
```

---

## Phase 3: User Story 1 - Stuck Task Resolution

### Frontend Hooks

### T022: useStuckTasks Hook

**File**: `dashboard/frontend/src/hooks/useStuckTasks.ts`

```typescript
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StuckTask, RetryResult } from '../types/task';
import { retryTask, escalateTask } from '../services/tasksApi';
import { STUCK_TASK_THRESHOLD_MS } from '../constants/thresholds';

/**
 * Hook for detecting stuck tasks and performing actions
 */
export function useStuckTasks(tasks: Array<{
  id: string;
  title: string;
  currentPhase: string;
  phases: Record<string, any>;
}>) {
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);
  const queryClient = useQueryClient();

  // Detect stuck tasks
  useEffect(() => {
    const stuck: StuckTask[] = [];
    const now = Date.now();

    for (const task of tasks) {
      const phaseData = task.phases[task.currentPhase];
      if (!phaseData?.startedAt) continue;

      const startedAt = new Date(phaseData.startedAt);
      const duration = now - startedAt.getTime();

      if (duration > STUCK_TASK_THRESHOLD_MS) {
        stuck.push({
          id: task.id,
          title: task.title,
          currentPhase: task.currentPhase as any,
          stuckSince: startedAt,
          stuckDuration: duration,
          lastError: phaseData.error ? {
            message: phaseData.error.message || 'Unknown error',
            phase: task.currentPhase as any,
            timestamp: new Date(phaseData.error.timestamp || Date.now()),
            logs: phaseData.error.logs || [],
          } : undefined,
          retryCount: phaseData.retryCount || 0,
        });
      }
    }

    setStuckTasks(stuck);
  }, [tasks]);

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (taskId: string) => retryTask(taskId),
    onSuccess: (data, taskId) => {
      // Invalidate task queries to refetch
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) =>
      escalateTask(taskId, reason),
    onSuccess: (data, { taskId }) => {
      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  return {
    stuckTasks,
    retryTask: (taskId: string) => retryMutation.mutate(taskId),
    escalateTask: (taskId: string, reason?: string) =>
      escalateMutation.mutate({ taskId, reason }),
    isRetrying: retryMutation.isPending,
    isEscalating: escalateMutation.isPending,
  };
}
```

---

### T023: useTaskDiagnostics Hook

**File**: `dashboard/frontend/src/hooks/useTaskDiagnostics.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { TaskDiagnostics } from '../types/task';
import { getTaskDiagnostics } from '../services/tasksApi';

/**
 * Hook for fetching task diagnostic information
 */
export function useTaskDiagnostics(taskId: string | null) {
  return useQuery<TaskDiagnostics>({
    queryKey: ['taskDiagnostics', taskId],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required');
      return getTaskDiagnostics(taskId);
    },
    enabled: !!taskId, // Only fetch when taskId is provided
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute while modal open
  });
}
```

---

### Frontend Services

### T024: tasksApi Service

**File**: `dashboard/frontend/src/services/tasksApi.ts`

```typescript
import { RetryResult, TaskDiagnostics } from '../types/task';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Retry a stuck task
 */
export async function retryTask(taskId: string): Promise<RetryResult> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/retry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include auth cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to retry task');
  }

  return response.json();
}

/**
 * Get diagnostic information for a stuck task
 */
export async function getTaskDiagnostics(taskId: string): Promise<TaskDiagnostics> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/diagnostics`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get diagnostics');
  }

  const data = await response.json();

  // Transform ISO strings to Date objects
  return {
    ...data,
    stuckSince: new Date(data.stuckSince),
    lastError: data.lastError ? {
      ...data.lastError,
      timestamp: new Date(data.lastError.timestamp),
    } : undefined,
    retryHistory: data.retryHistory.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    })),
  };
}

/**
 * Escalate a stuck task to on-call team
 */
export async function escalateTask(taskId: string, reason?: string): Promise<{
  taskId: string;
  escalatedAt: Date;
  teamsMessageId?: string;
  status: string;
}> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/escalate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to escalate task');
  }

  const data = await response.json();

  return {
    ...data,
    escalatedAt: new Date(data.escalatedAt),
  };
}
```

---

### Frontend Components

### T025: StuckTaskActions Component

**File**: `dashboard/frontend/src/components/pipeline/StuckTaskActions.tsx`

```typescript
import { useState } from 'react';
import { StuckTask } from '../../types/task';
import { useStuckTasks } from '../../hooks/useStuckTasks';
import { Button } from '../shared/Button';
import { DiagnosticModal } from './DiagnosticModal';

interface StuckTaskActionsProps {
  task: StuckTask;
}

export function StuckTaskActions({ task }: StuckTaskActionsProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { retryTask, escalateTask, isRetrying, isEscalating } = useStuckTasks([]);

  const handleRetry = () => {
    retryTask(task.id);
  };

  const handleEscalate = () => {
    const reason = prompt('Escalation reason (optional):');
    escalateTask(task.id, reason || undefined);
  };

  return (
    <div className="stuck-task-actions">
      <div className="actions-container">
        <Button
          variant="primary"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? 'Retrying...' : 'Retry Task'}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowDiagnostics(true)}
        >
          Why Stuck?
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={handleEscalate}
          disabled={isEscalating}
        >
          {isEscalating ? 'Escalating...' : 'Escalate'}
        </Button>
      </div>

      {showDiagnostics && (
        <DiagnosticModal
          taskId={task.id}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
}
```

---

### T026: DiagnosticModal Component

**File**: `dashboard/frontend/src/components/pipeline/DiagnosticModal.tsx`

```typescript
import { useTaskDiagnostics } from '../../hooks/useTaskDiagnostics';
import { Modal } from '../shared/Modal';
import { formatDuration } from '../../utils/formatting';

interface DiagnosticModalProps {
  taskId: string;
  onClose: () => void;
}

export function DiagnosticModal({ taskId, onClose }: DiagnosticModalProps) {
  const { data: diagnostics, isLoading, error } = useTaskDiagnostics(taskId);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Diagnostics: ${taskId}`}
      size="large"
    >
      {isLoading && <div className="loading-spinner">Loading diagnostics...</div>}

      {error && (
        <div className="error-message">
          Failed to load diagnostics: {error.message}
        </div>
      )}

      {diagnostics && (
        <div className="diagnostics-content">
          {/* Current Status */}
          <section className="diagnostic-section">
            <h3>Current Status</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Phase:</span>
                <span className="value">{diagnostics.currentPhase}</span>
              </div>
              <div className="info-item">
                <span className="label">Stuck Since:</span>
                <span className="value">
                  {diagnostics.stuckSince.toLocaleString()}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Stuck Duration:</span>
                <span className="value">
                  {formatDuration(diagnostics.stuckDuration)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Execution ID:</span>
                <span className="value">{diagnostics.executionId}</span>
              </div>
            </div>
          </section>

          {/* Last Error */}
          {diagnostics.lastError && (
            <section className="diagnostic-section">
              <h3>Last Error</h3>
              <div className="error-details">
                <p className="error-message">{diagnostics.lastError.message}</p>
                {diagnostics.lastError.errorCode && (
                  <p className="error-code">Code: {diagnostics.lastError.errorCode}</p>
                )}
                {diagnostics.lastError.logs.length > 0 && (
                  <div className="error-logs">
                    <h4>Recent Logs:</h4>
                    <pre>{diagnostics.lastError.logs.join('\n')}</pre>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Retry History */}
          {diagnostics.retryHistory.length > 0 && (
            <section className="diagnostic-section">
              <h3>Retry History</h3>
              <ul className="retry-list">
                {diagnostics.retryHistory.map((attempt, idx) => (
                  <li key={idx} className={`retry-item ${attempt.result}`}>
                    <span className="retry-timestamp">
                      {attempt.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="retry-result">{attempt.result}</span>
                    <span className="retry-message">{attempt.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* System Health */}
          <section className="diagnostic-section">
            <h3>System Health</h3>
            <div className="health-grid">
              <div className={`health-item ${diagnostics.systemState.n8nStatus}`}>
                <span className="health-label">n8n:</span>
                <span className="health-value">{diagnostics.systemState.n8nStatus}</span>
              </div>
              <div className={`health-item ${diagnostics.systemState.agentStatus}`}>
                <span className="health-label">Agent:</span>
                <span className="health-value">{diagnostics.systemState.agentStatus}</span>
              </div>
              <div className={`health-item ${diagnostics.systemState.storageStatus}`}>
                <span className="health-label">Storage:</span>
                <span className="health-value">{diagnostics.systemState.storageStatus}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
```

---

### T027: TaskRetryButton Component

**File**: `dashboard/frontend/src/components/pipeline/TaskRetryButton.tsx`

```typescript
import { useState } from 'react';
import { Button } from '../shared/Button';

interface TaskRetryButtonProps {
  taskId: string;
  onRetry: (taskId: string) => void;
  isRetrying: boolean;
}

export function TaskRetryButton({ taskId, onRetry, isRetrying }: TaskRetryButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    if (showConfirm) {
      onRetry(taskId);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      // Auto-hide confirm after 3 seconds
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  return (
    <Button
      variant={showConfirm ? 'danger' : 'primary'}
      size="sm"
      onClick={handleClick}
      disabled={isRetrying}
      className="task-retry-button"
    >
      {isRetrying ? (
        <>
          <span className="spinner" />
          Retrying...
        </>
      ) : showConfirm ? (
        'Click again to confirm'
      ) : (
        'Retry Task'
      )}
    </Button>
  );
}
```

---

### Frontend Integration

### T028: Modify TaskCard Component

**File**: `dashboard/frontend/src/components/pipeline/TaskCard.tsx`

**Add at top of file**:
```typescript
import { StuckTaskActions } from './StuckTaskActions';
import { STUCK_TASK_THRESHOLD_MS } from '../../constants/thresholds';
```

**In the TaskCard component, add stuck detection logic**:

```typescript
// Calculate if task is stuck
const isStuck = useMemo(() => {
  if (!task.phases || !task.currentPhase) return false;

  const phaseData = task.phases[task.currentPhase];
  if (!phaseData?.startedAt) return false;

  const startedAt = new Date(phaseData.startedAt);
  const duration = Date.now() - startedAt.getTime();

  return duration > STUCK_TASK_THRESHOLD_MS;
}, [task]);

// Convert task to StuckTask if needed
const stuckTask = useMemo(() => {
  if (!isStuck) return null;

  const phaseData = task.phases[task.currentPhase];
  const startedAt = new Date(phaseData.startedAt);

  return {
    id: task.id,
    title: task.title,
    currentPhase: task.currentPhase,
    stuckSince: startedAt,
    stuckDuration: Date.now() - startedAt.getTime(),
    lastError: phaseData.error,
    retryCount: phaseData.retryCount || 0,
  };
}, [isStuck, task]);
```

**In the JSX, add stuck indicator and actions**:

```typescript
return (
  <div className={`task-card ${isStuck ? 'stuck' : ''}`}>
    {/* Existing task card content */}

    {/* Add stuck indicator */}
    {isStuck && (
      <div className="stuck-indicator">
        ⚠️ Task stuck for {formatDuration(stuckTask!.stuckDuration)}
      </div>
    )}

    {/* Add stuck task actions */}
    {isStuck && stuckTask && (
      <StuckTaskActions task={stuckTask} />
    )}
  </div>
);
```

---

### T029: Add Pulse Animation CSS

**File**: `dashboard/frontend/src/components/pipeline/TaskCard.css`

**Add to existing CSS**:

```css
/* Stuck task styling */
.task-card.stuck {
  border: 2px solid var(--color-warning);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(255, 193, 7, 0);
  }
}

.stuck-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: var(--color-warning-light);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-warning-dark);
  margin-bottom: 0.75rem;
}

.stuck-task-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.actions-container {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
```

---

### T030: Update Toast Component

**File**: `dashboard/frontend/src/components/shared/Toast.tsx`

**Add escalation toast support**:

```typescript
// Add new toast type
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'escalation';

// In toast rendering logic, add escalation styling
const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ';
    case 'escalation': return '🚨';
    default: return '';
  }
};

// Add escalation toast trigger
export function showEscalationToast(taskId: string, teamNotified: boolean) {
  showToast({
    type: 'escalation',
    title: 'Task Escalated',
    message: teamNotified
      ? `Task ${taskId} escalated to on-call team via Teams`
      : `Task ${taskId} escalated (Teams notification failed)`,
    duration: 5000,
  });
}
```

---

## Phase 4: User Story 2 - Token Expiration Countdown

### T031: useTokenExpiration Hook

**File**: `dashboard/frontend/src/hooks/useTokenExpiration.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { TokenExpiration, TokenStatus } from '../types/auth';
import { getTokenStatus } from '../services/authApi';
import { TOKEN_POLL_INTERVAL_MS, TOKEN_WARNING_THRESHOLD_MS, TOKEN_CRITICAL_THRESHOLD_MS } from '../constants/thresholds';

/**
 * Hook for tracking token expiration with 60-second polling
 */
export function useTokenExpiration() {
  const query = useQuery<TokenStatus>({
    queryKey: ['tokenStatus'],
    queryFn: getTokenStatus,
    refetchInterval: TOKEN_POLL_INTERVAL_MS, // Poll every 60 seconds
    staleTime: TOKEN_POLL_INTERVAL_MS - 1000, // Consider stale after 59 seconds
  });

  // Transform to TokenExpiration with urgency level
  const tokenExpiration: TokenExpiration | null = query.data ? {
    method: query.data.method,
    expiresAt: query.data.expiresAt ? new Date(query.data.expiresAt) : undefined,
    remainingMs: query.data.expiresAt
      ? Math.max(0, new Date(query.data.expiresAt).getTime() - Date.now())
      : undefined,
    urgencyLevel: calculateUrgency(query.data.expiresAt),
    lastRefreshed: query.data.lastRefreshed ? new Date(query.data.lastRefreshed) : undefined,
  } : null;

  return {
    tokenExpiration,
    isLoading: query.isLoading,
    error: query.error,
  };
}

function calculateUrgency(expiresAt?: string): 'safe' | 'warning' | 'critical' {
  if (!expiresAt) return 'safe'; // Long-lived token

  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs < TOKEN_CRITICAL_THRESHOLD_MS) return 'critical'; // <10 min
  if (remainingMs < TOKEN_WARNING_THRESHOLD_MS) return 'warning'; // <30 min
  return 'safe';
}
```

---

### T032: useCountdown Hook

**File**: `dashboard/frontend/src/hooks/useCountdown.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * Hook for real-time countdown calculation
 */
export function useCountdown(targetDate: Date | undefined) {
  const [remainingMs, setRemainingMs] = useState<number | undefined>();

  useEffect(() => {
    if (!targetDate) {
      setRemainingMs(undefined);
      return;
    }

    // Initial calculation
    const calculate = () => {
      const remaining = targetDate.getTime() - Date.now();
      setRemainingMs(Math.max(0, remaining));
    };

    calculate();

    // Update every second
    const interval = setInterval(calculate, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return remainingMs;
}
```

---

### T033: Extend authApi Service

**File**: `dashboard/frontend/src/services/authApi.ts`

**Add or extend**:

```typescript
import { TokenStatus, RefreshTokenRequest, RefreshTokenResponse } from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get current authentication token status
 */
export async function getTokenStatus(): Promise<TokenStatus> {
  const response = await fetch(`${API_BASE}/api/auth/status`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get token status');
  }

  return response.json();
}

/**
 * Refresh authentication token
 */
export async function refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh token');
  }

  return response.json();
}
```

---

### T034: CountdownTimer Component

**File**: `dashboard/frontend/src/components/auth/CountdownTimer.tsx`

```typescript
import { useCountdown } from '../../hooks/useCountdown';
import { TokenExpiration } from '../../types/auth';
import { formatDuration } from '../../utils/formatting';

interface CountdownTimerProps {
  tokenExpiration: TokenExpiration;
}

export function CountdownTimer({ tokenExpiration }: CountdownTimerProps) {
  const remainingMs = useCountdown(tokenExpiration.expiresAt);

  if (!remainingMs) {
    return (
      <div className="countdown-timer long-lived">
        <span className="timer-icon">∞</span>
        <span className="timer-text">Long-lived token (no expiration)</span>
      </div>
    );
  }

  const urgencyClass = tokenExpiration.urgencyLevel;

  return (
    <div className={`countdown-timer ${urgencyClass}`}>
      <div className="timer-display">
        <span className="timer-icon">
          {urgencyClass === 'critical' ? '🔴' : urgencyClass === 'warning' ? '🟡' : '🟢'}
        </span>
        <span className="timer-value">{formatDuration(remainingMs)}</span>
        <span className="timer-label">remaining</span>
      </div>

      {urgencyClass === 'critical' && (
        <div className="timer-warning">
          ⚠️ Token expires soon! Refresh now to avoid interruption.
        </div>
      )}
    </div>
  );
}
```

**CSS** (`dashboard/frontend/src/components/auth/CountdownTimer.css`):

```css
.countdown-timer {
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid;
  transition: all 0.3s ease;
}

.countdown-timer.safe {
  border-color: var(--color-success);
  background-color: var(--color-success-light);
}

.countdown-timer.warning {
  border-color: var(--color-warning);
  background-color: var(--color-warning-light);
}

.countdown-timer.critical {
  border-color: var(--color-danger);
  background-color: var(--color-danger-light);
  animation: pulse-critical 1.5s ease-in-out infinite;
}

.countdown-timer.long-lived {
  border-color: var(--color-info);
  background-color: var(--color-info-light);
}

@keyframes pulse-critical {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
  }
}

.timer-display {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.timer-icon {
  font-size: 1.5rem;
}

.timer-value {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.timer-label {
  font-size: 0.875rem;
  font-weight: 400;
  opacity: 0.7;
}

.timer-warning {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background-color: rgba(220, 53, 69, 0.1);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}
```

---

### T035: ExpirationWarning Component

**File**: `dashboard/frontend/src/components/auth/ExpirationWarning.tsx`

```typescript
import { TokenExpiration } from '../../types/auth';
import { TOKEN_URGENT_NOTIFICATION_MS } from '../../constants/thresholds';

interface ExpirationWarningProps {
  tokenExpiration: TokenExpiration;
  onRefreshClick: () => void;
}

export function ExpirationWarning({ tokenExpiration, onRefreshClick }: ExpirationWarningProps) {
  // Only show for session tokens in critical state
  if (
    tokenExpiration.method !== 'session' ||
    tokenExpiration.urgencyLevel !== 'critical'
  ) {
    return null;
  }

  const isSuperUrgent = (tokenExpiration.remainingMs || 0) < TOKEN_URGENT_NOTIFICATION_MS;

  return (
    <div className={`expiration-warning ${isSuperUrgent ? 'super-urgent' : ''}`}>
      <div className="warning-icon">🚨</div>
      <div className="warning-content">
        <h4 className="warning-title">
          {isSuperUrgent ? 'Token Expiring Imminently!' : 'Token Expiring Soon'}
        </h4>
        <p className="warning-message">
          Your session token will expire in less than {Math.ceil((tokenExpiration.remainingMs || 0) / 60000)} minutes.
          {isSuperUrgent && ' This may cause task failures!'}
        </p>
        <div className="warning-actions">
          <button className="btn-refresh-now" onClick={onRefreshClick}>
            Refresh Now
          </button>
          <a href="https://docs.example.com/long-lived-tokens" className="btn-learn-more">
            Consider Long-Lived Token
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

### T036-T038: Modify TokenRefresh Component

**File**: `dashboard/frontend/src/components/auth/TokenRefresh.tsx`

**Import new components**:
```typescript
import { useTokenExpiration } from '../../hooks/useTokenExpiration';
import { CountdownTimer } from './CountdownTimer';
import { ExpirationWarning } from './ExpirationWarning';
```

**Add to component**:

```typescript
export function TokenRefresh() {
  const { tokenExpiration, isLoading } = useTokenExpiration();
  const [activeTab, setActiveTab] = useState<'status' | 'refresh'>('status');

  const handleRefreshNow = () => {
    setActiveTab('refresh');
    // Scroll to refresh section
    document.getElementById('token-refresh-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return <div>Loading token status...</div>;
  }

  return (
    <div className="token-refresh-panel">
      <div className="tabs">
        <button
          className={activeTab === 'status' ? 'active' : ''}
          onClick={() => setActiveTab('status')}
        >
          Token Status
        </button>
        <button
          className={activeTab === 'refresh' ? 'active' : ''}
          onClick={() => setActiveTab('refresh')}
        >
          Refresh Session
        </button>
      </div>

      {activeTab === 'status' && tokenExpiration && (
        <div className="token-status-tab">
          {/* Countdown Timer */}
          <section className="status-section">
            <h3>Token Expiration</h3>
            <CountdownTimer tokenExpiration={tokenExpiration} />
          </section>

          {/* Expiration Warning (only shows when critical) */}
          <ExpirationWarning
            tokenExpiration={tokenExpiration}
            onRefreshClick={handleRefreshNow}
          />

          {/* Token Info */}
          <section className="status-section">
            <h3>Authentication Details</h3>
            <dl className="token-details">
              <dt>Method:</dt>
              <dd>{tokenExpiration.method === 'session' ? 'Session Token' : 'Long-Lived Token'}</dd>

              {tokenExpiration.lastRefreshed && (
                <>
                  <dt>Last Refreshed:</dt>
                  <dd>{tokenExpiration.lastRefreshed.toLocaleString()}</dd>
                </>
              )}
            </dl>
          </section>

          {/* Toast notification at 5-minute threshold (T037) */}
          {tokenExpiration.urgencyLevel === 'critical' &&
           (tokenExpiration.remainingMs || 0) < TOKEN_URGENT_NOTIFICATION_MS && (
            <Toast
              type="warning"
              title="Token Expiring Soon"
              message="Consider switching to a long-lived token to avoid interruptions. Click 'Refresh Session' tab for instructions."
              duration={10000}
            />
          )}
        </div>
      )}

      {activeTab === 'refresh' && (
        <div className="token-refresh-tab" id="token-refresh-section">
          {/* Existing refresh UI */}
          <SessionRefreshForm />
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Completion Checklist

### Backend (Phase 2)
- [ ] T011: Complete blob storage extensions
- [ ] T012-T014: Task API endpoints (retry, diagnostics, escalate)
- [ ] T015: Auth status endpoint
- [ ] T016-T017: Components bulk operations endpoints
- [ ] T018: Storage search endpoint
- [ ] T019: Route registration
- [ ] T020-T021: Middleware (validation, error handling)

### Frontend US1 (Phase 3)
- [ ] T022-T023: Hooks (useStuckTasks, useTaskDiagnostics)
- [ ] T024: tasksApi service
- [ ] T025-T027: Components (StuckTaskActions, DiagnosticModal, TaskRetryButton)
- [ ] T028-T030: Integration (TaskCard, CSS, Toast)

### Frontend US2 (Phase 4)
- [ ] T031-T032: Hooks (useTokenExpiration, useCountdown)
- [ ] T033: authApi service
- [ ] T034-T035: Components (CountdownTimer, ExpirationWarning)
- [ ] T036-T038: TokenRefresh integration

---

## 🚀 Testing MVP

After implementation:

1. **Start backend**:
   ```bash
   cd dashboard/backend
   npm run dev
   ```

2. **Start frontend**:
   ```bash
   cd dashboard/frontend
   npm run dev
   ```

3. **Test User Story 1**:
   - Create a stuck task (>30 min in phase)
   - Verify warning indicator appears
   - Click "Retry Task" - verify n8n workflow restarts
   - Click "Why Stuck?" - verify diagnostics modal displays
   - Click "Escalate" - verify Teams notification sent

4. **Test User Story 2**:
   - Navigate to Token Refresh panel
   - Verify countdown timer displays with correct color
   - Wait for token to approach expiration
   - Verify warning appears at <10 minutes
   - Verify toast notification at <5 minutes

---

## 📝 Notes

**Dependencies to install**:
```bash
# Backend
cd dashboard/backend
npm install js-yaml @types/js-yaml

# Frontend (likely already installed)
cd dashboard/frontend
npm install @tanstack/react-query
```

**Environment variables needed**:
```bash
# Backend .env
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
N8N_API_URL=https://n8n.ii-us.com
N8N_API_KEY=your-api-key

# Frontend .env
VITE_API_URL=http://localhost:3001
```

**Color variables** (add to CSS):
```css
:root {
  --color-success: #28a745;
  --color-success-light: #d4edda;
  --color-warning: #ffc107;
  --color-warning-light: #fff3cd;
  --color-danger: #dc3545;
  --color-danger-light: #f8d7da;
  --color-info: #17a2b8;
  --color-info-light: #d1ecf1;
}
```

---

This implementation guide provides complete code for all 31 remaining MVP tasks. Follow it sequentially to deliver User Stories 1 and 2!
