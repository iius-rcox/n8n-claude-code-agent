# Sprint Archive

This document summarizes all completed sprints for the n8n-claude-code-agent project.

## Sprint Summary

| Sprint | Directory | Feature | Completed | Key Outputs |
|--------|-----------|---------|-----------|-------------|
| S1 | 001-azure-infra | Azure Infrastructure Foundation | 2026-01-14 | Storage account, managed identity, federated credentials |
| S2 | 002-github-app | GitHub App Authentication | 2026-01-14 | GitHub App (ID: 2658380), Key Vault secrets |
| S3 | 003-claude-session-tokens | Claude Session Tokens | 2026-01-14 | claude-session K8s secret |
| S4 | 004-docker-image | Docker Image Build | 2026-01-14 | Container image v4.6.4 |
| S5 | 005-kubernetes-deployment | Kubernetes Deployment | 2026-01-15 | Running pod, service, NetworkPolicies |
| S6 | 006-verification | Verification Suite | 2026-01-15 | All 11 verification tests pass |
| S7 | 007-teams-prompting | Teams Prompting | 2026-01-15 | CronJob watchdog, Teams notifications |
| S8 | 008-automated-testing | Automated Testing | 2026-01-15 | 37 Jest tests, GitHub Actions CI |

---

## Sprint Details

### Sprint 1: Azure Infrastructure Foundation

**Purpose:** Establish secure Azure infrastructure for the Claude agent.

**Key Deliverables:**
- Storage account `iiusagentstore` with 6 blob containers
- Managed identity `claude-agent-identity`
- Federated credential for Workload Identity
- RBAC role assignments (Storage Blob Data Contributor, Key Vault Secrets User)
- Network rules restricting storage access to AKS subnet
- Secrets Store CSI Driver enabled

**Outputs for Downstream:**
```json
{
  "ManagedIdentity": {
    "Name": "claude-agent-identity",
    "ClientID": "866b8e62-d9ce-42d1-a6b0-4382baf39f7a"
  },
  "StorageAccount": "iiusagentstore"
}
```

---

### Sprint 2: GitHub App Authentication

**Purpose:** Enable secure GitHub API access without personal access tokens.

**Key Deliverables:**
- GitHub App `ii-us-claude-code-agent` in ii-us organization
- Private key stored in Azure Key Vault
- App installed on n8n-claude-code-agent repository

**Outputs for Downstream:**
```json
{
  "AppID": "2658380",
  "AppName": "ii-us-claude-code-agent",
  "KeyVaultSecrets": ["github-app-id", "github-app-private-key"]
}
```

---

### Sprint 3: Claude Session Tokens

**Purpose:** Capture and securely store Claude Max session tokens.

**Key Deliverables:**
- Fresh Claude login captured
- Kubernetes secret `claude-session` created
- Token verification test passed

**Outputs for Downstream:**
```json
{
  "SecretName": "claude-session",
  "MountPath": "/home/claude-agent/.claude/"
}
```

---

### Sprint 4: Docker Image Build

**Purpose:** Create production-ready container image with all required tools.

**Key Deliverables:**
- Dockerfile with Ubuntu 24.04 base
- HTTP server (server.js) with /health and /run endpoints
- Shell scripts (check-auth.sh, notify.sh)
- Container pushed to ACR

**Outputs for Downstream:**
```json
{
  "Image": "iiusacr.azurecr.io/claude-agent:v4.6.4",
  "Port": 3000,
  "HealthPath": "/health",
  "RunPath": "/run"
}
```

---

### Sprint 5: Kubernetes Deployment

**Purpose:** Deploy Claude agent to AKS with security hardening.

**Key Deliverables:**
- Namespace `claude-agent` with service account
- Deployment with init container pattern
- Service (ClusterIP) for n8n access
- 4 NetworkPolicies (zero-trust)
- SecretProviderClass for GitHub CSI

**Outputs for Downstream:**
```json
{
  "ServiceDNS": "claude-agent.claude-agent.svc.cluster.local",
  "ServicePort": 80,
  "Namespace": "claude-agent"
}
```

---

### Sprint 6: Verification Suite

**Purpose:** Validate all infrastructure components work together.

**Test Results:**
| Test | Status |
|------|--------|
| Azure Workload Identity | PASS |
| Storage Container Access | PASS |
| Claude Authentication | PASS |
| GitHub CSI Secrets | PASS |
| NetworkPolicies | PASS |
| HTTP Health Endpoint | PASS |

**Issues Resolved:**
- Fixed `az login --identity` for Workload Identity (use federated token)
- Fixed read-only filesystem for Claude CLI (moved files to /opt/claude-agent/)

---

### Sprint 7: Teams Prompting

**Purpose:** Enable proactive auth monitoring with Teams notifications.

**Key Deliverables:**
- Teams webhook configured
- CronJob `claude-auth-watchdog` (every 30 minutes)
- Adaptive Card notifications on auth failure
- End-to-end n8n integration verified

**Container Update:** v4.6.4 (fixed CRLF line endings)

---

### Sprint 8: Automated Testing

**Purpose:** Establish test infrastructure for code quality.

**Key Deliverables:**
- Jest configuration with 80%+ coverage thresholds
- 25 unit tests for HTTP server
- 12 integration tests for HTTP flow
- BATS tests for shell scripts
- GitHub Actions CI workflow

**Test Coverage:**
- Statements: 80%
- Branches: 82.89%
- Functions: 64.7%
- Lines: 81.3%

---

## Archived Artifacts

Each sprint directory contains:
- `spec.md` - Feature specification
- `plan.md` - Implementation plan
- `tasks.md` - Task checklist with completion status
- `quickstart.md` - Runbook for execution
- Additional design documents (research.md, data-model.md, contracts/)

These artifacts serve as historical reference and can be used for:
- Onboarding new team members
- Reproducing the deployment
- Understanding design decisions
- Troubleshooting issues

---

## Constitution Compliance

All sprints followed the project constitution (`.specify/memory/constitution.md`):

| Principle | Compliance |
|-----------|------------|
| I. Spec-First Development | All features started with spec.md |
| II. Security by Default | Zero-trust networking, Workload Identity, TLS 1.2+ |
| III. Phase Gates | Specify → Plan → Tasks → Implement sequence followed |
| IV. Infrastructure as Code | All K8s manifests in repository |
| V. Automation & Observability | Health probes, exit codes, Teams alerts |
| VI. Pragmatic Automation | Scripts for runtime, runbooks for one-time tasks |

---

## Next Steps

With all 8 sprints complete, the system is production-ready. Future work could include:

1. **Enhanced Monitoring**: Prometheus metrics, log aggregation
2. **Multi-Agent Orchestration**: Multiple Claude instances
3. **Auto-Scaling**: HPA for workload spikes
4. **Disaster Recovery**: Cross-region backup
