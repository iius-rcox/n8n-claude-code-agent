# Quickstart Guide: Autonomous Dev Team Agents

**Branch**: `011-autonomous-agents` | **Date**: 2026-01-19
**Purpose**: Get developers up and running with the autonomous agent system

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Local Development Setup](#3-local-development-setup)
4. [Testing Workflows](#4-testing-workflows)
5. [Deploying to Production](#5-deploying-to-production)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Prerequisites

### 1.1 Required Access

| Resource | Access Level | How to Request |
|----------|-------------|----------------|
| Azure Subscription (II-US) | Contributor | IT ticket |
| AKS Cluster (dev-aks) | kubectl access | Already configured via `az aks command invoke` |
| n8n Instance | Admin | https://n8n.coxserver.com |
| GitHub (ii-us org) | Write | Org admin |
| Teams Channel | Post messages | Channel owner |

### 1.2 Tools Required

```bash
# Azure CLI
az --version  # 2.50+ required

# Node.js
node --version  # 20+ required

# Docker
docker --version  # For building images

# jq (JSON processing)
jq --version

# yq (YAML processing)
yq --version  # 4.x required
```

### 1.3 Environment Variables

Create a `.env` file in the project root:

```bash
# Azure
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_RESOURCE_GROUP=rg_prod
AZURE_STORAGE_ACCOUNT=iiusagentstore

# n8n
N8N_URL=https://n8n.coxserver.com
N8N_API_KEY=<your-n8n-api-key>

# GitHub App (from Key Vault)
GITHUB_APP_ID=<app-id>
GITHUB_APP_INSTALLATION_ID=<installation-id>

# Teams Webhook
TEAMS_WEBHOOK_URL=<webhook-url>

# Claude Agent (internal service)
CLAUDE_AGENT_URL=http://claude-code-agent-svc.claude-agent.svc.cluster.local:3000
```

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

    USER                        n8n                         INFRASTRUCTURE
      │                          │                               │
      │   ┌──────────────────┐   │                               │
      └──▶│  Form Trigger    │───┼───────────────────────────────┤
          │  (Entry Point)   │   │                               │
          └────────┬─────────┘   │                               │
                   │             │                               │
                   ▼             │                               │
          ┌──────────────────┐   │   ┌────────────────────────┐  │
          │ Master           │   │   │  Azure Blob Storage    │  │
          │ Orchestrator     │◀──┼──▶│  (State & Artifacts)   │  │
          └────────┬─────────┘   │   └────────────────────────┘  │
                   │             │                               │
        ┌──────────┼──────────┐  │   ┌────────────────────────┐  │
        ▼          ▼          ▼  │   │  Claude Agent Pod      │  │
   ┌─────────┐ ┌─────────┐ ┌─────────┐│  (AKS)                │  │
   │PM Agent │ │Dev Agent│ │QA Agent │◀─▶│                      │  │
   │Workflow │ │Workflow │ │Workflow │   └────────────────────┘  │
   └─────────┘ └─────────┘ └─────────┘                           │
                                     │   ┌────────────────────────┐
                                     │   │  GitHub API            │
                                     └──▶│  (Repos, PRs)          │
                                         └────────────────────────┘
```

### 2.2 Data Flow

1. **User submits feature request** via n8n Form Trigger
2. **Master Orchestrator** creates task envelope in Blob Storage
3. **PM Agent** generates spec.md, plan.md, tasks.md
4. **Dev Agent** implements code, creates PR
5. **QA Agent** verifies against acceptance criteria
6. **Reviewer Agent** performs code review
7. **Dev Agent** merges approved PR
8. **Notification** sent to Teams

### 2.3 Key Files

| Category | Files |
|----------|-------|
| **Workflows** | `n8n-workflows/stage-{1-5}/*.json` |
| **Schemas** | `schemas/*.schema.json` |
| **Prompts** | `agent-prompts/*.md` |
| **Contracts** | `specs/011-autonomous-agents/contracts/*.yaml` |

---

## 3. Local Development Setup

### 3.1 Clone and Install

```bash
git clone https://github.com/ii-us/n8n-claude-code-agent.git
cd n8n-claude-code-agent
npm install

# Install dashboard dependencies
cd dashboard/backend && npm install && cd ../..
cd dashboard/frontend && npm install && cd ../..
```

### 3.2 Start Local Services

```bash
# Terminal 1: Dashboard backend
cd dashboard/backend
npm run dev

# Terminal 2: Dashboard frontend
cd dashboard/frontend
npm run dev

# Open http://localhost:5173 in browser
```

### 3.3 Verify Azure Connectivity

```bash
# Login to Azure
az login

# Verify storage access
az storage blob list \
  --account-name iiusagentstore \
  --container-name agent-state \
  --auth-mode login \
  --output table

# Verify AKS access
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl get pods -n claude-agent"
```

### 3.4 Test Claude Agent

```bash
# Direct test via AKS
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl exec -n claude-agent deploy/claude-code-agent -- \
    curl -s -X POST http://localhost:3000/run \
    -H 'Content-Type: application/json' \
    -d '{\"prompt\": \"Reply with: health check ok\"}'"
```

---

## 4. Testing Workflows

### 4.1 Import Workflows to n8n

```bash
# Import a single workflow
curl -X POST "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/stage-1/blob-state-manager.json

# Or use the n8n UI: Settings → Import from File
```

### 4.2 Test Blob State Manager

1. Open n8n: https://n8n.coxserver.com
2. Navigate to "Blob State Manager" workflow
3. Click "Execute Workflow"
4. Provide test input:

```json
{
  "operation": "create",
  "task_id": "FEAT-20260119-test01",
  "task_envelope": {
    "task_id": "FEAT-20260119-test01",
    "created_at": "2026-01-19T10:00:00Z",
    "created_by": "manual",
    "repository": "https://github.com/ii-us/test-repo",
    "request": {
      "title": "Test Feature",
      "description": "Testing the blob state manager",
      "priority": "low"
    },
    "status": "pending",
    "phase": "intake",
    "current_agent": "none",
    "phases": {},
    "feedback_loops": {
      "verification": { "cycle_count": 0, "max_cycles": 3, "history": [] },
      "review": { "cycle_count": 0, "max_cycles": 2, "history": [] }
    },
    "updated_at": "2026-01-19T10:00:00Z",
    "version": 1
  }
}
```

5. Verify blob created:

```bash
az storage blob show \
  --account-name iiusagentstore \
  --container-name agent-state \
  --name "FEAT-20260119-test01/task-envelope.yml" \
  --auth-mode login
```

### 4.3 Test Agent Runner

1. Navigate to "Agent Runner" workflow in n8n
2. Execute with test input:

```json
{
  "prompt": "You are a helpful assistant. Reply with exactly: 'Agent runner test successful'",
  "timeout_ms": 30000,
  "agent_role": "pm"
}
```

3. Verify exit code 0 and expected output

### 4.4 Test PM Intake Workflow

1. Navigate to "PM Intake" workflow
2. Execute with:

```json
{
  "task_id": "FEAT-20260119-test02",
  "task_envelope": {
    "request": {
      "title": "Add dark mode toggle",
      "description": "Users want a dark mode option in the settings page. It should persist across sessions and respect system preferences.",
      "priority": "medium",
      "acceptance_criteria": "- Dark mode toggle in settings\n- Persists in localStorage\n- Respects prefers-color-scheme"
    },
    "repository": "https://github.com/ii-us/test-repo"
  }
}
```

3. Verify spec.md created in agent-spec container

---

## 5. Deploying to Production

### 5.1 Workflow Deployment Checklist

- [ ] All workflows tested locally
- [ ] Environment variables configured in n8n
- [ ] Credentials created (Azure, GitHub App)
- [ ] Webhook URLs verified
- [ ] Error notification channel configured

### 5.2 Deploy Workflows

```bash
# Activate all workflows
for workflow in n8n-workflows/stage-*/*.json; do
  workflow_id=$(jq -r '.id' "$workflow")
  curl -X PATCH "$N8N_URL/api/v1/workflows/$workflow_id" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"active": true}'
done
```

### 5.3 Configure n8n Credentials

In n8n UI, create these credentials:

| Name | Type | Values |
|------|------|--------|
| `azure-blob-storage` | HTTP Header Auth | Bearer token from workload identity |
| `github-app` | HTTP Header Auth | Installation token (refreshed by workflow) |
| `teams-webhook` | HTTP Header Auth | Webhook URL |

### 5.4 Verify Production Deployment

1. Submit test feature via form: `https://n8n.coxserver.com/form/feature-request`
2. Monitor task progress in dashboard: `https://ops-dashboard.coxserver.com`
3. Verify Teams notifications received
4. Check blob storage for artifacts

---

## 6. Troubleshooting

### 6.1 Common Issues

#### Exit Code 57 (Auth Failure)

```bash
# Check Claude session tokens
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la ~/.claude"

# Refresh tokens if needed (see CLAUDE.md Token Refresh section)
```

#### Exit Code 124 (Timeout)

- Increase timeout in workflow
- Reduce context size (summarize previous artifacts)
- Check Claude Agent pod resources:

```bash
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl top pod -n claude-agent"
```

#### Lease Conflict (Exit Code 23)

```bash
# Break stuck lease
az storage blob lease break \
  --account-name iiusagentstore \
  --container-name agent-state \
  --blob-name "FEAT-xxx/task-envelope.yml" \
  --auth-mode login
```

#### Workflow Not Executing

1. Check workflow is active in n8n
2. Verify webhook URL is correct
3. Check n8n execution logs
4. Verify credentials are valid

### 6.2 Debugging Workflows

```bash
# View n8n execution history
curl "$N8N_URL/api/v1/executions?workflowId=<workflow-id>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" | jq '.data[:3]'

# Get specific execution details
curl "$N8N_URL/api/v1/executions/<execution-id>" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" | jq '.data'
```

### 6.3 Viewing Logs

```bash
# Claude Agent logs
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl logs -n claude-agent deploy/claude-code-agent --tail=100"

# Dashboard backend logs
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl logs -n ops-dashboard deploy/ops-dashboard --tail=100"
```

### 6.4 Health Checks

```bash
# Claude Agent health
az aks command invoke \
  --resource-group rg_prod \
  --name dev-aks \
  --command "kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health"

# Dashboard health
curl -s https://ops-dashboard.coxserver.com/api/health | jq
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| View task envelope | `az storage blob download --account-name iiusagentstore --container-name agent-state --name "FEAT-xxx/task-envelope.yml" --file - --auth-mode login` |
| List tasks | `az storage blob list --account-name iiusagentstore --container-name agent-state --auth-mode login --output table` |
| View spec.md | `az storage blob download --account-name iiusagentstore --container-name agent-spec --name "FEAT-xxx/spec.md" --file - --auth-mode login` |
| Check pod status | `az aks command invoke --resource-group rg_prod --name dev-aks --command "kubectl get pods -n claude-agent"` |
| Restart Claude Agent | `az aks command invoke --resource-group rg_prod --name dev-aks --command "kubectl rollout restart deployment/claude-code-agent -n claude-agent"` |

---

## Next Steps

1. Review [data-model.md](./data-model.md) for entity schemas
2. Review [contracts/](./contracts/) for API specifications
3. Review [research.md](./research.md) for implementation patterns
4. Start building Stage 1 workflows (Form Trigger, Blob State Manager, Agent Runner)
