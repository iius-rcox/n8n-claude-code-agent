# n8n Workflows for Autonomous Dev Team Agents

This directory contains the n8n workflow definitions for orchestrating the autonomous development team.

## Directory Structure

```
n8n-workflows/
├── stage-1/                    # Foundation workflows
│   ├── feature-request-form.json    # Entry point form trigger
│   ├── blob-state-manager.json      # Azure Blob CRUD with leases
│   └── agent-runner.json            # Claude Agent HTTP wrapper
├── stage-2/                    # PM Agent workflows
│   ├── pm-intake.json               # Create spec.md
│   ├── pm-planning.json             # Create plan.md
│   └── pm-tasks.json                # Create tasks.md
├── stage-3/                    # Dev Agent workflows
│   ├── github-token-manager.json    # GitHub App token minting
│   ├── dev-implementation.json      # Implement tasks, create PR
│   └── dev-release.json             # Merge approved PR
├── stage-4/                    # Quality workflows
│   ├── qa-verification.json         # Run tests, check criteria
│   ├── reviewer.json                # Code review with security
│   └── feedback-router.json         # Route feedback to Dev
└── stage-5/                    # Orchestration workflows
    ├── master-orchestrator.json     # Route through all phases
    ├── human-checkpoint.json        # Pause for human approval
    ├── task-recovery.json           # Recover stuck tasks
    └── notification-hub.json        # Teams notifications
```

## n8n Environment Configuration

### Required Environment Variables

Configure these in n8n Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAUDE_AGENT_URL` | Internal service URL for Claude Agent | `http://claude-code-agent-svc.claude-agent.svc.cluster.local:3000` |
| `AZURE_STORAGE_ACCOUNT` | Storage account for task state | `iiusagentstore` |
| `AZURE_STORAGE_ACCOUNT_URL` | Full storage URL | `https://iiusagentstore.blob.core.windows.net` |
| `TEAMS_WEBHOOK_URL` | Teams incoming webhook for notifications | `https://outlook.office.com/webhook/...` |
| `GITHUB_API_URL` | GitHub API base URL | `https://api.github.com` |

### n8n Credentials to Create

Create these credentials in n8n UI (Settings → Credentials):

#### 1. Azure Blob Storage

- **Type**: Header Auth
- **Name**: `azure-blob-storage`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer {{ $credentials.azure_token }}` (fetched via Workload Identity)

**Note**: Token acquisition is handled by the `blob-state-manager.json` workflow using Azure Workload Identity. The service account in the n8n namespace must have federated identity binding.

#### 2. GitHub App

- **Type**: Custom Header Auth
- **Name**: `github-app-credentials`
- **Values** (stored in Azure Key Vault):
  - `app_id`: GitHub App ID
  - `private_key`: PEM-encoded private key
  - `installation_id`: Installation ID for ii-us org

**Note**: Tokens are minted on-demand by `github-token-manager.json` workflow using JWT creation → installation token exchange.

#### 3. Teams Webhook

- **Type**: HTTP Header Auth
- **Name**: `teams-webhook`
- **No authentication required** (webhook URL contains auth token)

### n8n Settings

Configure in n8n Settings → Settings:

```json
{
  "executions": {
    "timeout": 600,
    "maxTimeout": 3600
  },
  "queue": {
    "bull": {
      "settings": {
        "lockDuration": 600000,
        "lockRenewTime": 300000
      }
    }
  }
}
```

## Workflow Import

### Import Single Workflow

```bash
# Using n8n API
curl -X POST "$N8N_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @stage-1/blob-state-manager.json

# Or via n8n UI: Settings → Import from File
```

### Import All Workflows

```bash
#!/bin/bash
for stage in stage-{1..5}; do
  for workflow in $stage/*.json; do
    echo "Importing $workflow..."
    curl -X POST "$N8N_URL/api/v1/workflows" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$workflow"
  done
done
```

### Activate Workflows

```bash
# Activate a workflow by ID
curl -X PATCH "$N8N_URL/api/v1/workflows/{workflow_id}" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

## Workflow Dependencies

```
Feature Request Form ─────────────────────────────────────────────────────────
         │
         └──▶ Master Orchestrator ◀──── Task Recovery (cron)
                    │
    ┌───────────────┼───────────────┬───────────────┐
    ▼               ▼               ▼               ▼
PM Intake ──▶ PM Planning ──▶ PM Tasks    Human Checkpoint
    │                             │               │
    │               ┌─────────────┘               │
    │               ▼                             │
    │       Dev Implementation ◀─────┬────────────┘
    │               │                │
    │               ▼                │
    │       QA Verification ─────▶ Feedback Router
    │               │                │
    │               ▼                │
    │       Reviewer ─────────────▶─┘
    │               │
    │               ▼
    └──────▶ Dev Release
                    │
                    ▼
            Notification Hub
```

All workflows depend on:
- **Blob State Manager**: State persistence
- **Agent Runner**: Claude Agent execution

## Testing Workflows

See [quickstart.md](../specs/011-autonomous-agents/quickstart.md) for detailed testing instructions.

### Quick Smoke Test

1. Import `blob-state-manager.json`
2. Execute with test task envelope
3. Verify blob created in Azure Storage

```bash
az storage blob list \
  --account-name iiusagentstore \
  --container-name agent-state \
  --auth-mode login \
  --output table
```

## Exit Code Reference

| Code | Meaning | Workflow Action |
|------|---------|-----------------|
| 0 | Success | Continue to next phase |
| 23 | Lease conflict | Wait 5s, retry up to 3x |
| 57 | Auth failure | Open circuit breaker, alert |
| 124 | Timeout | Retry with extended timeout |
| Other | Error | Log, retry with context |

## Conventions

### Node Naming

- **Trigger nodes**: `trigger_{type}` (e.g., `trigger_form`, `trigger_webhook`)
- **HTTP nodes**: `http_{action}` (e.g., `http_post_claude`, `http_get_blob`)
- **Code nodes**: `code_{purpose}` (e.g., `code_parse_response`, `code_build_prompt`)
- **Switch nodes**: `route_{field}` (e.g., `route_exit_code`, `route_phase`)
- **Sub-workflow calls**: `call_{workflow}` (e.g., `call_blob_state_manager`)

### Error Handling

Every workflow should have:
1. **Error Trigger**: Catch workflow-level errors
2. **Try/Catch**: Around critical operations
3. **Fallback path**: What to do on error

### Version Control

- Workflows are exported as JSON for git version control
- Include workflow ID in commit message when updating
- Test locally before committing

## Related Documentation

- [Task Envelope Schema](../schemas/task-envelope.schema.json)
- [Agent Prompts](../agent-prompts/)
- [API Contracts](../specs/011-autonomous-agents/contracts/)
- [Quickstart Guide](../specs/011-autonomous-agents/quickstart.md)
