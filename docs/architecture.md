# Architecture Overview

Detailed system design for the n8n-claude-code-agent.

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Cloud                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Azure Kubernetes Service (AKS)                    │  │
│  │                                                                       │  │
│  │   ┌─────────────┐          ┌─────────────────────────────────────┐  │  │
│  │   │  n8n-prod   │   HTTP   │         claude-agent                 │  │  │
│  │   │  namespace  │ ────────>│         namespace                    │  │  │
│  │   │             │          │                                      │  │  │
│  │   │  ┌───────┐  │          │  ┌─────────────────────────────────┐│  │  │
│  │   │  │ n8n   │  │          │  │      claude-code-agent          ││  │  │
│  │   │  │ pod   │  │          │  │         (Deployment)            ││  │  │
│  │   │  └───────┘  │          │  │                                 ││  │  │
│  │   └─────────────┘          │  │  ┌──────────┐  ┌─────────────┐  ││  │  │
│  │                            │  │  │ server.js│  │ Claude CLI  │  ││  │  │
│  │                            │  │  │ :3000    │──│             │  ││  │  │
│  │                            │  │  └──────────┘  └─────────────┘  ││  │  │
│  │                            │  └─────────────────────────────────┘│  │  │
│  │                            │                                      │  │  │
│  │                            │  ┌─────────────────────────────────┐│  │  │
│  │                            │  │   claude-auth-watchdog          ││  │  │
│  │                            │  │      (CronJob, */30 *)          ││  │  │
│  │                            │  └─────────────────────────────────┘│  │  │
│  │                            └─────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────────┐ │
│  │ Azure       │            │ Azure Key   │            │ Azure Storage   │ │
│  │ Container   │            │ Vault       │            │ Account         │ │
│  │ Registry    │            │ (iius-akv)  │            │ (iiusagentstore)│ │
│  └─────────────┘            └─────────────┘            └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │   Claude AI     │
                            │   (Anthropic)   │
                            └─────────────────┘
```

## Component Details

### HTTP Server (server.js)

The HTTP server provides a REST API for Claude prompt execution.

**Endpoints:**
- `GET /health` - Health check (liveness/readiness)
- `POST /run` - Execute Claude prompt

**Key Features:**
- Graceful shutdown (SIGTERM handling)
- Active request tracking
- Request validation
- Configurable timeouts

**Flow:**
```
HTTP Request → Parse JSON → Validate → spawnSync(claude) → Format Response
```

### Authentication Watchdog (CronJob)

Periodic health check for Claude session tokens.

**Schedule:** Every 30 minutes (`*/30 * * * *`)

**Flow:**
```
CronJob triggers → check-auth.sh runs → Claude auth test
                                              │
                    ┌─────────────────────────┴───────────────────────┐
                    │                                                 │
              Exit 0 (Success)                               Exit non-zero (Failure)
                    │                                                 │
              Silent exit                                     notify.sh → Teams
```

### Container Image

**Base:** Ubuntu 24.04 LTS

**Installed Tools:**
| Tool | Version | Purpose |
|------|---------|---------|
| Azure CLI | 2.82.0 | Azure authentication |
| GitHub CLI | 2.85.0 | Repository operations |
| Claude CLI | 2.1.7 | AI prompt execution |
| Node.js | 20.x | HTTP server runtime |
| jq | 1.7 | JSON processing |
| yq | 4.50.1 | YAML processing |

**User:** `claude-agent` (UID 1001, GID 1001)

### Kubernetes Resources

```
claude-agent namespace
├── ServiceAccount (claude-agent-sa)
│   └── Workload Identity annotation
├── Deployment (claude-code-agent)
│   ├── Init Container (copy-claude-session)
│   ├── Main Container (claude-code-agent)
│   ├── Volumes
│   │   ├── claude-home (emptyDir)
│   │   ├── workspace (emptyDir)
│   │   ├── tmp (emptyDir)
│   │   ├── github-secrets (CSI)
│   │   └── claude-session-secret (Secret)
│   └── Probes (liveness, readiness)
├── Service (claude-agent)
│   └── ClusterIP :80 → :3000
├── CronJob (claude-auth-watchdog)
├── Secrets
│   ├── claude-session
│   └── teams-webhook
├── SecretProviderClass (github-app-akv)
└── NetworkPolicies
    ├── default-deny-all
    ├── allow-dns
    ├── allow-azure-egress
    └── allow-ingress-from-n8n
```

## Security Architecture

### Network Security

```
                                    ┌─────────────────────────────┐
                                    │     claude-agent namespace   │
                                    │                              │
    ┌───────────────┐              │  ┌─────────────────────────┐ │
    │  n8n-prod     │   TCP 3000   │  │  default-deny-all       │ │
    │  namespace    │ ────────────>│  │  (blocks everything)    │ │
    └───────────────┘              │  └─────────────────────────┘ │
                                    │              │               │
                                    │              ▼               │
                                    │  ┌─────────────────────────┐ │
                                    │  │  allow-ingress-from-n8n │ │
                                    │  │  (permits n8n traffic)  │ │
                                    │  └─────────────────────────┘ │
                                    │                              │
    ┌───────────────┐              │  ┌─────────────────────────┐ │
    │  kube-system  │   UDP 53     │  │  allow-dns              │ │
    │  (kube-dns)   │ <────────────│  │  (permits DNS egress)   │ │
    └───────────────┘              │  └─────────────────────────┘ │
                                    │                              │
    ┌───────────────┐              │  ┌─────────────────────────┐ │
    │  Azure        │   TCP 443    │  │  allow-azure-egress     │ │
    │  Services     │ <────────────│  │  (permits HTTPS egress) │ │
    └───────────────┘              │  └─────────────────────────┘ │
                                    │                              │
                                    └─────────────────────────────┘
```

### Identity and Access

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Workload Identity Flow                              │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │ K8s Service  │    │ Federated    │    │ Azure AD     │    │ Azure    │ │
│  │ Account      │───>│ Credential   │───>│ Token        │───>│ Resource │ │
│  │              │    │              │    │              │    │          │ │
│  │ claude-      │    │ claude-      │    │ Access Token │    │ Storage/ │ │
│  │ agent-sa     │    │ agent-       │    │              │    │ KeyVault │ │
│  │              │    │ fed-cred     │    │              │    │          │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘ │
│         │                                                                   │
│         │ Annotation: azure.workload.identity/client-id                    │
│         │                                                                   │
│  ┌──────┴───────────────────────────────────────────────────────────────┐ │
│  │ Environment Variables (injected by Azure Workload Identity webhook): │ │
│  │   - AZURE_CLIENT_ID                                                   │ │
│  │   - AZURE_TENANT_ID                                                   │ │
│  │   - AZURE_FEDERATED_TOKEN_FILE                                        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Container Security

| Security Control | Implementation |
|------------------|----------------|
| Non-root user | `runAsUser: 1001` |
| Read-only root | `readOnlyRootFilesystem: true` |
| No privilege escalation | `allowPrivilegeEscalation: false` |
| Dropped capabilities | `capabilities: drop: ["ALL"]` |
| Seccomp profile | `seccompProfile: RuntimeDefault` |
| Resource limits | CPU: 4, Memory: 8Gi |

## Data Flow

### Prompt Execution Flow

```
1. n8n Workflow
   │
   ├── HTTP POST to http://claude-agent.claude-agent.svc.cluster.local/run
   │   Body: { "prompt": "...", "timeout": 300000 }
   │
   ▼
2. Kubernetes Service (claude-agent)
   │
   ├── Routes to pod on port 3000
   │
   ▼
3. HTTP Server (server.js)
   │
   ├── Parse and validate request
   ├── Increment activeRequests
   ├── Execute: spawnSync('claude', ['-p', prompt])
   ├── Wait for completion
   ├── Decrement activeRequests
   │
   ▼
4. Claude CLI
   │
   ├── Authenticates using ~/.claude/ tokens
   ├── Sends prompt to Anthropic API
   ├── Returns response
   │
   ▼
5. Response to n8n
   │
   └── { "success": true, "output": "...", "exitCode": 0 }
```

### Auth Monitoring Flow

```
1. CronJob triggers (*/30 * * * *)
   │
   ▼
2. Pod created with same config as main deployment
   │
   ├── Init container copies Claude tokens
   │
   ▼
3. check-auth.sh executes
   │
   ├── Run: claude -p "auth test" (30s timeout)
   │
   ├─────────────────────────────────┐
   │                                 │
   Success (exit 0)            Failure (any other)
   │                                 │
   Exit silently              notify.sh → Teams webhook
                                     │
                                Exit 57
```

## Storage Architecture

### Blob Containers

| Container | Purpose | Access Pattern |
|-----------|---------|----------------|
| agent-state | Task lease management | Read/Write |
| agent-spec | Feature specifications | Read/Write |
| agent-plan | Implementation plans | Read/Write |
| agent-verification | Test results | Write |
| agent-review | Code reviews | Write |
| agent-release | Release artifacts | Write |

### Volume Mounts

| Volume | Type | Mount Path | Purpose |
|--------|------|------------|---------|
| claude-home | emptyDir | /home/claude-agent | Claude CLI writes |
| workspace | emptyDir | /workspace | Working directory |
| tmp | emptyDir | /tmp | Temporary files |
| github-secrets | CSI | /secrets/github | GitHub credentials |
| claude-session | Secret | /claude-creds | Session tokens (init) |

## Deployment Strategy

### Recreate Strategy

The deployment uses `strategy: Recreate` because:
- Single replica design
- Claude CLI maintains state
- No load balancing needed
- Simplifies session token handling

### Graceful Shutdown

```
SIGTERM received
    │
    ├── Set isShuttingDown = true
    ├── /health returns 503
    ├── /run rejects new requests
    │
    ▼
Wait for activeRequests == 0
    │
    ├── Max wait: 110 seconds (preStop) + 120 seconds (terminationGracePeriod)
    │
    ▼
Exit 0
```

## Monitoring and Alerting

### Health Probes

| Probe | Path | Interval | Failure Threshold |
|-------|------|----------|-------------------|
| Liveness | /health | 30s | 3 |
| Readiness | /health | 10s | 3 |

### Alerting

| Event | Detection | Notification |
|-------|-----------|--------------|
| Auth failure | CronJob watchdog | Teams Adaptive Card |
| Pod crash | Kubernetes | (not configured) |
| High latency | (not configured) | (not configured) |

## Future Considerations

### Potential Enhancements

1. **Multi-replica support**: Would require shared session management
2. **Prometheus metrics**: Add `/metrics` endpoint
3. **Distributed tracing**: Add request IDs and OpenTelemetry
4. **Log aggregation**: Ship logs to Azure Log Analytics
5. **Auto-scaling**: HPA based on queue depth (n8n side)

### Known Limitations

1. **Single replica**: No horizontal scaling
2. **Token refresh**: Manual process required
3. **No request queuing**: n8n must handle retries
4. **Claude rate limits**: Subject to Anthropic limits
