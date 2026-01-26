# Backend Codemap

**Freshness:** 2026-01-26T00:00:00Z

## Module Structure

```
dashboard/backend/src/
├── index.ts              # Server bootstrap
├── config.ts             # Environment config
├── api/
│   ├── routes/
│   │   ├── index.ts      # Router factory
│   │   ├── health.ts     # GET /api/health
│   │   ├── auth.ts       # GET /api/auth/status
│   │   ├── credentials.ts# Token refresh endpoints
│   │   ├── claude.ts     # POST /api/execute
│   │   └── k8s.ts        # CronJob management
│   └── middleware/
│       ├── auth.ts       # JWT validation
│       └── error.ts      # Global error handler
├── services/
│   ├── claude-agent.ts   # Claude execution wrapper
│   ├── kubernetes.ts     # K8s client wrapper
│   ├── token-refresh.ts  # Token refresh orchestration
│   ├── credentials-watcher.ts
│   └── execution-store.ts# In-memory store
└── types/
    ├── execution.ts      # ExecutionRecord, ExecutionStatus
    ├── cronjob.ts        # PodHealth, CronJobInfo, JobInfo
    ├── health.ts
    └── token-refresh.ts
```

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Pod status, system health |
| GET | `/api/auth/status` | Yes | Claude auth status |
| POST | `/api/execute` | Yes | Run Claude prompt |
| GET | `/api/executions` | Yes | Execution history |
| GET | `/api/cronjobs` | Yes | List CronJobs |
| POST | `/api/cronjobs/:name/trigger` | Yes | Trigger CronJob |
| POST | `/api/credentials/refresh` | Yes | Start token refresh |
| GET | `/api/credentials/refresh/status` | Yes | Refresh progress |

## Service Dependencies

```
ClaudeAgentService
  └── fetch() → http://claude-agent.claude-agent.svc.cluster.local

KubernetesService
  └── @kubernetes/client-node → K8s API

TokenRefreshService
  ├── KubernetesService (secret operations)
  └── ClaudeAgentService (auth validation)
```

## Configuration (config.ts)

```typescript
{
  port: number                    // Default: 3000
  azureAd: {
    tenantId: string             // Required
    clientId: string             // Required
    authorizedGroupId?: string   // Optional group restriction
  }
  claudeAgent: {
    namespace: string            // Default: 'claude-agent'
    serviceUrl: string           // Service URL
  }
  healthPollIntervalMs: number   // Default: 30000
}
```

## Exit Code Mapping

| Code | Status | Meaning |
|------|--------|---------|
| 0 | `success` | Normal completion |
| 1 | `error` | General failure |
| 57 | `auth_failure` | Session expired |
| 124 | `timeout` | 10 min timeout |

## Middleware Chain

```
Request → CORS → JSON Parser → Auth Middleware → Route Handler → Error Handler
```
