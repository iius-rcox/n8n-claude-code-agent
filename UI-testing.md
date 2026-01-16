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

### Required Access
- [ ] Azure AD account with permissions to the configured tenant
- [ ] `kubectl` configured with access to the AKS cluster (`dev-aks`)
- [ ] Azure CLI logged in (`az login`)
- [ ] PowerShell 7+ (for CLI credential push)

### Environment Configuration
Ensure these environment variables are set in your deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_ID` | App registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `CLAUDE_AGENT_SERVICE` | Claude agent K8s service name | `claude-agent` |
| `CLAUDE_AGENT_NAMESPACE` | Namespace for Claude agent | `default` |

### Verify Claude Agent is Running
```powershell
kubectl get pods -l app=claude-agent -n default
kubectl get svc claude-agent -n default
```

---

## 2. Deployment

### 2.1 Build and Push Docker Image
```powershell
cd dashboard

# Build the combined image
docker build -t iiusacr.azurecr.io/ops-dashboard:latest .

# Push to ACR
az acr login --name iiusacr
docker push iiusacr.azurecr.io/ops-dashboard:latest
```

### 2.2 Deploy to Kubernetes
```powershell
# Update ConfigMap with your Azure AD values
kubectl apply -f infra/k8s/configmap.yaml

# Deploy all resources
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/serviceaccount.yaml
kubectl apply -f infra/k8s/rbac.yaml
kubectl apply -f infra/k8s/deployment.yaml
kubectl apply -f infra/k8s/service.yaml
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/networkpolicy.yaml
```

### 2.3 Verify Deployment
```powershell
# Check pod status
kubectl get pods -l app=ops-dashboard -n ops-dashboard

# Check logs
kubectl logs -l app=ops-dashboard -n ops-dashboard -c backend
kubectl logs -l app=ops-dashboard -n ops-dashboard -c frontend

# Get ingress URL
kubectl get ingress -n ops-dashboard
```

**Expected Result**: Pod is Running with 2/2 containers ready.

---

## 3. Authentication Testing

### 3.1 Initial Page Load (Unauthenticated)
1. Open browser to dashboard URL (e.g., `https://ops-dashboard.your-domain.com`)
2. **Expected**: Login screen with "Sign in with Microsoft" button
3. **Expected**: No dashboard content visible

### 3.2 Azure AD Login Flow
1. Click "Sign in with Microsoft"
2. **Expected**: Redirect to Microsoft login page
3. Enter your Azure AD credentials
4. **Expected**: Consent prompt (first time only)
5. Accept consent
6. **Expected**: Redirect back to dashboard with full content visible

### 3.3 Verify Authenticated State
1. **Expected**: User avatar/name displayed in header
2. **Expected**: All dashboard panels load (Health, Executor, History, CronJob)
3. Check browser DevTools Network tab - all `/api/*` calls should return 200

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
1. **Expected**: Individual cards for:
   - Pod status (Running/Pending/Failed)
   - Service status (healthy/unhealthy)
   - Auth status (authenticated/unauthenticated)
   - CronJob status (Active/Suspended)

### 4.3 Pod Details
1. Click on a pod card (if expandable) or check pod section
2. **Expected**: Shows:
   - Pod name
   - Phase (Running, Pending, etc.)
   - Ready containers (e.g., "1/1")
   - Restart count
   - Last restart time (if any)

### 4.4 Auto-Refresh
1. Note the current timestamp on health panel
2. Wait 30 seconds (default poll interval)
3. **Expected**: Timestamp updates, data refreshes automatically
4. Make a change in K8s (e.g., scale deployment) and observe update

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
7. **Expected**: Output shows Claude's response

### 5.3 Longer Prompt Execution
1. Enter a longer prompt (100+ characters):
   ```
   Please write a short poem about kubernetes pods,
   including references to containers, deployments, and services.
   ```
2. Execute the prompt
3. **Expected**: Response contains multi-line output
4. **Expected**: Response is properly formatted/displayed

### 5.4 Execution Results Display
1. After successful execution:
   - **Expected**: Status badge shows "success"
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
4. **Expected**: Prompt text truncated if too long

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
   - Full prompt text
   - Full output text
   - Status with colored badge
   - Exit code
   - Start time (full timestamp)
   - End time
   - Duration
3. Click close/X button
4. **Expected**: Dialog closes, table still visible

### 6.5 Error Execution Details
1. If an execution failed (or force one by disconnecting Claude agent):
2. View the error execution details
3. **Expected**: Error message displayed
4. **Expected**: Status shows "error" or "auth_failure"
5. **Expected**: Appropriate error details shown

### 6.6 History Limit (50 records)
1. Execute 50+ prompts (or check code behavior)
2. **Expected**: Oldest executions are removed when limit exceeded
3. **Expected**: Always shows max 50 most recent

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
   - Schedule (cron expression, e.g., "*/15 * * * *")
   - Status badge (Active/Suspended)
   - Last Scheduled time
   - Last Success time
   - "Run Now" button
   - Refresh button

### 7.2 Recent Runs Table
1. **Expected**: Table showing recent CronJob runs:
   - Job name
   - Started timestamp
   - Status (succeeded/failed/running)
   - Duration
2. **Expected**: Status icons (checkmark for success, X for failure)

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
6. **Expected**: Success message appears
7. **Expected**: New job appears in recent runs table
8. **Expected**: Job status updates as it runs/completes

### 7.4 CronJob Run Details
1. Observe a completed job in the recent runs
2. **Expected**: Duration shown (e.g., "45s")
3. **Expected**: Status badge colored appropriately

### 7.5 Failed Job Display
1. If a CronJob has failed (or check historical failures):
2. **Expected**: Red X icon and "failed" badge
3. **Expected**: Exit code shown if available

### 7.6 Auto-Refresh
1. Wait for scheduled CronJob run (based on schedule)
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

### 8.1 Initiate Token Refresh
1. Locate "Token Refresh" or "Credentials" section
2. Click "Refresh Token" or "Update Credentials" button
3. **Expected**: New operation created
4. **Expected**: CLI command displayed:
   ```powershell
   .\push-credentials.ps1 -DashboardUrl "https://..." -SessionToken "..."
   ```
5. **Expected**: Status shows "Waiting for credentials"

### 8.2 Copy CLI Command
1. Click copy button next to CLI command
2. **Expected**: Command copied to clipboard
3. Paste in terminal to verify

### 8.3 Run CLI Push Script
1. Open PowerShell terminal
2. Navigate to `dashboard/cli/` directory
3. Ensure Claude CLI credentials exist at:
   - `~/.claude/credentials.json`
   - `~/.claude/settings.json`
4. Run the copied command:
   ```powershell
   .\push-credentials.ps1 -DashboardUrl "https://ops-dashboard.your-domain.com" -SessionToken "abc123..."
   ```
5. **Expected**: Script reads local credentials
6. **Expected**: Script POSTs to dashboard API
7. **Expected**: Success message in terminal

### 8.4 Monitor Refresh Progress
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

### 8.5 Verify Refresh Success
1. **Expected**: Final status shows "Completed"
2. **Expected**: Health panel shows "authenticated"
3. Test agent execution to confirm working

### 8.6 Refresh Failure Handling
1. Trigger refresh with invalid credentials (or simulate failure)
2. **Expected**: Failed step highlighted in red
3. **Expected**: Error message displayed
4. **Expected**: Remediation suggestion shown

### 8.7 Operation Timeout
1. Start refresh but don't complete CLI step
2. Wait 10 minutes
3. **Expected**: Operation times out
4. **Expected**: Can start new operation

| Test | Status | Notes |
|------|--------|-------|
| 8.1 Initiate refresh | ☐ | |
| 8.2 Copy CLI command | ☐ | |
| 8.3 Run CLI script | ☐ | |
| 8.4 Monitor progress | ☐ | |
| 8.5 Verify success | ☐ | |
| 8.6 Failure handling | ☐ | |
| 8.7 Operation timeout | ☐ | |

---

## 9. Error Handling

### 9.1 API Errors
1. Disconnect backend (scale to 0 replicas)
2. Try any action (refresh, execute, etc.)
3. **Expected**: User-friendly error message displayed
4. **Expected**: No crash or white screen
5. Scale backend back up and verify recovery

### 9.2 Network Errors
1. Disconnect from network (or use DevTools to simulate offline)
2. **Expected**: Error indication on failed requests
3. **Expected**: Dashboard remains usable
4. Reconnect and verify auto-recovery

### 9.3 Authentication Expiry
1. Wait for Azure AD token to expire (or manually clear)
2. Try an API call
3. **Expected**: Silent token refresh attempted
4. If silent fails: **Expected**: Redirect to login

### 9.4 Claude Agent Unavailable
1. Scale Claude agent deployment to 0
2. Try to execute a prompt
3. **Expected**: Error status with clear message
4. **Expected**: Health panel shows agent unhealthy
5. Scale back up and verify recovery

### 9.5 Invalid Input Handling
1. Try various invalid inputs:
   - SQL injection in prompt: `'; DROP TABLE users; --`
   - XSS in prompt: `<script>alert('xss')</script>`
   - Very long input (beyond limit)
2. **Expected**: Inputs are sanitized/escaped
3. **Expected**: No security vulnerabilities

| Test | Status | Notes |
|------|--------|-------|
| 9.1 API errors | ☐ | |
| 9.2 Network errors | ☐ | |
| 9.3 Auth expiry | ☐ | |
| 9.4 Agent unavailable | ☐ | |
| 9.5 Invalid input | ☐ | |

---

## 10. Cleanup

### 10.1 Remove Test Data
```powershell
# Execution history is in-memory, restarts will clear it
kubectl rollout restart deployment/ops-dashboard -n ops-dashboard
```

### 10.2 Remove Deployment (if needed)
```powershell
kubectl delete -f infra/k8s/
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
| 8. Token Refresh | 7 | | | |
| 9. Error Handling | 5 | | | |
| **TOTAL** | **39** | | | |

---

## Notes

**Tester Name**: _________________

**Date**: _________________

**Environment**: _________________

**Browser/Version**: _________________

**Additional Observations**:

```




```
