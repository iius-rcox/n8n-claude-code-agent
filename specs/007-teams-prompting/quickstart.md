# Quickstart: Teams Prompting

**Feature**: 007-teams-prompting
**Prerequisites**: Sprint 5 complete (claude-agent pod running), Sprint 6 verified
**Time**: ~15 minutes

---

## Prerequisites Checklist

Before starting, verify:

- [ ] kubectl context is set to dev-aks
- [ ] claude-agent namespace exists with running pod
- [ ] Microsoft Teams access with channel admin permissions
- [ ] Claude session tokens are valid (Sprint 6 verified)

```bash
# Verify prerequisites
kubectl config current-context  # Should show: dev-aks
kubectl get pods -n claude-agent -l app=claude-code-agent  # Should show: Running
```

---

## Step 1: Create Teams Webhook (US1)

### Step 1.1: Access Teams Workflows

1. Open Microsoft Teams desktop or web app
2. Navigate to the target channel for notifications (e.g., `#claude-alerts`)
3. Click the `⋯` (More options) button next to the channel name
4. Select **Workflows** from the dropdown menu

### Step 1.2: Create Incoming Webhook Workflow

1. In the Workflows panel, search for **"Post to a channel when a webhook request is received"**
2. Click on the workflow template
3. Click **Next** to configure
4. Name the workflow: `Claude Auth Alert`
5. Select the target channel for notifications
6. Click **Create flow**

### Step 1.3: Copy Webhook URL

1. After creation, the workflow displays a webhook URL
2. Copy the full URL (starts with `https://prod-XX.westus.logic.azure.com/...`)
3. **Important**: Keep this URL secure - it allows posting to your channel

**Expected**: URL in format `https://prod-XX.*.logic.azure.com/workflows/...`

---

## Step 2: Store Webhook URL in Kubernetes (US1)

### Step 2.1: Create/Update Secret

```bash
# Replace YOUR_WEBHOOK_URL with the copied URL
kubectl create secret generic teams-webhook \
  --from-literal=url='YOUR_WEBHOOK_URL' \
  -n claude-agent \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 2.2: Verify Secret

```bash
kubectl get secret teams-webhook -n claude-agent
```

**Expected**: Secret exists with `Data: 1`

### Step 2.3: Restart Pod to Pick Up Secret

```bash
kubectl rollout restart deployment/claude-code-agent -n claude-agent
kubectl rollout status deployment/claude-code-agent -n claude-agent
```

**Expected**: Pod restarts successfully

---

## Step 3: Test Teams Notification (US1)

### Step 3.1: Send Test Notification

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  /opt/claude-agent/notify.sh "Test Alert" "This is a test notification from the Claude agent."
```

**Expected**:
- Output shows `Notification sent successfully (HTTP 200)`
- Teams channel receives the message with red theme

### Step 3.2: Verify Teams Message

Check the target Teams channel for the notification:
- Title: `🔴 Test Alert`
- Contains: Pod name, timestamp, message text
- Has "View Refresh Steps" action button

---

## Step 4: Deploy Authentication Watchdog CronJob (US2)

### Step 4.1: Apply CronJob Manifest

```bash
kubectl apply -f infra/k8s/cronjob.yaml
```

### Step 4.2: Verify CronJob Created

```bash
kubectl get cronjob -n claude-agent
```

**Expected**: `claude-auth-watchdog` with schedule `*/30 * * * *`

### Step 4.3: Verify CronJob Details

```bash
kubectl describe cronjob claude-auth-watchdog -n claude-agent
```

**Expected**:
- Concurrency Policy: Forbid
- Starting Deadline Seconds: 300
- Schedule: `*/30 * * * *`

---

## Step 5: Test Authentication Check Manually (US2)

### Step 5.1: Create Manual Job

```bash
kubectl create job --from=cronjob/claude-auth-watchdog test-watchdog -n claude-agent
```

### Step 5.2: Watch Job Execution

```bash
kubectl get jobs -n claude-agent -w
```

**Expected** (if tokens valid):
- Job completes with `1/1` completions
- No Teams notification sent

**Expected** (if tokens expired):
- Job completes with `0/1` completions
- Teams notification received with re-auth steps

### Step 5.3: Check Job Logs

```bash
kubectl logs job/test-watchdog -n claude-agent
```

**Expected output (tokens valid)**:
```
Starting Claude authentication check...
Timeout: 30s
Authentication check passed
Claude authentication: SUCCESS
```

### Step 5.4: Clean Up Test Job

```bash
kubectl delete job test-watchdog -n claude-agent
```

---

## Step 6: End-to-End n8n Integration Test (US3)

### Step 6.1: Create Test Workflow in n8n

1. Open n8n at `https://n8n.ii-us.com`
2. Create a new workflow
3. Add **Manual Trigger** node
4. Add **HTTP Request** node with:
   - Method: `POST`
   - URL: `http://claude-agent.claude-agent.svc.cluster.local/run`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "prompt": "Say 'Hello from n8n integration test'",
       "timeout": 60000
     }
     ```

### Step 6.2: Execute Test

1. Click **Execute Workflow**
2. Wait for response (may take 10-30 seconds)

**Expected Response**:
```json
{
  "success": true,
  "output": "Hello from n8n integration test",
  "exitCode": 0,
  "duration": 12345
}
```

### Step 6.3: Verify Health Endpoint

Add another HTTP Request node:
- Method: `GET`
- URL: `http://claude-agent.claude-agent.svc.cluster.local/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T...",
  "activeRequests": 0
}
```

---

## Verification Summary

After completing all steps, record results:

| Test | Step | Status | Notes |
|------|------|--------|-------|
| Webhook created | 1 | ☐ PASS / ☐ FAIL | URL copied |
| Secret stored | 2 | ☐ PASS / ☐ FAIL | teams-webhook exists |
| Test notification | 3 | ☐ PASS / ☐ FAIL | Teams message received |
| CronJob deployed | 4 | ☐ PASS / ☐ FAIL | Watchdog scheduled |
| Manual auth check | 5 | ☐ PASS / ☐ FAIL | Job completed |
| n8n /run endpoint | 6 | ☐ PASS / ☐ FAIL | Claude responded |
| n8n /health endpoint | 6 | ☐ PASS / ☐ FAIL | Status healthy |

**Overall**: ☐ ALL PASS / ☐ FAILURES

---

## Troubleshooting

### Teams Notification Fails

```bash
# Check webhook URL is set
kubectl get secret teams-webhook -n claude-agent -o jsonpath='{.data.url}' | base64 -d

# Test curl directly from pod
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  curl -s -X POST -H "Content-Type: application/json" \
  -d '{"@type":"MessageCard","summary":"Test"}' \
  "$TEAMS_WEBHOOK_URL"
```

### CronJob Not Running

```bash
# Check CronJob status
kubectl describe cronjob claude-auth-watchdog -n claude-agent

# Check for suspended state
kubectl get cronjob claude-auth-watchdog -n claude-agent -o jsonpath='{.spec.suspend}'
```

### Auth Check Fails

```bash
# Check pod can access Claude
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  claude -p "auth test"

# If expired, refresh tokens
# See: specs/003-claude-session-tokens/quickstart.md
```

### n8n Cannot Reach Service

```bash
# Verify service exists
kubectl get svc claude-agent -n claude-agent

# Verify NetworkPolicy allows n8n
kubectl get networkpolicy -n claude-agent

# Test from n8n pod (if accessible)
kubectl exec -n n8n-prod deploy/n8n -- \
  curl -s http://claude-agent.claude-agent.svc.cluster.local/health
```

---

## Success Criteria Checklist

From spec.md:

- [ ] SC-001: Notifications delivered within 30 seconds
- [ ] SC-002: CronJob runs every 30 minutes
- [ ] SC-003: Auth check completes within 30 seconds
- [ ] SC-004: n8n receives response within 5 minutes
- [ ] SC-005: Zero false positive notifications
- [ ] SC-006: 100% auth failures result in notification
- [ ] SC-007: E2E n8n test successful

---

## Next Steps

If all tests pass:
- Sprint 7 complete
- Full system operational
- Enable CronJob monitoring in Teams

If any tests fail:
- Review troubleshooting section
- Check Sprint 5/6 outputs for configuration issues
- Verify Claude session tokens are valid
