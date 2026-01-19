# Quickstart Guide: Dashboard Observability Enhancements

**Feature**: 010-dashboard-observability
**Date**: 2026-01-18

## Prerequisites

- Node.js 20+ installed
- Access to the AKS cluster (`dev-aks`)
- Azure AD credentials for dashboard authentication
- n8n API key (contact ops team)

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd dashboard/backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create `dashboard/backend/.env`:

```env
# Existing config
PORT=3001
AZURE_AD_TENANT_ID=<your-tenant-id>
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_AUTHORIZED_GROUP_ID=<optional>

CLAUDE_AGENT_NAMESPACE=claude-agent
CLAUDE_AGENT_SERVICE_URL=http://localhost:8080

# New for this feature
N8N_API_URL=http://localhost:5678
N8N_API_KEY=<get-from-n8n-settings>
AZURE_STORAGE_ACCOUNT=iiusagentstore
AZURE_STORAGE_CONNECTION_STRING=<for-local-dev-only>
```

Create `dashboard/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_AZURE_AD_CLIENT_ID=<your-client-id>
VITE_AZURE_AD_TENANT_ID=<your-tenant-id>
```

### 3. Port Forward to AKS (for testing against real services)

```bash
# Terminal 1: Claude Agent
kubectl port-forward -n claude-agent svc/claude-agent 8080:80

# Terminal 2: n8n (if running in cluster)
kubectl port-forward -n n8n svc/n8n 5678:5678
```

### 4. Run Development Servers

```bash
# Terminal 3: Backend
cd dashboard/backend
npm run dev

# Terminal 4: Frontend
cd dashboard/frontend
npm run dev
```

Access the dashboard at `http://localhost:5173`

---

## Implementation Order

Follow this order to build incrementally with testable milestones:

### Phase 1: System Health Overview (P1)

**Backend Tasks:**
1. Add n8n health check to `services/kubernetes.ts` or new `services/n8n-client.ts`
2. Add Azure Blob connectivity check to new `services/blob-storage.ts`
3. Extend `api/routes/health.ts` to include new components

**Frontend Tasks:**
1. Extend `components/health-panel.tsx` to show new components
2. Add component-specific detail views

**Test:**
```bash
# Backend health endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/health
```

### Phase 2: Blob Storage Service (Foundation for P2 & P4)

**Backend Tasks:**
1. Create `services/blob-storage.ts` with Azure SDK integration
2. Create `types/storage.ts` with type definitions
3. Create `api/routes/storage.ts` with container/blob endpoints

**Test:**
```bash
# List containers
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/storage/containers

# List blobs
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/storage/containers/agent-state/blobs
```

### Phase 3: Task Pipeline (P2)

**Backend Tasks:**
1. Create `services/pipeline-state.ts` to parse task envelopes
2. Create `types/pipeline.ts` with task/phase types
3. Create `api/routes/pipeline.ts` with pipeline endpoints

**Frontend Tasks:**
1. Create `hooks/use-pipeline.ts` for data fetching
2. Create `components/pipeline-board.tsx` with Kanban columns
3. Add task card components with click-to-expand

**Test:**
```bash
# Get pipeline state
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/pipeline
```

### Phase 4: n8n Execution Feed (P3)

**Backend Tasks:**
1. Create `services/n8n-client.ts` with REST API client
2. Create `types/n8n.ts` with execution types
3. Create `api/routes/n8n.ts` with execution endpoints

**Frontend Tasks:**
1. Create `hooks/use-executions.ts` for polling
2. Create `components/execution-feed.tsx` with list/detail views
3. Add filtering controls

**Test:**
```bash
# List executions
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/executions?limit=10
```

### Phase 5: Storage Browser UI (P4)

**Frontend Tasks:**
1. Create `hooks/use-storage.ts` for navigation state
2. Create `components/storage-browser.tsx` with tree navigation
3. Add file preview with syntax highlighting
4. Add download and delete actions

---

## Code Patterns to Follow

### Backend Service Pattern

```typescript
// services/n8n-client.ts
import { Config } from '../config.js';

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.n8n.apiUrl;
    this.apiKey = config.n8n.apiKey;
  }

  async getExecutions(filters: ExecutionFilters): Promise<N8nExecution[]> {
    const url = new URL(`${this.baseUrl}/api/v1/executions`);
    if (filters.limit) url.searchParams.set('limit', String(filters.limit));
    if (filters.status) url.searchParams.set('status', filters.status);

    const response = await fetch(url.toString(), {
      headers: { 'X-N8N-API-KEY': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status}`);
    }

    return response.json();
  }
}
```

### Backend Route Pattern

```typescript
// api/routes/n8n.ts
import { Router, Request, Response, NextFunction } from 'express';
import { N8nClient } from '../../services/n8n-client.js';

export function createN8nRouter(n8nClient: N8nClient): Router {
  const router = Router();

  router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        limit: req.query.limit ? Number(req.query.limit) : 25,
        status: req.query.status as string | undefined,
      };

      const executions = await n8nClient.getExecutions(filters);
      res.json({ executions, total: executions.length, hasMore: false });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

### Frontend Hook Pattern

```typescript
// hooks/use-executions.ts
import { useState, useEffect, useCallback } from 'react';
import { getExecutions, N8nExecution, ExecutionFilters } from '@/services/api';

export function useExecutions(filters: ExecutionFilters) {
  const [executions, setExecutions] = useState<N8nExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getExecutions(filters);
      setExecutions(data.executions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000); // 10s polling per spec
    return () => clearInterval(interval);
  }, [refresh]);

  return { executions, isLoading, error, refresh };
}
```

### Frontend Component Pattern

```tsx
// components/execution-feed.tsx
import { useExecutions } from '@/hooks/use-executions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ExecutionFeed() {
  const { executions, isLoading, error, refresh } = useExecutions({ limit: 25 });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'destructive';
      case 'running': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>n8n Executions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div>Loading...</div>}
        {error && <div className="text-destructive">{error}</div>}
        {executions.map((exec) => (
          <div key={exec.id} className="flex justify-between py-2 border-b">
            <span>{exec.workflowName}</span>
            <Badge variant={getStatusVariant(exec.status)}>
              {exec.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Testing

### Unit Tests (Backend)

```bash
cd dashboard/backend
npm test
```

Example test:
```typescript
// tests/services/n8n-client.test.ts
describe('N8nClient', () => {
  it('should fetch executions with filters', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1', status: 'success' }]),
    });
    global.fetch = mockFetch;

    const client = new N8nClient({ n8n: { apiUrl: 'http://test', apiKey: 'key' } });
    const result = await client.getExecutions({ limit: 10 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.objectContaining({ headers: { 'X-N8N-API-KEY': 'key' } })
    );
    expect(result).toHaveLength(1);
  });
});
```

### Unit Tests (Frontend)

```bash
cd dashboard/frontend
npm test
```

### E2E Tests

```bash
cd dashboard/frontend
npm run test:e2e
```

---

## Deployment

### Build Docker Image

```bash
cd dashboard
docker build --platform linux/amd64 \
  --build-arg VITE_AZURE_AD_CLIENT_ID=$CLIENT_ID \
  --build-arg VITE_AZURE_AD_TENANT_ID=$TENANT_ID \
  -t iiusacr.azurecr.io/ops-dashboard:v2.0.0 .
```

### Deploy to AKS

```bash
docker push iiusacr.azurecr.io/ops-dashboard:v2.0.0
kubectl set image deployment/ops-dashboard \
  ops-dashboard=iiusacr.azurecr.io/ops-dashboard:v2.0.0 \
  -n ops-dashboard
```

### Verify Deployment

```bash
kubectl rollout status deployment/ops-dashboard -n ops-dashboard
kubectl logs -n ops-dashboard -l app=ops-dashboard --tail=50
```

---

## Troubleshooting

### n8n Connection Issues

```bash
# Check n8n is reachable
kubectl exec -n ops-dashboard deploy/ops-dashboard -- \
  curl -s http://n8n.n8n.svc.cluster.local:5678/healthz

# Verify API key is set
kubectl exec -n ops-dashboard deploy/ops-dashboard -- \
  printenv N8N_API_KEY | head -c 10
```

### Azure Blob Access Issues

```bash
# Test workload identity
kubectl exec -n ops-dashboard deploy/ops-dashboard -- \
  az storage container list --account-name iiusagentstore --auth-mode login -o table
```

### Dashboard Not Loading

1. Check backend logs: `kubectl logs -n ops-dashboard -l app=ops-dashboard`
2. Check frontend console in browser DevTools
3. Verify Azure AD configuration matches environment

---

## Files Created/Modified

### New Files

```
dashboard/backend/src/
├── services/
│   ├── blob-storage.ts      # Azure Blob SDK wrapper
│   ├── n8n-client.ts        # n8n REST API client
│   └── pipeline-state.ts    # Task envelope parser
├── api/routes/
│   ├── storage.ts           # Storage browser endpoints
│   ├── pipeline.ts          # Pipeline endpoints
│   └── n8n.ts               # Execution endpoints
└── types/
    ├── storage.ts           # Storage types
    ├── pipeline.ts          # Pipeline types
    └── n8n.ts               # n8n types

dashboard/frontend/src/
├── components/
│   ├── pipeline-board.tsx   # Kanban board
│   ├── execution-feed.tsx   # Execution list
│   └── storage-browser.tsx  # File browser
└── hooks/
    ├── use-pipeline.ts      # Pipeline data hook
    ├── use-executions.ts    # Executions hook
    └── use-storage.ts       # Storage navigation hook
```

### Modified Files

```
dashboard/backend/src/
├── config.ts                # Add n8n config
├── api/routes/index.ts      # Mount new routers
└── api/routes/health.ts     # Extend health checks

dashboard/frontend/src/
├── services/api.ts          # Add new API functions
└── pages/dashboard.tsx      # Add new panels
```
