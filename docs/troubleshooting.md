# Troubleshooting Guide

Common issues and solutions for the n8n-claude-code-agent system.

## Table of Contents

- [Pod Issues](#pod-issues)
- [Authentication Issues](#authentication-issues)
- [Network Issues](#network-issues)
- [n8n Integration Issues](#n8n-integration-issues)
- [Performance Issues](#performance-issues)

---

## Pod Issues

### Pod Not Starting

**Symptoms:**
- Pod stuck in `Pending` or `ContainerCreating` state
- Pod in `CrashLoopBackOff`

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod -n claude-agent -l app=claude-code-agent

# Check init container logs
kubectl logs -n claude-agent -l app=claude-code-agent -c copy-claude-session
```

**Common Causes:**

1. **CSI Driver not mounting secrets:**
   ```bash
   # Verify CSI driver pods
   kubectl get pods -n kube-system -l app=secrets-store-csi-driver

   # Check SecretProviderClass
   kubectl describe secretproviderclass github-app-akv -n claude-agent
   ```

2. **Image pull failure:**
   ```bash
   # Verify ACR access
   az acr login --name iiusacr

   # Check image exists
   az acr repository show-tags --name iiusacr --repository claude-agent
   ```

3. **Resource limits:**
   ```bash
   # Check node resources
   kubectl describe nodes | grep -A5 "Allocated resources"
   ```

### Pod Crashing

**Symptoms:**
- Pod restarts frequently
- `CrashLoopBackOff` status

**Diagnosis:**
```bash
# Check crash logs
kubectl logs -n claude-agent deploy/claude-code-agent --previous

# Check exit code
kubectl describe pod -n claude-agent -l app=claude-code-agent | grep -A3 "Last State"
```

**Common Causes:**

1. **HTTP server crash:**
   - Check for JavaScript errors in logs
   - Verify server.js syntax

2. **Read-only filesystem errors:**
   - Ensure emptyDir volumes mounted for writable paths
   - Check `/tmp`, `/workspace`, `/home/claude-agent` mounts

---

## Authentication Issues

### Claude Auth Failure (Exit 57)

**Symptoms:**
- Teams notification received
- API returns `exitCode: 57`
- CronJob fails with exit 57

**Diagnosis:**
```bash
# Test auth directly
kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "auth test"

# Check Claude home directory
kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /home/claude-agent/.claude/
```

**Resolution:**
1. Follow [Token Refresh Procedure](operations.md#token-refresh-procedure)
2. Verify new tokens work
3. Restart deployment

### Azure Workload Identity Failure

**Symptoms:**
- `az login --identity` times out
- Storage container access denied

**Diagnosis:**
```bash
# Check environment variables
kubectl exec -n claude-agent deploy/claude-code-agent -- env | grep AZURE

# Test federated token login
kubectl exec -n claude-agent deploy/claude-code-agent -- sh -c '
  az login --service-principal \
    -u $AZURE_CLIENT_ID \
    -t $AZURE_TENANT_ID \
    --federated-token "$(cat $AZURE_FEDERATED_TOKEN_FILE)" \
    --allow-no-subscriptions
'
```

**Common Causes:**

1. **Federated credential misconfigured:**
   ```bash
   # Verify federated credential subject
   az identity federated-credential show \
     --name claude-agent-fed-cred \
     --identity-name claude-agent-identity \
     --resource-group rg_prod
   ```
   Subject must be: `system:serviceaccount:claude-agent:claude-agent-sa`

2. **Service account annotation missing:**
   ```bash
   kubectl describe sa claude-agent-sa -n claude-agent | grep azure.workload.identity
   ```

### GitHub CSI Secrets Not Mounted

**Symptoms:**
- `/secrets/github/` directory empty or missing
- Pod fails to start with CSI error

**Diagnosis:**
```bash
# Check volume mount
kubectl exec -n claude-agent deploy/claude-code-agent -- ls -la /secrets/github/

# Check SecretProviderClass events
kubectl describe secretproviderclass github-app-akv -n claude-agent
```

**Common Causes:**

1. **Key Vault secrets missing:**
   ```bash
   az keyvault secret list --vault-name iius-akv --query "[?starts_with(name,'github')].name"
   ```

2. **Managed identity lacks Key Vault access:**
   ```bash
   az role assignment list --assignee <identity-object-id> --scope /subscriptions/.../vaults/iius-akv
   ```

---

## Network Issues

### DNS Resolution Failure

**Symptoms:**
- Cannot reach external services
- `getent hosts` returns nothing

**Diagnosis:**
```bash
# Test DNS
kubectl exec -n claude-agent deploy/claude-code-agent -- getent hosts google.com

# Check NetworkPolicy
kubectl get networkpolicy allow-dns -n claude-agent -o yaml
```

**Resolution:**
Verify `allow-dns` NetworkPolicy exists and targets kube-dns:
```bash
kubectl apply -f infra/k8s/networkpolicy-allow-dns.yaml
```

### Cannot Reach Azure Services

**Symptoms:**
- Storage operations fail
- Key Vault access denied

**Diagnosis:**
```bash
# Test Azure connectivity
kubectl exec -n claude-agent deploy/claude-code-agent -- curl -v https://iiusagentstore.blob.core.windows.net

# Check egress policy
kubectl get networkpolicy allow-azure-egress -n claude-agent -o yaml
```

**Resolution:**
Verify `allow-azure-egress` NetworkPolicy allows TCP 443:
```bash
kubectl apply -f infra/k8s/networkpolicy-allow-azure.yaml
```

### n8n Cannot Reach Claude Agent

**Symptoms:**
- n8n workflow HTTP Request fails
- Connection refused or timeout

**Diagnosis:**
```bash
# Verify service exists
kubectl get svc claude-agent -n claude-agent

# Test from n8n namespace
kubectl run test-curl --rm -it --image=curlimages/curl -n n8n-prod -- \
  curl http://claude-agent.claude-agent.svc.cluster.local/health
```

**Resolution:**
1. Verify `allow-ingress-from-n8n` NetworkPolicy:
   ```bash
   kubectl apply -f infra/k8s/networkpolicy-allow-n8n.yaml
   ```

2. Verify n8n namespace label matches policy selector

---

## n8n Integration Issues

### HTTP Request Timeout

**Symptoms:**
- n8n workflow times out
- No response from Claude agent

**Diagnosis:**
```bash
# Check active requests
kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health

# Check for stuck prompts
kubectl logs -n claude-agent deploy/claude-code-agent --tail=100
```

**Resolution:**
1. Increase timeout in n8n HTTP Request node
2. Check if Claude prompt is taking longer than expected
3. Restart deployment if stuck

### Invalid JSON Response

**Symptoms:**
- n8n cannot parse response
- Error parsing JSON

**Diagnosis:**
```bash
# Test raw response
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  curl -s -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
```

**Resolution:**
1. Verify prompt is valid JSON
2. Check server.js for response formatting issues
3. Look for non-JSON output in logs

### Exit Code Routing Not Working

**Symptoms:**
- n8n not routing based on exit codes
- All responses going to same branch

**Resolution:**
In n8n workflow, use expression to check exit code:
```
{{ $json.exitCode }}
```

Route based on:
- `0`: Success
- `57`: Auth failure (alert + pause)
- `124`: Timeout (retry)
- Other: Error (alert)

---

## Performance Issues

### Slow Response Times

**Symptoms:**
- Health endpoint slow (>1s)
- Prompts taking longer than expected

**Diagnosis:**
```bash
# Check resource usage
kubectl top pod -n claude-agent

# Check for resource throttling
kubectl describe pod -n claude-agent -l app=claude-code-agent | grep -A10 "Limits"
```

**Resolution:**
1. Increase resource limits in deployment
2. Check node resources
3. Simplify prompts

### High Memory Usage

**Symptoms:**
- Pod OOMKilled
- Memory limits exceeded

**Diagnosis:**
```bash
kubectl describe pod -n claude-agent -l app=claude-code-agent | grep -A5 "State"
```

**Resolution:**
1. Increase memory limits:
   ```yaml
   limits:
     memory: "8Gi"
   ```
2. Check for memory leaks in long prompts
3. Restart deployment to clear memory

---

## Diagnostic Commands

| Issue | Command |
|-------|---------|
| Pod status | `kubectl get pods -n claude-agent -o wide` |
| Pod events | `kubectl describe pod -n claude-agent -l app=claude-code-agent` |
| Container logs | `kubectl logs -n claude-agent deploy/claude-code-agent` |
| Previous logs | `kubectl logs -n claude-agent deploy/claude-code-agent --previous` |
| Health check | `kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s localhost:3000/health` |
| Network policies | `kubectl get networkpolicy -n claude-agent` |
| Secrets | `kubectl get secrets -n claude-agent` |
| Service endpoints | `kubectl get endpoints claude-agent -n claude-agent` |
| Resource usage | `kubectl top pod -n claude-agent` |
| CSI driver status | `kubectl get pods -n kube-system -l app=secrets-store-csi-driver` |

---

## Getting Help

If issues persist:

1. Collect diagnostics:
   ```bash
   kubectl get all,secrets,networkpolicy -n claude-agent -o yaml > diagnostics.yaml
   kubectl logs -n claude-agent deploy/claude-code-agent > pod-logs.txt
   ```

2. Review sprint quickstart docs in `specs/*/quickstart.md`

3. Check the implementation plan: `multi-agent-implementation-plan-v4.6.1.md`
