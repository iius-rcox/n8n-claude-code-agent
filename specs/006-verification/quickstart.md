# Quickstart: Verification

**Feature**: 006-verification
**Prerequisites**: Sprint 5 complete (claude-agent pod running)
**Time**: ~5 minutes

---

## Prerequisites Checklist

Before starting, verify:

- [ ] kubectl context is set to dev-aks
- [ ] claude-agent namespace exists
- [ ] claude-code-agent pod is in Running state

```bash
# Verify prerequisites
kubectl config current-context  # Should show: dev-aks
kubectl get namespace claude-agent  # Should show: Active
kubectl get pods -n claude-agent -l app=claude-code-agent  # Should show: Running
```

---

## Step 1: Verify Azure Workload Identity (T037)

### Step 1.1: Test Identity Login

**For Azure Workload Identity (federated credentials)**:
```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  sh -c 'az login --service-principal -u $AZURE_CLIENT_ID -t $AZURE_TENANT_ID --federated-token "$(cat $AZURE_FEDERATED_TOKEN_FILE)" --allow-no-subscriptions'
```

> **Note**: The simpler `az login --identity` uses IMDS (169.254.169.254) which doesn't work with Workload Identity. Use the federated token approach above.

**Expected**: JSON output containing `cloudName`, `id`, `isDefault` fields

### Step 1.2: Test Storage Container Access

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  az storage container list --account-name iiusagentstore --auth-mode login --query '[].name' -o tsv
```

**Expected**: List of 6 containers:
- agent-state
- agent-spec
- agent-plan
- agent-verification
- agent-review
- agent-release

---

## Step 2: Verify Claude Authentication (T038)

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  claude -p "Say 'Claude Max auth working'"
```

**Expected**: Response containing "Claude Max auth working"

**Failure Indicators**:
- "unauthorized" or "error" in output
- "expired" token message
- Connection timeout

---

## Step 3: Verify GitHub CSI Secrets (T039)

### Step 3.1: List Secrets Directory

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  ls -la /secrets/github/
```

**Expected**: Files present:
- app-id
- private-key.pem

### Step 3.2: Verify App ID Content

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  cat /secrets/github/app-id
```

**Expected**: `2658380` (numeric App ID from Sprint 2)

---

## Step 4: Verify NetworkPolicies (T040)

### Step 4.1: Verify Policy Count

```bash
kubectl get networkpolicy -n claude-agent
```

**Expected**: 4 policies:
- default-deny-all
- allow-dns
- allow-azure-egress
- allow-ingress-from-n8n

### Step 4.2: Test DNS Resolution

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  getent hosts iiusagentstore.blob.core.windows.net
```

**Expected**: IP address returned (proves allow-dns NetworkPolicy works)

---

## Step 5: Verify HTTP Health Endpoint (T041)

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  curl -s http://localhost:3000/health
```

**Expected**: JSON response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T...",
  "activeRequests": 1
}
```

---

## Verification Summary

After completing all steps, record results:

| Test | Step | Status | Notes |
|------|------|--------|-------|
| T037a | 1.1 | ☐ PASS / ☐ FAIL | Azure identity login |
| T037b | 1.2 | ☐ PASS / ☐ FAIL | Storage container list (6 containers) |
| T038 | 2 | ☐ PASS / ☐ FAIL | Claude prompt response |
| T039a | 3.1 | ☐ PASS / ☐ FAIL | GitHub secrets directory |
| T039b | 3.2 | ☐ PASS / ☐ FAIL | App ID content (2658380) |
| T040a | 4.1 | ☐ PASS / ☐ FAIL | NetworkPolicy count (4) |
| T040b | 4.2 | ☐ PASS / ☐ FAIL | DNS resolution |
| T041 | 5 | ☐ PASS / ☐ FAIL | Health endpoint response |

**Overall**: ☐ ALL PASS / ☐ FAILURES

---

## Troubleshooting

### Azure Identity Login Fails

```bash
# Check pod identity annotation
kubectl describe sa claude-agent-sa -n claude-agent | grep azure.workload.identity

# Verify federated credential exists
az identity federated-credential list \
  --identity-name claude-agent-identity \
  --resource-group rg_prod
```

### Claude Authentication Fails

```bash
# Check session token mount
kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /home/claude-agent/.claude/

# Check for read-only filesystem errors
kubectl exec -n claude-agent deploy/claude-code-agent -- cat /home/claude-agent/.claude/debug/latest

# If you see "EROFS: read-only file system" for .claude.json:
# The deployment needs to mount /home/claude-agent as writable, not just /home/claude-agent/.claude

# Refresh tokens (requires Sprint 3 re-run)
# See: specs/003-claude-session-tokens/quickstart.md
```

### Claude CLI Hangs (Read-Only Filesystem)

**Symptom**: Claude CLI times out or hangs indefinitely

**Root Cause**: Claude CLI v2.1.7 writes to `/home/claude-agent/.claude.json` but with `readOnlyRootFilesystem: true`, only mounted volumes are writable.

**Fix**: Update deployment to mount entire `/home/claude-agent` directory:
```yaml
volumeMounts:
  - name: claude-home
    mountPath: /home/claude-agent  # Changed from /home/claude-agent/.claude
```

### CSI Secrets Not Mounted

```bash
# Check SecretProviderClass events
kubectl describe secretproviderclass github-app-akv -n claude-agent

# Check pod events for mount errors
kubectl describe pod -n claude-agent -l app=claude-code-agent | grep -A5 Events
```

### NetworkPolicy Issues

```bash
# Temporarily remove default-deny for debugging (CAUTION)
# kubectl delete networkpolicy default-deny-all -n claude-agent

# Check policy details
kubectl describe networkpolicy allow-dns -n claude-agent
```

### Health Endpoint Not Responding

```bash
# Check if server process is running
kubectl exec -n claude-agent deploy/claude-code-agent -- ps aux | grep node

# Check pod logs
kubectl logs -n claude-agent deploy/claude-code-agent --tail=50
```

---

## Success Criteria Checklist

From spec.md:

- [ ] SC-001: All 5 verification tests pass
- [ ] SC-002: Azure identity auth < 30 seconds
- [ ] SC-003: Claude prompt response < 60 seconds
- [ ] SC-004: CSI secrets accessible
- [ ] SC-005: 4 NetworkPolicies confirmed
- [ ] SC-006: Health endpoint < 1 second response
- [ ] SC-007: All outputs documented
- [ ] SC-008: Tests re-runnable

---

## Next Steps

If all tests pass:
- Mark Sprint 6 complete
- Proceed to Sprint 7: Teams Prompting

If any tests fail:
- Review troubleshooting section
- Check Sprint 1-5 outputs for configuration issues
- Re-run failed sprint's quickstart.md if needed
