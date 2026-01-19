# Research Findings: Autonomous Dev Team Agents

**Branch**: `011-autonomous-agents` | **Date**: 2026-01-19
**Purpose**: Technical patterns and implementation guidance for the orchestration layer

## Table of Contents

1. [n8n Workflow Patterns for Claude Integration](#1-n8n-workflow-patterns-for-claude-integration)
2. [GitHub App Token Minting](#2-github-app-token-minting)
3. [Azure Blob Lease Management](#3-azure-blob-lease-management)
4. [Teams Adaptive Cards](#4-teams-adaptive-cards)
5. [Context Management Strategies](#5-context-management-strategies)
6. [n8n Sub-Workflow Patterns](#6-n8n-sub-workflow-patterns)

---

## 1. n8n Workflow Patterns for Claude Integration

### 1.1 HTTP Request Node Configuration

The Claude Agent HTTP server (`infra/docker/server.js`) exposes two endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness/readiness probe |
| `/run` | POST | Execute Claude CLI with prompt |

**n8n HTTP Request Node for `/run`**:

```json
{
  "parameters": {
    "method": "POST",
    "url": "http://claude-code-agent-svc.claude-agent.svc.cluster.local:3000/run",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        { "name": "prompt", "value": "={{ $json.system_prompt + '\\n\\n' + $json.user_prompt }}" },
        { "name": "timeout", "value": "={{ $json.timeout_ms || 300000 }}" },
        { "name": "workingDir", "value": "/workspace" }
      ]
    },
    "options": {
      "response": { "response": { "fullResponse": true } },
      "timeout": 310000
    }
  }
}
```

### 1.2 Exit Code Handling with Switch Node

The server returns JSON with `exitCode` field. Use n8n Switch node for routing:

```json
{
  "parameters": {
    "rules": {
      "rules": [
        {
          "outputKey": "success",
          "conditions": {
            "conditions": [
              { "leftValue": "={{ $json.exitCode }}", "rightValue": 0, "operator": { "type": "number", "operation": "equals" } }
            ]
          }
        },
        {
          "outputKey": "lease_conflict",
          "conditions": {
            "conditions": [
              { "leftValue": "={{ $json.exitCode }}", "rightValue": 23, "operator": { "type": "number", "operation": "equals" } }
            ]
          }
        },
        {
          "outputKey": "auth_failure",
          "conditions": {
            "conditions": [
              { "leftValue": "={{ $json.exitCode }}", "rightValue": 57, "operator": { "type": "number", "operation": "equals" } }
            ]
          }
        },
        {
          "outputKey": "timeout",
          "conditions": {
            "conditions": [
              { "leftValue": "={{ $json.exitCode }}", "rightValue": 124, "operator": { "type": "number", "operation": "equals" } }
            ]
          }
        },
        {
          "outputKey": "error",
          "conditions": {
            "conditions": [
              { "leftValue": "={{ $json.exitCode }}", "rightValue": 0, "operator": { "type": "number", "operation": "notEquals" } }
            ]
          }
        }
      ]
    }
  }
}
```

### 1.3 Response Parsing Pattern

Claude's output needs extraction from the response:

```javascript
// n8n Code node for parsing Claude output
const response = $input.first().json;

if (!response.success) {
  return {
    status: 'error',
    exitCode: response.exitCode,
    error: response.stderr || response.output,
    duration: response.duration
  };
}

// Parse structured output (YAML/JSON) from Claude's response
const output = response.output;

// Look for code blocks with structured data
const yamlMatch = output.match(/```yaml\n([\s\S]*?)\n```/);
const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);

let parsedContent = null;
if (yamlMatch) {
  // Would need yaml parser - n8n has built-in
  parsedContent = { type: 'yaml', raw: yamlMatch[1] };
} else if (jsonMatch) {
  parsedContent = { type: 'json', data: JSON.parse(jsonMatch[1]) };
}

return {
  status: 'success',
  exitCode: 0,
  rawOutput: output,
  parsedContent,
  duration: response.duration
};
```

---

## 2. GitHub App Token Minting

### 2.1 Overview

GitHub App authentication provides fine-grained, time-limited tokens for repository access. The flow:

1. Create JWT signed with App private key
2. Exchange JWT for installation access token
3. Use token for GitHub API calls (1-hour validity)

### 2.2 Implementation Pattern

**Credentials stored in Azure Key Vault**:
- `github-app-id`: Application ID (integer)
- `github-app-private-key`: PEM-encoded private key
- `github-app-installation-id`: Installation ID for ii-us org

**n8n Function Node for JWT Creation**:

```javascript
const crypto = require('crypto');

// Get credentials from previous node (Key Vault fetch)
const appId = $input.first().json.appId;
const privateKey = $input.first().json.privateKey;
const installationId = $input.first().json.installationId;

// JWT Header
const header = {
  alg: 'RS256',
  typ: 'JWT'
};

// JWT Payload (10 minute expiry, issued 60s ago for clock skew)
const now = Math.floor(Date.now() / 1000);
const payload = {
  iat: now - 60,
  exp: now + (10 * 60),
  iss: appId
};

// Base64URL encode
function base64url(data) {
  return Buffer.from(JSON.stringify(data))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Create signature
const signatureInput = `${base64url(header)}.${base64url(payload)}`;
const sign = crypto.createSign('RSA-SHA256');
sign.update(signatureInput);
const signature = sign.sign(privateKey, 'base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const jwt = `${signatureInput}.${signature}`;

return {
  jwt,
  installationId,
  expiresAt: new Date((now + 600) * 1000).toISOString()
};
```

**n8n HTTP Request for Token Exchange**:

```json
{
  "parameters": {
    "method": "POST",
    "url": "=https://api.github.com/app/installations/{{ $json.installationId }}/access_tokens",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "=Bearer {{ $json.jwt }}" },
        { "name": "Accept", "value": "application/vnd.github+json" },
        { "name": "X-GitHub-Api-Version", "value": "2022-11-28" }
      ]
    }
  }
}
```

**Response**:
```json
{
  "token": "ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_at": "2026-01-19T12:00:00Z",
  "permissions": {
    "contents": "write",
    "pull_requests": "write",
    "metadata": "read"
  },
  "repository_selection": "all"
}
```

### 2.3 Token Caching Strategy

Since tokens last 1 hour, cache in blob storage to avoid repeated minting:

```yaml
# agent-state/github-token-cache.yml
token: ghs_xxxx
expires_at: "2026-01-19T12:00:00Z"
minted_at: "2026-01-19T11:00:00Z"
```

**Refresh logic**: If `expires_at` is within 5 minutes, mint new token.

---

## 3. Azure Blob Lease Management

### 3.1 Lease Concepts

Azure Blob leases provide distributed locking:
- **Lease duration**: 15-60 seconds (or infinite)
- **Lease ID**: GUID returned on acquire, required for operations
- **States**: Available, Leased, Expired, Breaking, Broken

For task envelope concurrency control, use **60-second leases** with automatic renewal.

### 3.2 REST API Patterns

**Acquire Lease**:
```
PUT https://iiusagentstore.blob.core.windows.net/agent-state/{task_id}/task-envelope.yml?comp=lease
x-ms-lease-action: acquire
x-ms-lease-duration: 60
x-ms-version: 2020-10-02
Authorization: Bearer {token}
```

**Response Headers**:
```
x-ms-lease-id: {lease-guid}
x-ms-lease-state: leased
```

**Renew Lease** (before expiry):
```
PUT https://iiusagentstore.blob.core.windows.net/agent-state/{task_id}/task-envelope.yml?comp=lease
x-ms-lease-action: renew
x-ms-lease-id: {lease-guid}
```

**Release Lease** (on success):
```
PUT https://iiusagentstore.blob.core.windows.net/agent-state/{task_id}/task-envelope.yml?comp=lease
x-ms-lease-action: release
x-ms-lease-id: {lease-guid}
```

**Break Lease** (force unlock):
```
PUT https://iiusagentstore.blob.core.windows.net/agent-state/{task_id}/task-envelope.yml?comp=lease
x-ms-lease-action: break
x-ms-lease-break-period: 0
```

### 3.3 n8n HTTP Request Node Pattern

```json
{
  "parameters": {
    "method": "PUT",
    "url": "=https://iiusagentstore.blob.core.windows.net/agent-state/{{ $json.task_id }}/task-envelope.yml?comp=lease",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "x-ms-lease-action", "value": "acquire" },
        { "name": "x-ms-lease-duration", "value": "60" },
        { "name": "x-ms-version", "value": "2020-10-02" },
        { "name": "Authorization", "value": "=Bearer {{ $json.azure_token }}" }
      ]
    },
    "options": {
      "response": { "response": { "responseHeaders": true } }
    }
  }
}
```

### 3.4 Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 201 | Lease acquired | Proceed with update |
| 409 | Lease conflict (already leased) | Wait and retry (exit code 23) |
| 404 | Blob not found | Create blob first |
| 412 | Lease ID mismatch | Re-acquire lease |

---

## 4. Teams Adaptive Cards

### 4.1 Human Checkpoint Card

For escalations requiring human approval:

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          {
            "type": "Container",
            "style": "attention",
            "items": [
              {
                "type": "TextBlock",
                "text": "🚨 Human Review Required",
                "weight": "Bolder",
                "size": "Large"
              }
            ]
          },
          {
            "type": "FactSet",
            "facts": [
              { "title": "Task ID", "value": "${task_id}" },
              { "title": "Phase", "value": "${phase}" },
              { "title": "Reason", "value": "${escalation_reason}" },
              { "title": "Retry Count", "value": "${retry_count}/3" }
            ]
          },
          {
            "type": "TextBlock",
            "text": "${description}",
            "wrap": true
          },
          {
            "type": "ActionSet",
            "actions": [
              {
                "type": "Action.Http",
                "title": "✅ Approve",
                "method": "POST",
                "url": "${callback_url}/approve",
                "body": "{\"task_id\": \"${task_id}\", \"action\": \"approve\"}"
              },
              {
                "type": "Action.Http",
                "title": "❌ Reject",
                "method": "POST",
                "url": "${callback_url}/reject",
                "body": "{\"task_id\": \"${task_id}\", \"action\": \"reject\"}"
              },
              {
                "type": "Action.OpenUrl",
                "title": "📋 View Details",
                "url": "${dashboard_url}/tasks/${task_id}"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 4.2 Status Update Card

For progress notifications:

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          {
            "type": "ColumnSet",
            "columns": [
              {
                "type": "Column",
                "width": "auto",
                "items": [
                  {
                    "type": "TextBlock",
                    "text": "${status_emoji}",
                    "size": "ExtraLarge"
                  }
                ]
              },
              {
                "type": "Column",
                "width": "stretch",
                "items": [
                  {
                    "type": "TextBlock",
                    "text": "${title}",
                    "weight": "Bolder"
                  },
                  {
                    "type": "TextBlock",
                    "text": "${task_id} • ${phase}",
                    "isSubtle": true,
                    "spacing": "None"
                  }
                ]
              }
            ]
          },
          {
            "type": "TextBlock",
            "text": "${message}",
            "wrap": true
          }
        ]
      }
    }
  ]
}
```

### 4.3 n8n HTTP Request for Teams

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.TEAMS_WEBHOOK_URL }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify($json.adaptive_card) }}"
  }
}
```

---

## 5. Context Management Strategies

### 5.1 Context Budget Allocation (80KB total)

| Category | Allocation | Tokens (~) | Purpose |
|----------|------------|------------|---------|
| System Prompt | 8% | ~1,600 | Agent persona, phase instructions |
| Task Envelope | 12% | ~2,400 | Current state, history, metadata |
| Specification | 15% | ~3,000 | Requirements, acceptance criteria |
| Previous Artifacts | 20% | ~4,000 | Plans, verification reports |
| Relevant Code | 35% | ~7,000 | Files being modified |
| Working Space | 10% | ~2,000 | Agent reasoning |

### 5.2 Progressive Loading Strategy

**Priority 1 (Always Load)**:
- System prompt for agent role
- Task envelope summary (not full history)
- Current phase requirements

**Priority 2 (Phase-Specific)**:
- Intake: Original request, repo structure summary
- Planning: Specification, codebase patterns
- Implementation: Plan, relevant code files
- Verification: Spec acceptance criteria, PR diff
- Review: PR diff, security checklist
- Release: PR URL, merge requirements

**Priority 3 (On-Demand)**:
- Full file contents (load as needed)
- Historical artifacts (summarized)
- Error history (recent only)

### 5.3 Summarization Patterns

**Specification Summarization**:
```yaml
# Full spec (too large)
functional_requirements:
  - FR1: System shall accept feature requests via web form
  - FR2: System shall validate all required fields
  # ... 20 more requirements

# Summarized for context
functional_requirements_summary:
  count: 22
  categories: [form_submission, github_integration, agent_execution, state_management]
  key_requirements:
    - Web form submission with validation
    - GitHub App token authentication
    - Bounded retry loops (max 3)
```

**Verification Report Summarization**:
```yaml
# Full report
test_results:
  passed: [test1, test2, test3, ...]  # 50 tests
  failed: [testX]

# Summarized
test_results_summary:
  passed: 49
  failed: 1
  failed_tests:
    - name: testX
      error: "Expected 200, got 500"
```

---

## 6. n8n Sub-Workflow Patterns

### 6.1 Sub-Workflow Architecture

Master Orchestrator calls phase-specific sub-workflows:

```
Master Orchestrator
    │
    ├── [Sub-Workflow: PM Intake]
    │       └── Returns: spec.md path, needs_clarification flag
    │
    ├── [Sub-Workflow: PM Planning]
    │       └── Returns: plan.md path
    │
    ├── [Sub-Workflow: PM Tasks]
    │       └── Returns: tasks.md path, task_count
    │
    ├── [Sub-Workflow: Dev Implementation]
    │       └── Returns: pr_url, commit_sha
    │
    ├── [Sub-Workflow: QA Verification]
    │       └── Returns: passed flag, issues[]
    │
    ├── [Sub-Workflow: Reviewer]
    │       └── Returns: approved flag, comments[]
    │
    └── [Sub-Workflow: Dev Release]
            └── Returns: merge_sha, status
```

### 6.2 Sub-Workflow Trigger Configuration

```json
{
  "nodes": [
    {
      "name": "Sub-Workflow Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "parameters": {},
      "position": [250, 300]
    }
  ]
}
```

### 6.3 Calling Sub-Workflows

```json
{
  "name": "Call PM Intake",
  "type": "n8n-nodes-base.executeWorkflow",
  "parameters": {
    "workflowId": "={{ $env.WORKFLOW_ID_PM_INTAKE }}",
    "mode": "each",
    "options": {
      "waitForSubWorkflow": true
    }
  }
}
```

### 6.4 Error Handling in Sub-Workflows

Each sub-workflow should:
1. Catch errors with Error Trigger node
2. Return standardized error format
3. Allow parent to decide retry/escalate

```json
{
  "nodes": [
    {
      "name": "Error Trigger",
      "type": "n8n-nodes-base.errorTrigger",
      "position": [250, 500]
    },
    {
      "name": "Format Error Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { success: false, error: $input.first().json.message, phase: 'intake' };"
      },
      "position": [450, 500]
    }
  ]
}
```

### 6.5 Data Flow Between Workflows

**Input to Sub-Workflow**:
```json
{
  "task_id": "FEAT-20260119-abc123",
  "task_envelope": { /* current state */ },
  "azure_token": "eyJ...",
  "github_token": "ghs_..."
}
```

**Output from Sub-Workflow**:
```json
{
  "success": true,
  "phase": "intake",
  "outputs": {
    "spec_path": "agent-spec/FEAT-xxx/spec.md",
    "needs_clarification": false
  },
  "duration_ms": 45000,
  "exit_code": 0
}
```

---

## Summary

| Component | Pattern | Key Files/Endpoints |
|-----------|---------|---------------------|
| Claude Integration | HTTP POST to `/run` with prompt | `server.js` |
| Exit Code Routing | n8n Switch node on `exitCode` | 0, 23, 57, 124 |
| GitHub Auth | JWT → Installation Token | Key Vault secrets |
| Blob Leases | 60s acquire → update → release | REST API |
| Teams Alerts | Adaptive Cards via webhook | `notify.sh` pattern |
| Context Management | 80KB budget, progressive load | Summarization rules |
| Sub-Workflows | Master → Phase workflows | Error standardization |

## Next Steps

This research informs the following Phase 1 artifacts:
- **data-model.md**: Entity schemas based on blob storage patterns
- **contracts/**: API schemas for workflow communication
- **quickstart.md**: Developer guide using these patterns
