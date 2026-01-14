# Research: Kubernetes Deployment

**Feature**: 005-kubernetes-deployment
**Date**: 2026-01-14
**Status**: Complete

## Research Tasks

### R1: Azure Workload Identity Configuration

**Question**: How to properly configure Azure Workload Identity for AKS pods?

**Decision**: Use service account annotations with federated credential binding.

**Rationale**:
- Microsoft recommends Workload Identity as the replacement for pod-managed identity
- Federated credentials enable OIDC token exchange without storing secrets
- Service account annotation `azure.workload.identity/client-id` binds to managed identity
- Pod label `azure.workload.identity/use: "true"` enables token injection

**Implementation**:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: claude-agent-sa
  namespace: claude-agent
  annotations:
    azure.workload.identity/client-id: "866b8e62-d9ce-42d1-a6b0-4382baf39f7a"
  labels:
    azure.workload.identity/use: "true"
```

**Alternatives Considered**:
- Pod-managed identity: Deprecated, requires NMI daemonset
- Service principal secrets: Violates Constitution II (no static credentials)

---

### R2: NetworkPolicy Default-Deny Strategy

**Question**: What is the best pattern for implementing default-deny with selective allow?

**Decision**: Single default-deny policy + separate allow policies per traffic type.

**Rationale**:
- Separation of concerns: each policy has single responsibility
- Easier debugging: can disable individual policies to troubleshoot
- Clear documentation: policy name indicates purpose
- Azure Policy compliance: explicit deny before allow

**Implementation**:
1. `networkpolicy-default-deny.yaml` - Blocks all ingress/egress
2. `networkpolicy-allow-dns.yaml` - Permits CoreDNS access (UDP/TCP 53)
3. `networkpolicy-allow-azure.yaml` - Permits HTTPS to Azure services (TCP 443)
4. `networkpolicy-allow-n8n.yaml` - Permits ingress from n8n namespace (TCP 3000)

**Alternatives Considered**:
- Single combined policy: Harder to maintain and debug
- No default-deny: Violates Constitution II (Zero Trust Networking)

---

### R3: Secret Mounting Strategy

**Question**: How to handle different secret types (Key Vault vs Kubernetes native)?

**Decision**: Hybrid approach - CSI Driver for GitHub App, K8s secrets for Claude session.

**Rationale**:
- **GitHub App credentials**: Long-lived, stored in Key Vault → CSI Driver
- **Claude session tokens**: Need to be copied/modified at runtime → K8s secret + init container
- **Teams webhook URL**: Simple string, infrequently accessed → K8s secret as env var

**Implementation**:
```yaml
# CSI Driver for GitHub (read-only mount)
volumes:
- name: github-secrets
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: github-app-akv

# K8s secret for Claude (copied by init container)
volumes:
- name: claude-session
  secret:
    secretName: claude-session

# K8s secret for Teams (env var)
env:
- name: TEAMS_WEBHOOK_URL
  valueFrom:
    secretKeyRef:
      name: teams-webhook
      key: url
```

**Alternatives Considered**:
- All secrets via CSI: Claude tokens need write access at runtime (CSI mounts are read-only)
- All secrets via K8s: Loses Key Vault auto-rotation benefits for GitHub credentials

---

### R4: Init Container Pattern for Claude Session

**Question**: How to handle Claude session tokens that need a writable home directory?

**Decision**: Init container copies from secret mount to emptyDir.

**Rationale**:
- Claude CLI expects `~/.claude/` to be writable for token refresh
- K8s secret mounts are read-only by design
- emptyDir provides pod-scoped writable storage
- Init container completes before main container starts

**Implementation**:
```yaml
initContainers:
- name: copy-claude-session
  image: busybox:1.36
  command: ['sh', '-c', 'cp -r /claude-session-ro/. /home/claude-agent/.claude/']
  volumeMounts:
  - name: claude-session
    mountPath: /claude-session-ro
    readOnly: true
  - name: claude-home
    mountPath: /home/claude-agent/.claude

volumes:
- name: claude-home
  emptyDir: {}
```

**Alternatives Considered**:
- PersistentVolume: Overkill for ephemeral session tokens
- hostPath: Violates portability and security
- Direct secret mount: Read-only, Claude CLI fails

---

### R5: Read-Only Root Filesystem with Writable Paths

**Question**: Which paths need to be writable when using readOnlyRootFilesystem?

**Decision**: Four emptyDir mounts for required writable paths.

**Rationale**:
- Claude CLI needs `~/.claude/` for session management
- Node.js needs `/tmp` for temporary files
- Git operations need workspace directory
- Azure CLI needs `~/.azure/` for token cache

**Implementation**:
```yaml
securityContext:
  readOnlyRootFilesystem: true

volumeMounts:
- name: claude-home
  mountPath: /home/claude-agent/.claude
- name: azure-home
  mountPath: /home/claude-agent/.azure
- name: tmp
  mountPath: /tmp
- name: workspace
  mountPath: /workspace

volumes:
- name: claude-home
  emptyDir: {}
- name: azure-home
  emptyDir: {}
- name: tmp
  emptyDir: {}
- name: workspace
  emptyDir: {}
```

**Alternatives Considered**:
- No readOnlyRootFilesystem: Violates Constitution II (Container Security)
- Fewer writable paths: Claude/Azure CLI operations would fail

---

### R6: Graceful Shutdown Configuration

**Question**: What is the optimal configuration for graceful shutdown with long-running prompts?

**Decision**: 120s terminationGracePeriodSeconds + 10s preStop sleep.

**Rationale**:
- Claude prompts can take several minutes to complete
- Default 30s is insufficient for long operations
- preStop hook ensures load balancer drains connections before SIGTERM
- Server already implements graceful shutdown (Sprint 4)

**Implementation**:
```yaml
terminationGracePeriodSeconds: 120
containers:
- name: claude-agent
  lifecycle:
    preStop:
      exec:
        command: ["/bin/sh", "-c", "sleep 10"]
```

**Alternatives Considered**:
- Longer grace period (300s): Slows down rollouts unnecessarily
- No preStop: Connections may be dropped during rollout
- Shorter grace period: Risk of killing in-flight requests

---

### R7: Resource Requests and Limits

**Question**: What are appropriate resource allocations for the Claude agent?

**Decision**: Conservative requests, no hard limits for CPU (burstable).

**Rationale**:
- Claude CLI execution is CPU-intensive but sporadic
- Memory should be limited to prevent OOM issues
- Burstable QoS class allows CPU bursting during prompts
- Init containers need minimal resources

**Implementation**:
```yaml
# Main container
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    memory: "1Gi"
    # No CPU limit - allow bursting

# Init container
resources:
  requests:
    cpu: "10m"
    memory: "16Mi"
  limits:
    cpu: "100m"
    memory: "64Mi"
```

**Alternatives Considered**:
- Hard CPU limits: Would throttle Claude during execution
- Guaranteed QoS: Wastes resources when idle
- No limits: Risk of memory exhaustion

---

### R8: Liveness and Readiness Probes

**Question**: How to configure health probes for the HTTP server?

**Decision**: HTTP probes against `/health` endpoint with appropriate timing.

**Rationale**:
- Server exposes `/health` endpoint (Sprint 4)
- Readiness probe gates traffic to pod
- Liveness probe enables automatic restart on deadlock
- Initial delay accounts for startup time

**Implementation**:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

**Alternatives Considered**:
- TCP probe: Doesn't verify application health
- Exec probe: Adds overhead, less standard
- No probes: Violates Constitution V (Health Probes requirement)

---

## Summary

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| R1 | Workload Identity SA annotations | Microsoft recommended, no secrets |
| R2 | Separate NetworkPolicies | Easier debugging, clear documentation |
| R3 | Hybrid secrets (CSI + K8s) | Different lifecycle requirements |
| R4 | Init container copy pattern | Claude needs writable home |
| R5 | Four emptyDir mounts | Minimal writable paths for tools |
| R6 | 120s grace + 10s preStop | Long prompts need time |
| R7 | Burstable QoS | CPU bursting during execution |
| R8 | HTTP /health probes | Server already exposes endpoint |

All research items resolved. No NEEDS CLARIFICATION remaining.
