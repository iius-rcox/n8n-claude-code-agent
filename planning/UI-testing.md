# Operations Dashboard - UI Manual Testing Guide

This document provides step-by-step instructions for manually testing all functionality of the Operations Dashboard from start to finish.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Deployment](#2-deployment)
3. [Authentication Testing](#3-authentication-testing)
4. [Health Status Overview](#4-health-status-overview)
5. [Manual Agent Execution](#5-manual-agent-execution)
6. [Execution History](#6-execution-history)
7. [CronJob Management](#7-cronjob-management)
8. [Token Refresh Workflow](#8-token-refresh-workflow)
9. [Error Handling](#9-error-handling)
10. [Cleanup](#10-cleanup)

---

## 1. Prerequisites

### Your Environment Configuration

| Setting | Value |
|---------|-------|
| **Azure Tenant ID** | `953922e6-5370-4a01-a3d5-773a30df726b` |
| **Azure Tenant Name** | INSULATIONS, INC |
| **AKS Cluster** | `dev-aks` |
| **Resource Group** | `rg_prod` |
| **ACR Registry** | `iiusacr.azurecr.io` |
| **Ingress IP** | `4.151.29.139` |
| **Ingress Class** | `webapprouting.kubernetes.azure.com` |
| **Domain Pattern** | `*.ii-us.com` |
| **Dashboard URL** | `https://ops-dashboard.ii-us.com` (after deployment) |

### Claude Agent Configuration (Already Deployed)

| Setting | Value |
|---------|-------|
| **Namespace** | `claude-agent` |
| **Service Name** | `claude-agent` |
| **Service URL** | `http://claude-agent.claude-agent.svc.cluster.local:80` |
| **Deployment** | `claude-code-agent` |
| **CronJob** | `claude-auth-watchdog` (every 30 minutes) |

### Required Access
- [ ] Azure AD account in INSULATIONS, INC tenant
- [ ] `kubectl` configured for `dev-aks` cluster
- [ ] Azure CLI logged in (`az login`)
- [ ] PowerShell 7+ (for CLI credential push)

### Verify Current State

```powershell
# Verify AKS connection
az aks get-credentials --resource-group rg_prod --name dev-aks
kubectl get nodes

# Verify Claude Agent is running
kubectl get pods -n claude-agent -l app=claude-code-agent
kubectl get svc -n claude-agent

# Check auth watchdog status
kubectl get cronjob -n claude-agent
kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp | Select-Object -Last 5
```

**Expected State:**
- Claude agent pod: `Running` (1/1)
- Service: `claude-agent` on port 80
- CronJob: `claude-auth-watchdog` (not suspended)

---

## 2. Deployment

### 2.1 Create Azure AD App Registration

```powershell
# Create the app registration
$appName = "ops-dashboard"
$app = az ad app create `
    --display-name $appName `
    --sign-in-audience AzureADMyOrg `
    --web-redirect-uris "https://ops-dashboard.ii-us.com" "http://localhost:5173" `
    --query "{appId:appId, objectId:id}" -o json | ConvertFrom-Json

Write-Host "App ID (Client ID): $($app.appId)"

# Note: You'll need to configure API permissions in Azure Portal:
# - Microsoft Graph > User.Read (delegated)
# - Optionally create an app role for authorization
```

### 2.2 Update ConfigMap with Real Values

Edit `dashboard/infra/k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ops-dashboard-config
  namespace: ops-dashboard
data:
  AZURE_AD_TENANT_ID: "953922e6-5370-4a01-a3d5-773a30df726b"
  AZURE_AD_CLIENT_ID: "<your-app-client-id-from-step-2.1>"
  AZURE_AD_AUTHORIZED_GROUP_ID: "<optional-security-group-id>"
  CLAUDE_AGENT_NAMESPACE: "claude-agent"
  CLAUDE_AGENT_SERVICE_URL: "http://claude-agent.claude-agent.svc.cluster.local:80"
  HEALTH_POLL_INTERVAL_MS: "30000"
```

### 2.3 Build and Push Docker Image

```powershell
cd C:\Users\rcox\n8n-claude-code-agent\dashboard

# Login to ACR
az acr login --name iiusacr

# Build the combined image
docker build -t iiusacr.azurecr.io/ops-dashboard:latest .

# Push to ACR
docker push iiusacr.azurecr.io/ops-dashboard:latest

# Verify push
az acr repository show-tags --name iiusacr --repository ops-dashboard
```

### 2.4 Deploy to Kubernetes

```powershell
cd C:\Users\rcox\n8n-claude-code-agent\dashboard\infra\k8s

# Create namespace and RBAC
kubectl apply -f namespace.yaml
kubectl apply -f serviceaccount.yaml
kubectl apply -f rbac.yaml

# Apply config and deploy
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f networkpolicy.yaml
```

### 2.5 Verify Deployment

```powershell
# Check pod status
kubectl get pods -n ops-dashboard -w

# Check logs (wait for pod to be Running)
kubectl logs -n ops-dashboard -l app=ops-dashboard -c backend --tail=50
kubectl logs -n ops-dashboard -l app=ops-dashboard -c frontend --tail=50

# Verify ingress
kubectl get ingress -n ops-dashboard

# Test internal connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n ops-dashboard -- curl -s http://ops-dashboard:3000/api/health
```

**Expected Result:**
- Pod: `ops-dashboard-xxx` Running with 2/2 containers ready
- Ingress: `ops-dashboard` with host `ops-dashboard.ii-us.com` and IP `4.151.29.139`

### 2.6 DNS Configuration (if needed)

If `ops-dashboard.ii-us.com` doesn't resolve, add DNS record:
- **Type**: A
- **Name**: ops-dashboard
- **Value**: 4.151.29.139
- **TTL**: 300

---

## 3. Authentication Testing

### 3.1 Initial Page Load (Unauthenticated)
1. Open browser to `https://ops-dashboard.ii-us.com`
2. **Expected**: Login screen with "Sign in with Microsoft" button
3. **Expected**: No dashboard content visible

### 3.2 Azure AD Login Flow
1. Click "Sign in with Microsoft"
2. **Expected**: Redirect to Microsoft login page for INSULATIONS, INC tenant
3. Enter your Azure AD credentials (e.g., `rcox@insulationsinc.com`)
4. **Expected**: Consent prompt (first time only)
5. Accept consent
6. **Expected**: Redirect back to dashboard with full content visible

### 3.3 Verify Authenticated State
1. **Expected**: User avatar/name displayed in header
2. **Expected**: All dashboard panels load (Health, Executor, History, CronJob)
3. Open browser DevTools (F12) → Network tab
4. **Expected**: All `/api/*` calls return 200 with `Authorization: Bearer ...` header

### 3.4 Sign Out Flow
1. Click user menu/avatar
2. Click "Sign Out"
3. **Expected**: Redirect to login screen
4. **Expected**: API calls fail with 401 if attempted

### 3.5 Token Refresh (Silent)
1. Stay logged in for 5+ minutes
2. **Expected**: Dashboard continues working without re-login
3. Check Network tab - `acquireTokenSilent` calls should succeed

| Test | Status | Notes |
|------|--------|-------|
| 3.1 Unauthenticated view | ☐ | |
| 3.2 Login flow | ☐ | |
| 3.3 Authenticated state | ☐ | |
| 3.4 Sign out | ☐ | |
| 3.5 Silent token refresh | ☐ | |

---

## 4. Health Status Overview

### 4.1 Overall Health Status
1. Locate the "System Health" panel
2. **Expected**: Overall status badge shows one of: `healthy`, `degraded`, `unhealthy`
3. **Expected**: Color coding: green (healthy), yellow (degraded), red (unhealthy)

### 4.2 Component Health Cards
Check for individual cards showing:
- **Pod status**: `claude-code-agent-xxx` (Running/Pending/Failed)
- **Service status**: `claude-agent` (healthy/unhealthy)
- **Auth status**: authenticated/unauthenticated
- **CronJob status**: `claude-auth-watchdog` (Active/Suspended)

### 4.3 Pod Details
1. Check pod section for details:
   - Pod name: `claude-code-agent-65867b5b7c-xxxxx`
   - Phase: Running
   - Ready containers: 1/1
   - Restart count
   - Last restart time (if any)

### 4.4 Auto-Refresh
1. Note the current timestamp on health panel
2. Wait 30 seconds (configured poll interval)
3. **Expected**: Timestamp updates, data refreshes automatically
4. Test manual change:
   ```powershell
   # Scale down and back up to trigger health change
   kubectl scale deployment claude-code-agent -n claude-agent --replicas=0
   # Wait 30s, observe "unhealthy" in dashboard
   kubectl scale deployment claude-code-agent -n claude-agent --replicas=1
   # Wait 30s, observe "healthy" restored
   ```

### 4.5 Manual Refresh
1. Click the refresh icon button on the health panel
2. **Expected**: Loading spinner appears briefly
3. **Expected**: Data updates immediately

| Test | Status | Notes |
|------|--------|-------|
| 4.1 Overall health status | ☐ | |
| 4.2 Component cards | ☐ | |
| 4.3 Pod details | ☐ | |
| 4.4 Auto-refresh (30s) | ☐ | |
| 4.5 Manual refresh | ☐ | |

---

## 5. Manual Agent Execution

### 5.1 Executor Panel Layout
1. Locate "Agent Executor" panel
2. **Expected**: Text area for prompt input
3. **Expected**: Character counter (shows current/max, e.g., "0/10000")
4. **Expected**: "Execute" button (disabled when empty)

### 5.2 Simple Prompt Execution
1. Enter a simple prompt: `What is 2 + 2?`
2. **Expected**: Character counter updates to "14/10000"
3. **Expected**: Execute button becomes enabled
4. Click "Execute"
5. **Expected**: Loading state (spinner, button disabled)
6. **Expected**: Result appears within 30-60 seconds
7. **Expected**: Output shows Claude's response (e.g., "4" or explanation)

### 5.3 Longer Prompt Execution
1. Enter a longer prompt:
   ```
   Please write a short poem about kubernetes pods,
   including references to containers, deployments, and services.
   Make it exactly 4 lines.
   ```
2. Execute the prompt
3. **Expected**: Response contains multi-line output
4. **Expected**: Response is properly formatted/displayed

### 5.4 Execution Results Display
1. After successful execution:
   - **Expected**: Status badge shows "success" (green)
   - **Expected**: Duration displayed (e.g., "2.3s")
   - **Expected**: Output text is scrollable if long
   - **Expected**: Exit code shown (0 for success)

### 5.5 Input Validation
1. Try to submit empty prompt
   - **Expected**: Execute button disabled
2. Try to submit whitespace-only prompt
   - **Expected**: Execute button disabled or validation error
3. Enter maximum length prompt (10000 chars)
   - **Expected**: Counter shows "10000/10000"
   - **Expected**: Execution still works

| Test | Status | Notes |
|------|--------|-------|
| 5.1 Panel layout | ☐ | |
| 5.2 Simple prompt | ☐ | |
| 5.3 Longer prompt | ☐ | |
| 5.4 Results display | ☐ | |
| 5.5 Input validation | ☐ | |

---

## 6. Execution History

### 6.1 History Panel Layout
1. Locate "Execution History" panel
2. **Expected**: Table with columns: ID, Prompt, Status, Started, Duration
3. **Expected**: Filter dropdown (All, Success, Error, Running, etc.)
4. **Expected**: Refresh button

### 6.2 History Population
1. Execute 3-5 different prompts from Section 5
2. **Expected**: Each execution appears in history table
3. **Expected**: Most recent executions at top
4. **Expected**: Prompt text truncated if too long (with "...")

### 6.3 Status Filtering
1. Click status filter dropdown
2. Select "Success"
   - **Expected**: Only successful executions shown
3. Select "Error" (if any errors exist)
   - **Expected**: Only failed executions shown
4. Select "All"
   - **Expected**: All executions shown

### 6.4 Execution Details Dialog
1. Click on a row in the history table
2. **Expected**: Dialog/modal opens with full details:
   - Full prompt text (not truncated)
   - Full output text
   - Status with colored badge
   - Exit code
   - Start time (full timestamp)
   - End time
   - Duration
3. Click close/X button or outside dialog
4. **Expected**: Dialog closes, table still visible

### 6.5 Error Execution Details
1. Force an error by temporarily breaking auth:
   ```powershell
   # Temporarily delete the secret (CAUTION: backup first)
   kubectl get secret claude-session -n claude-agent -o yaml > /tmp/secret-backup.yaml
   kubectl delete secret claude-session -n claude-agent
   ```
2. Execute a prompt (will fail)
3. View the error execution details
4. **Expected**: Error message displayed
5. **Expected**: Status shows "error" or "auth_failure"
6. Restore the secret:
   ```powershell
   kubectl apply -f /tmp/secret-backup.yaml
   ```

### 6.6 History Limit (50 records)
1. Check that oldest executions are removed when limit exceeded
2. **Expected**: Always shows max 50 most recent

| Test | Status | Notes |
|------|--------|-------|
| 6.1 Panel layout | ☐ | |
| 6.2 History population | ☐ | |
| 6.3 Status filtering | ☐ | |
| 6.4 Details dialog | ☐ | |
| 6.5 Error details | ☐ | |
| 6.6 History limit | ☐ | |

---

## 7. CronJob Management

### 7.1 CronJob Panel Layout
1. Locate "Auth Watchdog CronJob" panel
2. **Expected**: Shows:
   - Schedule: `*/30 * * * *` (every 30 minutes)
   - Status badge: Active (green) or Suspended (red)
   - Last Scheduled time
   - Last Success time
   - "Run Now" button
   - Refresh button

### 7.2 Recent Runs Table

Check current job status first:
```powershell
kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp | Select-Object -Last 10
```

**Expected in UI**: Table showing recent CronJob runs:
- Job name (e.g., `claude-auth-watchdog-29476590`)
- Started timestamp
- Status (succeeded/failed/running)
- Duration

**Note**: Recent jobs may show "Error" status if Claude auth has expired.

### 7.3 Manual CronJob Trigger
1. Click "Run Now" button
2. **Expected**: Confirmation dialog appears:
   - Title: "Confirm Manual Run"
   - Description explaining what will happen
   - Cancel and Run Now buttons
3. Click "Cancel"
   - **Expected**: Dialog closes, nothing happens
4. Click "Run Now" again, then confirm
5. **Expected**: Loading spinner on button
6. **Expected**: Success message appears (or error if auth is broken)
7. **Expected**: New job appears in recent runs table
8. Verify in kubectl:
   ```powershell
   kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp | Select-Object -Last 3
   ```

### 7.4 CronJob Run Details
1. Observe a completed job in the recent runs
2. **Expected**: Duration shown (e.g., "12s", "45s")
3. **Expected**: Status badge colored appropriately (green=succeeded, red=failed)

### 7.5 Failed Job Display
1. Check for failed jobs (currently auth watchdog is failing):
   ```powershell
   kubectl get pods -n claude-agent -l job-name --field-selector=status.phase=Failed
   ```
2. **Expected in UI**: Red X icon and "failed" badge
3. **Expected**: Exit code shown if available

### 7.6 Auto-Refresh
1. Wait for next scheduled CronJob run (every 30 minutes)
2. **Expected**: New run appears automatically in table
3. **Expected**: Last Scheduled/Success times update

| Test | Status | Notes |
|------|--------|-------|
| 7.1 Panel layout | ☐ | |
| 7.2 Recent runs table | ☐ | |
| 7.3 Manual trigger | ☐ | |
| 7.4 Run details | ☐ | |
| 7.5 Failed job display | ☐ | |
| 7.6 Auto-refresh | ☐ | |

---

## 8. Token Refresh Workflow

### 8.1 Preparation
Ensure you have valid Claude credentials locally:
```powershell
# Check local credentials exist
Test-Path "$env:USERPROFILE\.claude\credentials.json"
Test-Path "$env:USERPROFILE\.claude\settings.json"

# View credentials (careful with sensitive data)
Get-Content "$env:USERPROFILE\.claude\credentials.json" | ConvertFrom-Json | Select-Object -Property *
```

### 8.2 Initiate Token Refresh
1. Locate "Token Refresh" or "Credentials" section in dashboard
2. Click "Refresh Token" or "Update Credentials" button
3. **Expected**: New operation created
4. **Expected**: CLI command displayed:
   ```powershell
   .\push-credentials.ps1 -DashboardUrl "https://ops-dashboard.ii-us.com" -SessionToken "abc123..."
   ```
5. **Expected**: Status shows "Waiting for credentials"

### 8.3 Copy CLI Command
1. Click copy button next to CLI command
2. **Expected**: Command copied to clipboard
3. Paste in terminal to verify format

### 8.4 Run CLI Push Script
```powershell
cd C:\Users\rcox\n8n-claude-code-agent\dashboard\cli

# Run the copied command (paste from clipboard)
.\push-credentials.ps1 -DashboardUrl "https://ops-dashboard.ii-us.com" -SessionToken "<token-from-ui>"
```

**Expected output:**
```
Reading credentials from C:\Users\rcox\.claude\credentials.json
Reading settings from C:\Users\rcox\.claude\settings.json
Pushing credentials to dashboard...
Success! Credentials pushed successfully.
```

### 8.5 Monitor Refresh Progress
1. Return to dashboard UI
2. **Expected**: Progress steps update in real-time:
   - ✓ Credentials received
   - ⟳ Deleting old secret...
   - ✓ Old secret deleted
   - ⟳ Creating new secret...
   - ✓ New secret created
   - ⟳ Restarting deployment...
   - ✓ Deployment restarted
   - ⟳ Verifying authentication...
   - ✓ Authentication verified
   - ✓ Complete

### 8.6 Verify Refresh Success
1. **Expected**: Final status shows "Completed"
2. **Expected**: Health panel shows "authenticated"
3. Test agent execution to confirm working:
   - Execute a simple prompt
   - **Expected**: Success response

### 8.7 Verify in Kubernetes
```powershell
# Check secret was updated
kubectl get secret claude-session -n claude-agent -o jsonpath='{.metadata.creationTimestamp}'

# Check deployment was restarted
kubectl get pods -n claude-agent -l app=claude-code-agent -o jsonpath='{.items[0].metadata.creationTimestamp}'

# Verify auth works
kubectl exec -n claude-agent deploy/claude-code-agent -- claude --version
```

### 8.8 Refresh Failure Handling
1. Trigger refresh but provide invalid credentials (modify script locally)
2. **Expected**: Failed step highlighted in red
3. **Expected**: Error message displayed
4. **Expected**: Remediation suggestion shown

### 8.9 Operation Timeout
1. Start refresh but don't complete CLI step
2. Wait 10 minutes
3. **Expected**: Operation times out
4. **Expected**: Can start new operation

| Test | Status | Notes |
|------|--------|-------|
| 8.1 Preparation | ☐ | |
| 8.2 Initiate refresh | ☐ | |
| 8.3 Copy CLI command | ☐ | |
| 8.4 Run CLI script | ☐ | |
| 8.5 Monitor progress | ☐ | |
| 8.6 Verify success | ☐ | |
| 8.7 Verify in K8s | ☐ | |
| 8.8 Failure handling | ☐ | |
| 8.9 Operation timeout | ☐ | |

---

## 9. Error Handling

### 9.1 Backend Unavailable
```powershell
# Scale dashboard to 0
kubectl scale deployment ops-dashboard -n ops-dashboard --replicas=0

# Try any action in browser
# Expected: User-friendly error message, no crash

# Restore
kubectl scale deployment ops-dashboard -n ops-dashboard --replicas=1
```

### 9.2 Network Errors
1. Open DevTools → Network → Throttling → Offline
2. Try any action
3. **Expected**: Error indication on failed requests
4. **Expected**: Dashboard remains usable
5. Set throttling back to "No throttling"
6. **Expected**: Auto-recovery on next action

### 9.3 Authentication Expiry
1. Clear MSAL cache in browser:
   - DevTools → Application → Storage → Clear site data
2. Refresh page
3. **Expected**: Redirect to login screen

### 9.4 Claude Agent Unavailable
```powershell
# Scale Claude agent to 0
kubectl scale deployment claude-code-agent -n claude-agent --replicas=0

# Wait for pod termination
kubectl get pods -n claude-agent -w

# Try to execute a prompt in dashboard
# Expected: Error status with clear message
# Expected: Health panel shows agent unhealthy

# Restore
kubectl scale deployment claude-code-agent -n claude-agent --replicas=1
```

### 9.5 Invalid Input Handling
1. Try various inputs in prompt field:
   - SQL injection: `'; DROP TABLE users; --`
   - XSS attempt: `<script>alert('xss')</script>`
   - Very long input (paste 10000+ chars)
2. **Expected**: Inputs are sanitized/escaped
3. **Expected**: No security vulnerabilities (check response doesn't execute scripts)

| Test | Status | Notes |
|------|--------|-------|
| 9.1 Backend unavailable | ☐ | |
| 9.2 Network errors | ☐ | |
| 9.3 Auth expiry | ☐ | |
| 9.4 Agent unavailable | ☐ | |
| 9.5 Invalid input | ☐ | |

---

## 10. Cleanup

### 10.1 Clear Execution History
Execution history is in-memory; restart clears it:
```powershell
kubectl rollout restart deployment/ops-dashboard -n ops-dashboard
```

### 10.2 Clean Up Test Jobs
```powershell
# Delete completed/failed jobs
kubectl delete jobs -n claude-agent --field-selector=status.successful=1
kubectl delete jobs -n claude-agent --field-selector=status.failed=1
```

### 10.3 Remove Dashboard Deployment (if needed)
```powershell
cd C:\Users\rcox\n8n-claude-code-agent\dashboard\infra\k8s
kubectl delete -f .
```

### 10.4 Remove Azure AD App Registration (if needed)
```powershell
$appId = "<your-app-client-id>"
az ad app delete --id $appId
```

---

## Quick Reference Commands

```powershell
# Dashboard logs
kubectl logs -n ops-dashboard -l app=ops-dashboard -c backend -f
kubectl logs -n ops-dashboard -l app=ops-dashboard -c frontend -f

# Claude agent logs
kubectl logs -n claude-agent -l app=claude-code-agent -f

# CronJob logs (latest job)
$latestJob = kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}'
kubectl logs -n claude-agent job/$latestJob

# Restart deployments
kubectl rollout restart deployment/ops-dashboard -n ops-dashboard
kubectl rollout restart deployment/claude-code-agent -n claude-agent

# Port forward for local testing
kubectl port-forward -n ops-dashboard svc/ops-dashboard 3000:3000
```

---

## Test Summary

| Section | Total Tests | Passed | Failed | Blocked |
|---------|-------------|--------|--------|---------|
| 3. Authentication | 5 | | | |
| 4. Health Status | 5 | | | |
| 5. Agent Execution | 5 | | | |
| 6. Execution History | 6 | | | |
| 7. CronJob Management | 6 | | | |
| 8. Token Refresh | 9 | | | |
| 9. Error Handling | 5 | | | |
| **TOTAL** | **41** | | | |

---

## Notes

**Tester Name**: _________________

**Date**: _________________

**Dashboard Version**: _________________

**Browser/Version**: _________________

**Current Auth Status**: ☐ Working ☐ Expired (CronJob errors indicate expired auth)

**Additional Observations**:

```




```
