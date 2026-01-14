# Quickstart: Kubernetes Deployment

**Feature**: 005-kubernetes-deployment
**Prerequisites**: kubectl configured for dev-aks, AKS cluster running, Sprint 1-4 complete
**Time**: ~20 minutes

---

## Step 1: Verify Prerequisites

```powershell
# Check kubectl context
kubectl config current-context
# Expected: dev-aks (or your AKS context name)

# Verify cluster access
kubectl get nodes

# Verify CSI Driver is enabled
kubectl get pods -n kube-system -l 'app in (secrets-store-csi-driver,secrets-store-provider-azure)'
```

**Expected**: Nodes listed, CSI Driver pods running in kube-system.

---

## Step 2: Create Directory Structure

```powershell
# Create infra/k8s directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "C:\Users\rcox\n8n-claude-code-agent\infra\k8s"
```

**Expected**: Directory `infra/k8s` exists.

---

## Step 3: Create Kubernetes Manifests

Create the following files in `infra/k8s/` using the contracts as reference:

1. `namespace.yaml` - Namespace and ServiceAccount
2. `networkpolicy-default-deny.yaml` - Default deny all traffic
3. `networkpolicy-allow-dns.yaml` - Allow DNS resolution
4. `networkpolicy-allow-azure.yaml` - Allow Azure services egress
5. `networkpolicy-allow-n8n.yaml` - Allow n8n ingress
6. `secretproviderclass.yaml` - CSI Driver for GitHub credentials
7. `deployment.yaml` - Main workload
8. `service.yaml` - ClusterIP service

See `contracts/k8s-manifests.yaml` for complete manifest content.

---

## Step 4: Get Azure Tenant ID

```powershell
# Get tenant ID for SecretProviderClass
$TENANT_ID = az account show --query tenantId -o tsv
Write-Output "Tenant ID: $TENANT_ID"
```

**Expected**: Tenant ID displayed. Update `secretproviderclass.yaml` with this value.

---

## Step 5: Apply Namespace and ServiceAccount

```powershell
# Apply namespace and service account
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\namespace.yaml"

# Verify
kubectl get namespace claude-agent
kubectl get serviceaccount -n claude-agent
kubectl describe serviceaccount claude-agent-sa -n claude-agent
```

**Expected**:
- Namespace `claude-agent` created
- ServiceAccount `claude-agent-sa` has annotation `azure.workload.identity/client-id`
- Label `azure.workload.identity/use: "true"` present

**Success Criteria**: SC-001 - Created within 1 minute.

---

## Step 6: Apply NetworkPolicies

```powershell
# Apply all NetworkPolicies
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\networkpolicy-default-deny.yaml"
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\networkpolicy-allow-dns.yaml"
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\networkpolicy-allow-azure.yaml"
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\networkpolicy-allow-n8n.yaml"

# Verify
kubectl get networkpolicy -n claude-agent
```

**Expected**: 4 NetworkPolicies listed:
- `default-deny-all`
- `allow-dns`
- `allow-azure-egress`
- `allow-ingress-from-n8n`

**Success Criteria**: SC-002 - All 4 policies applied within 2 minutes.

---

## Step 7: Apply SecretProviderClass

```powershell
# Apply SecretProviderClass for GitHub App credentials
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\secretproviderclass.yaml"

# Verify
kubectl get secretproviderclass -n claude-agent
kubectl describe secretproviderclass github-app-akv -n claude-agent
```

**Expected**: SecretProviderClass `github-app-akv` created with Key Vault `iius-akv` configured.

---

## Step 8: Create Claude Session Secret

```powershell
# Create secret from local Claude session files
kubectl create secret generic claude-session `
  --namespace claude-agent `
  --from-file="$env:USERPROFILE\.claude\"

# Verify
kubectl get secret claude-session -n claude-agent
kubectl describe secret claude-session -n claude-agent
```

**Expected**: Secret `claude-session` created with session token files.

**Note**: This secret contains sensitive session tokens. Do not share or commit the YAML.

---

## Step 9: Create Teams Webhook Secret

```powershell
# Replace with actual Teams webhook URL
$TEAMS_WEBHOOK_URL = "https://your-teams-webhook-url"

kubectl create secret generic teams-webhook `
  --namespace claude-agent `
  --from-literal=url="$TEAMS_WEBHOOK_URL"

# Verify
kubectl get secret teams-webhook -n claude-agent
```

**Expected**: Secret `teams-webhook` created.

**Note**: Teams webhook URL will be obtained in Sprint 7. Use a placeholder for now if not available.

---

## Step 10: Apply Deployment

```powershell
# Apply deployment
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\deployment.yaml"

# Watch pod status
kubectl get pods -n claude-agent -w
```

**Expected**: Pod transitions through `ContainerCreating` → `Running`.

**Success Criteria**: SC-003 - Pod reaches Running state within 5 minutes.

---

## Step 11: Verify Pod Security

```powershell
# Check pod is running as non-root
kubectl exec -n claude-agent deploy/claude-code-agent -- whoami

# Check user ID
kubectl exec -n claude-agent deploy/claude-code-agent -- id

# Verify read-only filesystem
kubectl exec -n claude-agent deploy/claude-code-agent -- touch /test-readonly 2>&1
```

**Expected**:
- `whoami` returns `claude-agent`
- `id` shows `uid=1001(claude-agent) gid=1001(claude-agent)`
- Touch command fails with "Read-only file system"

**Success Criteria**: SC-005, SC-006 - Non-root user, read-only filesystem.

---

## Step 12: Apply Service

```powershell
# Apply service
kubectl apply -f "C:\Users\rcox\n8n-claude-code-agent\infra\k8s\service.yaml"

# Verify
kubectl get service claude-agent -n claude-agent
kubectl describe service claude-agent -n claude-agent
```

**Expected**: ClusterIP service created, targeting port 3000.

---

## Step 13: Test Health Endpoint

```powershell
# Port-forward to test locally
kubectl port-forward -n claude-agent svc/claude-agent 8080:80

# In another terminal, test health endpoint
Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get
```

**Expected**: JSON response with `status: "healthy"`.

**Success Criteria**: SC-004 - Response within 1 second.

---

## Step 14: Test DNS Resolution (from pod)

```powershell
# Verify DNS works through NetworkPolicy
kubectl exec -n claude-agent deploy/claude-code-agent -- nslookup iiusagentstore.blob.core.windows.net
```

**Expected**: DNS resolution succeeds, IP address returned.

---

## Verification Checklist

| Step | Verification | Expected |
|------|--------------|----------|
| Prerequisites | `kubectl get nodes` | Nodes listed |
| Namespace | `kubectl get ns claude-agent` | Created |
| ServiceAccount | `kubectl describe sa claude-agent-sa -n claude-agent` | Workload ID annotation |
| NetworkPolicies | `kubectl get netpol -n claude-agent` | 4 policies |
| SecretProviderClass | `kubectl get spc -n claude-agent` | github-app-akv |
| Secrets | `kubectl get secret -n claude-agent` | claude-session, teams-webhook |
| Pod | `kubectl get pods -n claude-agent` | Running |
| Security | `kubectl exec ... whoami` | claude-agent (UID 1001) |
| Service | `kubectl get svc -n claude-agent` | ClusterIP |
| Health | `/health` endpoint | JSON response |

---

## Outputs for Sprint 6

Save this information for Sprint 6 (Verification):

| Output | Value | Use |
|--------|-------|-----|
| Service DNS | `claude-agent.claude-agent.svc.cluster.local` | n8n HTTP Request node |
| Service Port | `80` (routes to 3000) | n8n connection |
| Health Path | `/health` | Verification tests |
| Run Path | `/run` | n8n prompt execution |
| Namespace | `claude-agent` | kubectl commands |

---

## Troubleshooting

### Pod stuck in ContainerCreating

Check CSI Driver mounting:

```powershell
kubectl describe pod -n claude-agent -l app=claude-code-agent
# Look for "FailedMount" events
```

Common causes:
- SecretProviderClass misconfigured (check tenantId)
- Managed identity doesn't have Key Vault access
- Key Vault secrets don't exist

### Pod CrashLoopBackOff

Check init container logs:

```powershell
kubectl logs -n claude-agent -l app=claude-code-agent -c copy-claude-session
```

Common causes:
- claude-session secret doesn't exist
- Permission issues copying files

### Health endpoint returns 503

Server is shutting down. Check pod events:

```powershell
kubectl describe pod -n claude-agent -l app=claude-code-agent
```

### NetworkPolicy blocking traffic

Temporarily disable default-deny to debug:

```powershell
# WARNING: Only for debugging!
kubectl delete networkpolicy default-deny-all -n claude-agent

# Re-apply after debugging
kubectl apply -f infra/k8s/networkpolicy-default-deny.yaml
```

### CSI Driver not mounting secrets

Check CSI Driver pods:

```powershell
kubectl get pods -n kube-system -l 'app in (secrets-store-csi-driver,secrets-store-provider-azure)'
kubectl logs -n kube-system -l app=secrets-store-provider-azure
```

---

## Cleanup (Development Only)

To remove all resources:

```powershell
# Delete namespace (removes all resources in it)
kubectl delete namespace claude-agent

# Verify
kubectl get all -n claude-agent
```

**Warning**: This deletes all secrets including session tokens. You'll need to recreate them.

---

## Rollback Procedures

### If Deployment Fails

```powershell
# Check deployment status
kubectl rollout status deployment/claude-code-agent -n claude-agent

# Rollback to previous version
kubectl rollout undo deployment/claude-code-agent -n claude-agent
```

### If Claude Auth Fails

```powershell
# Refresh session tokens locally
claude logout
claude login

# Delete and recreate secret
kubectl delete secret claude-session -n claude-agent
kubectl create secret generic claude-session --namespace claude-agent --from-file="$env:USERPROFILE\.claude\"

# Restart deployment
kubectl rollout restart deployment/claude-code-agent -n claude-agent
```
