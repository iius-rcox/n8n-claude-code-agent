# Research Notes: Dashboard Observability Enhancements

**Feature**: 010-dashboard-observability
**Date**: 2026-01-18
**Phase**: 0 (Research)

## Executive Summary

This research investigates the integration points and existing patterns needed to implement four dashboard observability features: System Health Overview, Task Pipeline Visualization, n8n Execution Feed, and Blob Storage Browser.

## 1. System Health Overview (P1)

### Current Implementation

The dashboard already has a health panel (`dashboard/frontend/src/components/health-panel.tsx`) that displays:
- Pod status (Running/Pending/Failed)
- Container ready counts
- Restart information
- Claude authentication status
- CronJob status

**Existing API**: `GET /api/health` returns:
```typescript
interface HealthResponse {
  timestamp: string;
  overall: 'healthy' | 'unhealthy' | 'degraded';
  components: HealthStatus[];
}

interface HealthStatus {
  component: 'pod' | 'service' | 'auth' | 'cronjob';
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'pending';
  lastChecked: string;
  details?: Record<string, unknown>;
}
```

### Required Extensions

To meet FR-001 through FR-007, we need to add:

1. **n8n reachability check** - New HTTP health check to n8n service
2. **Azure Blob Storage connectivity** - Test blob container access
3. **Claude auth expiration** - Already available via `expiryEstimate` field
4. **Auth watchdog status** - Already implemented (CronJob: claude-auth-watchdog)

### Integration Points

- `KubernetesService.getCronJob('claude-auth-watchdog')` - Existing, returns schedule and last success
- n8n health: `GET http://n8n.n8n.svc.cluster.local:5678/healthz`
- Azure Blob: `BlobServiceClient.getContainerClient().exists()`

## 2. Task Pipeline Visualization (P2)

### Task Envelope Structure

Tasks are stored in Azure Blob Storage at: `agent-state/{task_id}/task-envelope.yml`

**Task Envelope Schema** (from planning docs):
```yaml
ticket_id: FEAT-XXX
title: "Feature title"
status: pending | in_progress | paused | stuck | completed | failed | cancelled
current_phase: intake | planning | implementation | verification | review | release
priority: low | normal | high | critical
created_at: ISO8601
updated_at: ISO8601

phases:
  intake:
    status: pending | in_progress | completed | failed
    started_at: ISO8601
    completed_at: ISO8601
    duration_ms: number
    agent: pm
  planning:
    # ... same structure
  implementation:
    # ...
  verification:
    # ...
  review:
    # ...
  release:
    # ...

retry_counts:
  verification_attempts: number
  implementation_attempts: number

history:
  - timestamp: ISO8601
    event: task_created | phase_started | phase_completed | phase_failed | ...
    phase: string
    actor: string
```

### Data Access Pattern

1. List all blobs in `agent-state/` container
2. For each `{task_id}/task-envelope.yml`, parse YAML
3. Group by `current_phase` for Kanban columns
4. Calculate time-in-phase from `phases.{phase}.started_at`

### Pipeline Phases (6 columns)

1. **Intake** - PM Agent creates specification
2. **Planning** - PM Agent creates implementation plan
3. **Implementation** - Dev Agent writes code
4. **Verification** - QA Agent tests changes
5. **Review** - Reviewer Agent reviews PR
6. **Release** - Dev Agent merges PR

### Related Artifacts

Each phase produces artifacts in separate containers:
- `agent-spec/{task_id}/spec.md` - Specification
- `agent-plan/{task_id}/plan.md` - Implementation plan
- `agent-verification/{task_id}/verification-report.md` - Test results
- `agent-review/{task_id}/review-feedback.md` - Code review

## 3. n8n Execution Feed (P3)

### n8n REST API

**Base URL**: `http://n8n.n8n.svc.cluster.local:5678/api/v1`

**Authentication**: API Key via `X-N8N-API-KEY` header (stored in K8s secret)

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/executions` | GET | List all executions |
| `/executions/{id}` | GET | Get specific execution |
| `/workflows/{id}/executions` | GET | Executions for workflow |

### Query Parameters

- `limit` - Max results (default varies)
- `lastId` - Cursor for pagination
- `workflowId` - Filter by workflow
- `status` - Filter: success, error, canceled, waiting

### Execution Response Fields

```typescript
interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName?: string;      // May need includeData
  status: 'success' | 'error' | 'canceled' | 'waiting';
  startedAt: string;          // ISO 8601
  stoppedAt: string;          // ISO 8601
  createdAt: string;
  mode: 'manual' | 'trigger' | 'webhook';
  data?: object;              // Full execution data (optional)
}
```

### Workflow-to-Task Mapping

Workflows include the task ID in their input data. To correlate:
1. Parse execution data for `task_id` or `ticket_id` field
2. Or match workflow name pattern (e.g., "PM Intake", "Dev Implementation")

### Known Limitations

- No "running" status filter available (API limitation)
- Waiting status may not be returned in some versions
- Large execution data requires separate fetch with `includeData`

## 4. Blob Storage Browser (P4)

### Azure Blob Storage Configuration

**Storage Account**: `iiusagentstore`
**Authentication**: Workload Identity (already configured for dashboard pod)

### Containers

| Container | Purpose | Content Types |
|-----------|---------|---------------|
| `agent-state` | Task envelopes | YAML |
| `agent-spec` | Specifications | Markdown |
| `agent-plan` | Implementation plans | Markdown |
| `agent-verification` | Test results | Markdown, JSON |
| `agent-review` | Code reviews | Markdown |
| `agent-release` | Release artifacts | Various |

### SDK Operations

Using `@azure/storage-blob`:

```typescript
// List containers
const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
const containers = blobServiceClient.listContainers();

// List blobs in container
const containerClient = blobServiceClient.getContainerClient(name);
const blobs = containerClient.listBlobsFlat();

// Get blob content
const blobClient = containerClient.getBlobClient(blobName);
const downloadResponse = await blobClient.download();

// Get blob properties (size, contentType, lease status)
const properties = await blobClient.getProperties();

// Delete blob
await blobClient.delete();

// Break lease
const leaseClient = blobClient.getBlobLeaseClient();
await leaseClient.breakLease(0);
```

### Blob Metadata

Available for display:
- `contentLength` - File size
- `contentType` - MIME type
- `lastModified` - Timestamp
- `leaseState` - available, leased, expired, breaking, broken
- `leaseStatus` - locked, unlocked

### Syntax Highlighting

For preview, support:
- `.md` - Markdown rendering
- `.yaml`, `.yml` - YAML syntax highlighting
- `.json` - JSON syntax highlighting with formatting
- `.txt` - Plain text

## 5. Existing Dashboard Patterns

### Backend Service Pattern

```typescript
// dashboard/backend/src/services/kubernetes.ts
export class KubernetesService {
  constructor(config: Config) {
    // Initialize API clients
  }

  async someOperation(): Promise<SomeType> {
    // Implementation
  }
}
```

### API Route Pattern

```typescript
// dashboard/backend/src/api/routes/health.ts
export function createHealthRouter(
  k8sService: KubernetesService,
  claudeService: ClaudeAgentService
): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      // Handler logic
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

### Frontend Hook Pattern

```typescript
// dashboard/frontend/src/hooks/use-health.ts
export function useHealth() {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Fetch logic with error handling
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
```

### Frontend API Service Pattern

```typescript
// dashboard/frontend/src/services/api.ts
export async function getSomething(): Promise<SomeType> {
  const response = await fetchWithAuth('/api/something');
  return response.json();
}
```

### UI Component Pattern

- Card-based layout with `Card`, `CardHeader`, `CardContent`
- Collapsible panels with expand/collapse state
- Badge components for status indicators (green/yellow/red)
- Auto-refresh with polling intervals
- Loading skeletons during fetch
- Error display with AlertCircle icon

## 6. Configuration Requirements

### New Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `N8N_API_URL` | n8n REST API base URL | `http://n8n.n8n.svc.cluster.local:5678` |
| `N8N_API_KEY` | n8n API authentication | (from K8s secret) |
| `AZURE_STORAGE_ACCOUNT` | Blob storage account | `iiusagentstore` |

### Dependencies to Add

**Backend**:
- `@azure/storage-blob` - Azure Blob SDK (may already be installed via workload identity)
- `yaml` - YAML parsing for task envelopes

**Frontend**:
- `react-markdown` - Markdown rendering (optional, for rich preview)
- `prism-react-renderer` - Syntax highlighting (optional)

## 7. Performance Considerations

### Polling Intervals

| Feature | Interval | Rationale |
|---------|----------|-----------|
| Health Overview | 30s | Match existing pattern |
| Pipeline Updates | 30s | Per FR-011 requirement |
| n8n Executions | 10s | Per FR-017 requirement |
| Storage Browser | On-demand | User-triggered navigation |

### Pagination Strategy

For n8n executions and blob listings with many items:
- Use cursor-based pagination
- Default page size: 25 items
- Load more on scroll or button

### Caching

- Health status: Cache for 5s to prevent duplicate calls
- Container list: Cache for 60s (rarely changes)
- Execution list: No cache (real-time requirement)

## 8. Security Considerations

### Authorization

All new APIs must:
1. Require Azure AD authentication (existing middleware)
2. Verify user is in authorized group
3. Use workload identity for Azure Blob access (no credentials in config)

### Sensitive Data

- Blob content may contain secrets - do not log full content
- n8n API key must be stored in K8s secret, not exposed to frontend
- Execution data may contain sensitive input/output - consider redaction

## 9. Open Questions

1. **n8n API Key**: Where is this currently stored? Need to add to dashboard backend config.
2. **Task ID Format**: Current format is `FEAT-{timestamp}-{random}`. Confirm this is stable.
3. **Stuck Task Threshold**: Spec says 30 minutes (FR-010). Is this configurable?
4. **Delete Confirmation**: Should blob delete require double confirmation for artifacts?

## 10. Recommendations

1. **Start with P1 (System Health)** - Lowest risk, extends existing patterns
2. **Add n8n service first** - Required for both P3 and understanding workflow context
3. **Implement Pipeline and Executions together** - Both need blob storage service
4. **Storage Browser last** - Most complex, requires careful UX for file operations
