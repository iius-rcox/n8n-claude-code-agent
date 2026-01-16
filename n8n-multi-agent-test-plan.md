# n8n Multi-Agent System Testing Plan

## Document Information

| Property | Value |
|----------|-------|
| **Version** | 1.0 |
| **Created** | January 15, 2026 |
| **System** | n8n Claude Agent Orchestrator v4.6.4 |
| **Environment** | Azure AKS (`dev-aks`) / n8n (`n8n.ii-us.com`) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Test Architecture](#2-test-architecture)
3. [Unit Tests](#3-unit-tests)
4. [Integration Tests](#4-integration-tests)
5. [End-to-End Tests](#5-end-to-end-tests)
6. [n8n Workflow Tests](#6-n8n-workflow-tests)
7. [Authentication Tests](#7-authentication-tests)
8. [Kubernetes Component Tests](#8-kubernetes-component-tests)
9. [Network & Security Tests](#9-network--security-tests)
10. [Performance & Load Tests](#10-performance--load-tests)
11. [Failure & Recovery Tests](#11-failure--recovery-tests)
12. [Test Execution](#12-test-execution)

---

## 1. Overview

### 1.1 Purpose

This test plan provides comprehensive validation procedures for the n8n Multi-Agent System, which orchestrates Claude Code CLI execution through n8n workflows on Azure Kubernetes Service.

### 1.2 System Components

| Component | Location | Purpose |
|-----------|----------|---------|
| HTTP Server | `infra/docker/server.js` | Exposes Claude CLI via HTTP for n8n |
| Auth Scripts | `infra/docker/check-auth.sh` | Validates Claude session tokens |
| Notify Scripts | `infra/docker/notify.sh` | Teams webhook notifications |
| n8n Workflow | `Claude Agent Orchestrator POC` | Orchestrates agent runs with retry logic |
| K8s Deployment | `infra/k8s/deployment.yaml` | Claude agent container |
| K8s CronJob | `infra/k8s/cronjob.yaml` | Auth watchdog (30-min interval) |
| NetworkPolicies | `infra/k8s/networkpolicy-*.yaml` | Zero-trust network security |

### 1.3 Test Coverage Matrix

| Layer | Test Type | Framework | Location |
|-------|-----------|-----------|----------|
| HTTP Server | Unit | Jest | `tests/unit/server.test.js` |
| HTTP Server | Integration | Jest | `tests/integration/http-flow.test.js` |
| Shell Scripts | Unit | BATS | `tests/scripts/*.bats` |
| n8n Workflow | Mock Integration | n8n Mock Mode | In-workflow |
| Kubernetes | Smoke/E2E | kubectl + curl | Manual/CI |
| Full System | E2E | n8n Webhook | Manual/CI |

---

## 2. Test Architecture

### 2.1 Test Pyramid

```
                    /\
                   /  \  E2E Tests (5%)
                  /----\  - Full n8n → Claude → Response
                 /      \
                /--------\  Integration Tests (25%)
               /          \  - HTTP Server + Mock CLI
              /            \  - n8n → HTTP → Mock Response
             /              \
            /----------------\  Unit Tests (70%)
           /                  \  - Server logic, validation
          /                    \  - Exit code handling
         /______________________\  - Shell script functions
```

### 2.2 Mock Strategy

| Component | Mock Approach |
|-----------|---------------|
| Claude CLI | `tests/mocks/spawnSync.js` - Mock exit codes, outputs |
| curl | `tests/mocks/curl-mock.sh` - Capture webhook calls |
| n8n Workflow | Built-in mock mode (`mock: true` parameter) |
| Azure Storage | Skip in unit tests, real in E2E |
| Teams Webhook | Capture payload, verify format |

---

## 3. Unit Tests

### 3.1 HTTP Server Unit Tests

**Location:** `tests/unit/server.test.js`
**Framework:** Jest with supertest

#### TEST-UNIT-001: Health Endpoint

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-001 |
| **Description** | Verify `/health` returns correct status in all states |
| **Status** | Implemented |

**Test Cases:**
- [x] Returns 200 with `healthy` status when server is healthy
- [x] Returns 503 with `shutting_down` status during shutdown
- [x] Includes `activeRequests` count and timestamp

#### TEST-UNIT-002: Run Endpoint Validation

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-002 |
| **Description** | Verify `/run` input validation rules |
| **Status** | Implemented |

**Test Cases:**
- [x] Returns 400 for missing prompt
- [x] Returns 400 for non-string prompt
- [x] Returns 400 for oversized prompt (>100KB)
- [x] Returns 400 for invalid timeout (negative, zero, non-number)
- [x] Returns 400 for timeout exceeding maximum
- [x] Returns 400 for relative workdir path
- [x] Returns 400 for invalid JSON body

#### TEST-UNIT-003: Exit Code Handling

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-003 |
| **Description** | Verify exit code interpretation and response mapping |
| **Status** | Implemented |

**Test Cases:**
- [x] Exit 0 → success: true, exitCode: 0
- [x] Exit 57 → success: false, error: "Authentication failed"
- [x] Exit 124 → success: false, error: contains "timed out"
- [x] Exit 1 → success: false, generic error
- [x] Spawn failure → 500 status, "Failed to spawn"

#### TEST-UNIT-004: Graceful Shutdown

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-004 |
| **Description** | Verify graceful shutdown behavior |
| **Status** | Implemented |

**Test Cases:**
- [x] Rejects new `/run` requests with 503 during shutdown
- [x] Still serves `/health` during shutdown
- [x] Tracks `activeRequests` count correctly

### 3.2 Shell Script Tests

**Location:** `tests/scripts/*.bats`
**Framework:** BATS (Bash Automated Testing System)

#### TEST-UNIT-005: check-auth.sh

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-005 |
| **Description** | Verify Claude authentication check script |
| **Status** | Implemented |

**Test Cases:**
- [x] Exits 0 when Claude auth succeeds
- [x] Does not notify Teams on success
- [x] Exits 57 when Claude auth fails
- [x] Calls notify.sh on auth failure
- [x] Handles timeout as auth failure
- [x] Handles missing `TEAMS_WEBHOOK_URL` gracefully

#### TEST-UNIT-006: notify.sh

| Field | Value |
|-------|-------|
| **Test ID** | TEST-UNIT-006 |
| **Description** | Verify Teams notification script |
| **Status** | Implemented |

**Test Cases:**
- [x] Sends adaptive card payload to webhook URL
- [x] Includes title, message, and facts in payload
- [x] Exits 0 on successful POST
- [x] Exits non-zero on curl failure
- [x] Validates JSON facts parameter

---

## 4. Integration Tests

### 4.1 HTTP Flow Integration

**Location:** `tests/integration/http-flow.test.js`
**Framework:** Jest with supertest

#### TEST-INT-001: Full Request/Response Cycle

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-001 |
| **Description** | Verify complete HTTP → CLI flow |
| **Status** | Implemented |

**Test Cases:**
- [x] Processes prompt and returns Claude response
- [x] Passes all parameters to Claude CLI correctly
- [x] Handles auth failure response correctly (exit 57)
- [x] Handles timeout response correctly (exit 124)

#### TEST-INT-002: Concurrent Request Handling

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-002 |
| **Description** | Verify server handles concurrent requests |
| **Status** | Implemented |

**Test Cases:**
- [x] Handles multiple sequential requests
- [x] Handles concurrent health checks
- [x] Handles mixed concurrent requests (/health + /run)

#### TEST-INT-003: Error Recovery

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-003 |
| **Description** | Verify server recovers from errors |
| **Status** | Implemented |

**Test Cases:**
- [x] Recovers from validation errors
- [x] Recovers from Claude CLI errors

---

## 5. End-to-End Tests

### 5.1 Pod-Level E2E Tests

#### TEST-E2E-001: Pod Health Check

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-001 |
| **Description** | Verify pod is running and healthy |
| **Priority** | Critical |
| **Frequency** | Every 5 minutes (automated) |

**Procedure:**
```powershell
# Check pod status
kubectl get pods -n claude-agent -l app=claude-code-agent -o wide

# Test health endpoint via port-forward
kubectl port-forward -n claude-agent svc/claude-agent 3000:80 &
curl http://localhost:3000/health
```

**Pass Criteria:**
- Pod status is `Running`
- Health endpoint returns 200 with `status: "healthy"`
- `activeRequests` is 0 (when idle)

#### TEST-E2E-002: Claude CLI Authentication

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-002 |
| **Description** | Verify Claude session tokens are valid |
| **Priority** | Critical |
| **Frequency** | Every 30 minutes (CronJob) |

**Procedure:**
```powershell
# Exec into pod and run health check
kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "health check"

# Or via HTTP
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say health check OK", "timeout": 30000}'
```

**Pass Criteria:**
- Claude CLI returns exit code 0
- Response contains expected output

**Fail Action:**
- CronJob triggers Teams notification
- Manual token refresh required

#### TEST-E2E-003: GitHub Authentication

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-003 |
| **Description** | Verify GitHub App credentials work |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
kubectl exec -n claude-agent deploy/claude-code-agent -- bash -c '
  ls -la /secrets/github/
  cat /secrets/github/app-id
  # Verify private key exists
  test -f /secrets/github/private-key.pem && echo "Private key found"
'
```

**Pass Criteria:**
- `app-id` file exists and contains valid ID
- `private-key.pem` file exists
- Files mounted via CSI driver (not stale)

#### TEST-E2E-004: Azure Workload Identity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-004 |
| **Description** | Verify Azure Workload Identity authentication |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
kubectl exec -n claude-agent deploy/claude-code-agent -- bash -c '
  az login --identity --allow-no-subscriptions
  az storage container list --account-name iiusagentstore --auth-mode login -o table
'
```

**Pass Criteria:**
- Azure login succeeds without explicit credentials
- Can list storage containers

### 5.2 Full System E2E Tests

#### TEST-E2E-005: n8n to Claude Agent Flow

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-005 |
| **Description** | Verify complete n8n → Claude Agent → Response |
| **Priority** | Critical |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Trigger via n8n webhook (real mode)
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say E2E test successful",
    "mock": false,
    "timeout": 60000
  }'
```

**Pass Criteria:**
- Response status 200
- `success: true` in response body
- `exitCode: 0`
- Output contains expected text

#### TEST-E2E-006: n8n Mock Mode

| Field | Value |
|-------|-------|
| **Test ID** | TEST-E2E-006 |
| **Description** | Verify n8n workflow mock mode functions correctly |
| **Priority** | Medium |
| **Frequency** | On demand |

**Procedure:**
```powershell
# Trigger via n8n webhook (mock mode)
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "mock": true,
    "mockExitCode": 0
  }'
```

**Pass Criteria:**
- Response without calling real Claude CLI
- Mock exit code handled correctly

---

## 6. n8n Workflow Tests

### 6.1 Workflow Structure Validation

#### TEST-N8N-001: Workflow Configuration

| Field | Value |
|-------|-------|
| **Test ID** | TEST-N8N-001 |
| **Description** | Verify workflow node configuration |
| **Priority** | High |
| **Frequency** | After workflow changes |

**Procedure:**
```powershell
# Get workflow structure via MCP
# Verify node count (expected: 17)
# Verify connections
```

**Expected Nodes:**
| Node | Type | Purpose |
|------|------|---------|
| Agent Run Webhook | webhook | Entry point |
| Set Parameters | set | Initialize variables |
| Mock or Real | switch | Route to mock/real path |
| Mock Exit Code | code | Generate mock response |
| Run Claude Agent | httpRequest | Call Claude agent service |
| Parse Exit Code | code | Extract exit code from response |
| Handle Exit Code | switch | Route by exit code (0/23/57/other) |
| Success Response | respondToWebhook | Return success |
| Check Retry Limit | code | Check retry count |
| Retry or Fail | switch | Route retry/fail |
| Wait Before Retry | wait | Exponential backoff |
| Increment Retry | set | Increment counter |
| Max Retries Response | respondToWebhook | Return max retries error |
| Teams Auth Alert | httpRequest | Send auth failure alert |
| Auth Fail Response | respondToWebhook | Return auth failure |
| Teams Error Alert | httpRequest | Send error alert |
| Error Response | respondToWebhook | Return generic error |

### 6.2 Exit Code Routing Tests

#### TEST-N8N-002: Exit Code 0 (Success)

| Field | Value |
|-------|-------|
| **Test ID** | TEST-N8N-002 |
| **Description** | Verify success path routing |
| **Priority** | Critical |

**Procedure:**
```powershell
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -d '{"prompt": "test", "mock": true, "mockExitCode": 0}'
```

**Pass Criteria:**
- Routes to "Success Response"
- Returns `success: true`

#### TEST-N8N-003: Exit Code 23 (Lease Held)

| Field | Value |
|-------|-------|
| **Test ID** | TEST-N8N-003 |
| **Description** | Verify retry logic for lease conflicts |
| **Priority** | High |

**Procedure:**
```powershell
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -d '{"prompt": "test", "mock": true, "mockExitCode": 23}'
```

**Pass Criteria:**
- Routes to "Check Retry Limit"
- Waits with backoff
- Retries up to max limit
- Returns "Max Retries" error after limit

#### TEST-N8N-004: Exit Code 57 (Auth Failure)

| Field | Value |
|-------|-------|
| **Test ID** | TEST-N8N-004 |
| **Description** | Verify auth failure handling |
| **Priority** | Critical |

**Procedure:**
```powershell
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -d '{"prompt": "test", "mock": true, "mockExitCode": 57}'
```

**Pass Criteria:**
- Routes to "Teams Auth Alert"
- Sends Teams notification
- Returns `error: "Authentication failed"`

#### TEST-N8N-005: Exit Code Other (Generic Error)

| Field | Value |
|-------|-------|
| **Test ID** | TEST-N8N-005 |
| **Description** | Verify generic error handling |
| **Priority** | High |

**Procedure:**
```powershell
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -d '{"prompt": "test", "mock": true, "mockExitCode": 1}'
```

**Pass Criteria:**
- Routes to "Teams Error Alert"
- Sends Teams notification
- Returns `error` with details

---

## 7. Authentication Tests

### 7.1 Claude Session Token Tests

#### TEST-AUTH-001: Token Validity Check

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AUTH-001 |
| **Description** | Verify CronJob detects expired tokens |
| **Priority** | Critical |
| **Frequency** | Every 30 minutes (CronJob) |

**Procedure:**
```powershell
# Check CronJob status
kubectl get cronjobs -n claude-agent
kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp

# Check most recent job logs
kubectl logs -n claude-agent job/claude-auth-watchdog-<timestamp>
```

**Pass Criteria:**
- CronJob runs on schedule (*/30 * * * *)
- Job exits 0 when tokens valid
- Job exits 57 when tokens expired
- Teams notification sent on failure

#### TEST-AUTH-002: Token Refresh Procedure

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AUTH-002 |
| **Description** | Verify token refresh procedure works |
| **Priority** | High |
| **Frequency** | After each refresh |

**Procedure:**
```powershell
# On local machine
claude logout
claude login
# Complete OAuth

# Update K8s secret
kubectl delete secret claude-session -n claude-agent
kubectl create secret generic claude-session -n claude-agent --from-file=$HOME/.claude/

# Restart deployment
kubectl rollout restart deployment/claude-code-agent -n claude-agent
kubectl rollout status deployment/claude-code-agent -n claude-agent

# Verify
kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "auth test"
```

**Pass Criteria:**
- Secret updated successfully
- Pod restarts without errors
- Claude CLI responds with exit 0

### 7.2 GitHub App Authentication Tests

#### TEST-AUTH-003: CSI Secret Mount

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AUTH-003 |
| **Description** | Verify GitHub secrets mounted via CSI |
| **Priority** | High |
| **Frequency** | After pod restart |

**Procedure:**
```powershell
# Verify SecretProviderClass exists
kubectl get secretproviderclass -n claude-agent

# Verify secrets mounted
kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /secrets/github/
```

**Pass Criteria:**
- SecretProviderClass `github-app-akv` exists
- `app-id` and `private-key.pem` files present
- Files have correct permissions

---

## 8. Kubernetes Component Tests

### 8.1 Deployment Tests

#### TEST-K8S-001: Pod Security Context

| Field | Value |
|-------|-------|
| **Test ID** | TEST-K8S-001 |
| **Description** | Verify pod runs with required security settings |
| **Priority** | High |
| **Frequency** | After deployment changes |

**Procedure:**
```powershell
kubectl get pod -n claude-agent -l app=claude-code-agent -o yaml | Select-String -Pattern "securityContext" -Context 0,10
```

**Expected Security Context:**
| Setting | Value |
|---------|-------|
| runAsNonRoot | true |
| runAsUser | 1001 |
| runAsGroup | 1001 |
| fsGroup | 1001 |
| seccompProfile.type | RuntimeDefault |
| allowPrivilegeEscalation | false |
| readOnlyRootFilesystem | true |
| capabilities.drop | ["ALL"] |

#### TEST-K8S-002: Resource Limits

| Field | Value |
|-------|-------|
| **Test ID** | TEST-K8S-002 |
| **Description** | Verify resource requests and limits |
| **Priority** | Medium |

**Expected Resources:**
| Container | CPU Request | Memory Request | Memory Limit |
|-----------|-------------|----------------|--------------|
| init-container | 10m | 16Mi | 64Mi |
| claude-agent | 100m | 256Mi | 1Gi |

#### TEST-K8S-003: Probes

| Field | Value |
|-------|-------|
| **Test ID** | TEST-K8S-003 |
| **Description** | Verify liveness and readiness probes |
| **Priority** | High |

**Expected Probes:**
| Probe | Path | Port | Initial Delay | Period |
|-------|------|------|---------------|--------|
| Liveness | /health | 3000 | 10s | 30s |
| Readiness | /health | 3000 | 5s | 10s |

### 8.2 CronJob Tests

#### TEST-K8S-004: Auth Watchdog CronJob

| Field | Value |
|-------|-------|
| **Test ID** | TEST-K8S-004 |
| **Description** | Verify watchdog CronJob configuration |
| **Priority** | High |

**Procedure:**
```powershell
kubectl get cronjob claude-auth-watchdog -n claude-agent -o yaml
```

**Expected Configuration:**
| Setting | Value |
|---------|-------|
| schedule | */30 * * * * |
| concurrencyPolicy | Forbid |
| startingDeadlineSeconds | 300 |
| successfulJobsHistoryLimit | 3 |
| failedJobsHistoryLimit | 3 |
| backoffLimit | 0 |

---

## 9. Network & Security Tests

### 9.1 NetworkPolicy Tests

#### TEST-NET-001: Default Deny Policy

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-001 |
| **Description** | Verify default deny policy blocks unallowed traffic |
| **Priority** | Critical |
| **Frequency** | After policy changes |

**Procedure:**
```powershell
kubectl get networkpolicy -n claude-agent
kubectl describe networkpolicy default-deny-all -n claude-agent
```

**Pass Criteria:**
- `default-deny-all` policy exists
- Blocks all ingress and egress by default

#### TEST-NET-002: DNS Egress Policy

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-002 |
| **Description** | Verify DNS resolution works |
| **Priority** | Critical |

**Procedure:**
```powershell
kubectl exec -n claude-agent deploy/claude-code-agent -- nslookup iiusagentstore.blob.core.windows.net
kubectl exec -n claude-agent deploy/claude-code-agent -- nslookup api.anthropic.com
```

**Pass Criteria:**
- DNS resolution succeeds
- Can resolve Azure and external endpoints

#### TEST-NET-003: Azure Services Egress

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-003 |
| **Description** | Verify egress to Azure services (443) works |
| **Priority** | High |

**Procedure:**
```powershell
kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s -o /dev/null -w "%{http_code}" https://iiusagentstore.blob.core.windows.net
```

**Pass Criteria:**
- HTTPS connections to Azure succeed
- Can access Storage Account and Key Vault

#### TEST-NET-004: n8n Ingress Policy

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-004 |
| **Description** | Verify n8n can reach Claude agent |
| **Priority** | Critical |

**Procedure:**
```powershell
# From n8n pod
kubectl exec -n n8n-prod deploy/n8n -- curl -s http://claude-agent.claude-agent.svc.cluster.local/health
```

**Pass Criteria:**
- n8n can reach Claude agent service
- Health check returns 200

---

## 10. Performance & Load Tests

### 10.1 Response Time Tests

#### TEST-PERF-001: Health Endpoint Latency

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-001 |
| **Description** | Verify health endpoint response time |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Run 100 requests, measure p99
for i in $(seq 1 100); do
  curl -s -o /dev/null -w "%{time_total}\n" http://localhost:3000/health
done | sort -n | tail -1
```

**Pass Criteria:**
- p99 latency < 50ms
- No failures under normal load

#### TEST-PERF-002: Prompt Execution Time

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-002 |
| **Description** | Verify prompt execution completes within timeout |
| **Priority** | Medium |

**Thresholds:**
| Prompt Type | Expected Time | Timeout |
|-------------|---------------|---------|
| Simple (health check) | < 10s | 30s |
| Standard (code review) | < 60s | 120s |
| Complex (multi-file) | < 300s | 600s |

### 10.2 Concurrent Request Tests

#### TEST-PERF-003: Concurrent Health Checks

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-003 |
| **Description** | Verify server handles concurrent health checks |
| **Priority** | Medium |

**Procedure:**
```powershell
# 10 concurrent health checks
seq 1 10 | xargs -P10 -I{} curl -s http://localhost:3000/health
```

**Pass Criteria:**
- All requests return 200
- No connection errors

---

## 11. Failure & Recovery Tests

### 11.1 Pod Failure Tests

#### TEST-FAIL-001: Pod Restart Recovery

| Field | Value |
|-------|-------|
| **Test ID** | TEST-FAIL-001 |
| **Description** | Verify pod recovers after restart |
| **Priority** | High |
| **Frequency** | Monthly |

**Procedure:**
```powershell
# Delete pod (simulates crash)
kubectl delete pod -n claude-agent -l app=claude-code-agent

# Wait for restart
kubectl wait --for=condition=Ready pod -l app=claude-code-agent -n claude-agent --timeout=120s

# Verify health
kubectl exec -n claude-agent deploy/claude-code-agent -- curl localhost:3000/health
```

**Pass Criteria:**
- New pod starts within 60s
- Health check passes after restart
- Init container copies Claude session successfully

#### TEST-FAIL-002: Graceful Shutdown

| Field | Value |
|-------|-------|
| **Test ID** | TEST-FAIL-002 |
| **Description** | Verify graceful shutdown completes in-flight requests |
| **Priority** | High |

**Procedure:**
1. Start long-running prompt request
2. Trigger pod termination
3. Verify request completes or times out gracefully

**Pass Criteria:**
- `preStop` hook gives 10s drain time
- Active requests tracked correctly
- No abrupt termination of in-flight requests

### 11.2 Network Failure Tests

#### TEST-FAIL-003: n8n Network Isolation

| Field | Value |
|-------|-------|
| **Test ID** | TEST-FAIL-003 |
| **Description** | Verify behavior when n8n cannot reach Claude agent |
| **Priority** | High |

**Procedure:**
1. Temporarily remove ingress NetworkPolicy
2. Attempt request from n8n
3. Verify timeout/error handling

**Pass Criteria:**
- n8n workflow handles timeout gracefully
- Appropriate error response returned

### 11.3 Authentication Failure Tests

#### TEST-FAIL-004: Expired Token Handling

| Field | Value |
|-------|-------|
| **Test ID** | TEST-FAIL-004 |
| **Description** | Verify system handles expired Claude tokens |
| **Priority** | Critical |

**Expected Behavior:**
1. Claude CLI returns exit code 57
2. HTTP server returns `{success: false, exitCode: 57, error: "Authentication failed"}`
3. n8n workflow routes to "Teams Auth Alert"
4. Teams notification sent with reauth instructions
5. Workflow returns error to caller

---

## 12. Test Execution

### 12.1 Running Unit Tests

```powershell
# Run all Jest tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/server.test.js
```

### 12.2 Running BATS Tests

```powershell
# Install BATS (if not installed)
npm install -g bats

# Run all BATS tests
bats tests/scripts/

# Run specific test file
bats tests/scripts/check-auth.bats
```

### 12.3 Running E2E Tests

```powershell
# 1. Ensure kubectl configured
az aks get-credentials --resource-group rg_prod --name dev-aks

# 2. Port-forward for local testing
kubectl port-forward -n claude-agent svc/claude-agent 3000:80

# 3. Run E2E health check
curl http://localhost:3000/health

# 4. Run E2E prompt test (via n8n)
curl -X POST "https://n8n.ii-us.com/webhook/agent-run" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "E2E test", "mock": false, "timeout": 60000}'
```

### 12.4 CI/CD Integration

**GitHub Actions Workflow:**
```yaml
name: Multi-Agent Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage

  bats-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bats-core/bats-action@v2
        with:
          path: tests/scripts/

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [unit-tests, bats-tests]
    steps:
      # E2E tests run on main branch only
      - name: Trigger n8n E2E
        run: |
          curl -X POST "${{ secrets.N8N_WEBHOOK_URL }}" \
            -d '{"prompt": "CI E2E test", "mock": true}'
```

### 12.5 Test Schedule

| Test Type | Frequency | Trigger |
|-----------|-----------|---------|
| Unit Tests | On every commit | CI/CD |
| BATS Tests | On every commit | CI/CD |
| Integration Tests | On every commit | CI/CD |
| E2E Tests (mock) | On PR merge | CI/CD |
| E2E Tests (real) | Daily | Scheduled |
| Auth Watchdog | Every 30 min | CronJob |
| Full System E2E | Weekly | Manual |

---

## Appendix A: Test Results Template

```markdown
## Test Execution: [TEST-ID]

**Date:** YYYY-MM-DD
**Executed By:** [Name/CI]
**Environment:** AKS dev-aks

### Results
| Check | Expected | Actual | Pass/Fail |
|-------|----------|--------|-----------|
| [Check 1] | [Expected] | [Actual] | Pass/Fail |

### Evidence
- Logs: [link]
- Screenshots: [link]

### Overall Result: PASS / FAIL

### Follow-up Actions
- [ ] [Action if failed]
```

---

*Document Version: 1.0*
*Last Updated: January 15, 2026*
*Next Review: February 15, 2026*
