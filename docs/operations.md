# Operations Guide

Day-to-day operational procedures for the n8n-claude-code-agent system.

## Table of Contents

- [Daily Operations](#daily-operations)
- [Token Refresh Procedure](#token-refresh-procedure)
- [Deployment Updates](#deployment-updates)
- [Scaling](#scaling)
- [Backup and Recovery](#backup-and-recovery)

---

## Daily Operations

### Check System Health

```bash
# Verify pod is running
kubectl get pods -n claude-agent

# Check recent logs
kubectl logs -n claude-agent deploy/claude-code-agent --tail=50

# Verify health endpoint
kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health
```

### Monitor Auth Watchdog

```bash
# Check CronJob status
kubectl get cronjob -n claude-agent

# View recent job history
kubectl get jobs -n claude-agent --sort-by=.metadata.creationTimestamp

# Check last job logs
kubectl logs -n claude-agent job/$(kubectl get jobs -n claude-agent -o jsonpath='{.items[-1].metadata.name}')
```

### View Teams Notifications

Auth failures are automatically sent to the configured Teams channel. Check:
- Teams channel for red alert cards
- Card shows pod name and timestamp
- "Refresh Tokens" button links to this guide

---

## Token Refresh Procedure

When Claude session tokens expire, follow this procedure:

### Step 1: Login Locally

```bash
# On your local machine with Claude CLI installed
claude logout
claude login
```

Complete the browser authentication flow.

### Step 2: Verify Authentication

```bash
claude -p "Say 'auth test successful'"
```

### Step 3: Generate Kubernetes Secret

```powershell
# PowerShell (Windows)
kubectl create secret generic claude-session `
  --namespace claude-agent `
  --from-file="$env:USERPROFILE\.claude\" `
  --dry-run=client -o yaml | kubectl apply -f -
```

```bash
# Bash (Linux/macOS)
kubectl create secret generic claude-session \
  --namespace claude-agent \
  --from-file="$HOME/.claude/" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Step 4: Restart Deployment

```bash
kubectl rollout restart deployment/claude-code-agent -n claude-agent
kubectl rollout status deployment/claude-code-agent -n claude-agent
```

### Step 5: Verify New Tokens

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "Say 'tokens refreshed'"
```

---

## Deployment Updates

### Update Container Image

1. **Build new image:**
   ```bash
   cd infra/docker
   docker build -t iiusacr.azurecr.io/claude-agent:v4.6.5 .
   ```

2. **Push to registry:**
   ```bash
   az acr login --name iiusacr
   docker push iiusacr.azurecr.io/claude-agent:v4.6.5
   ```

3. **Update deployment:**
   ```bash
   kubectl set image deployment/claude-code-agent \
     claude-code-agent=iiusacr.azurecr.io/claude-agent:v4.6.5 \
     -n claude-agent
   ```

4. **Monitor rollout:**
   ```bash
   kubectl rollout status deployment/claude-code-agent -n claude-agent
   ```

### Rollback Deployment

```bash
# View rollout history
kubectl rollout history deployment/claude-code-agent -n claude-agent

# Rollback to previous version
kubectl rollout undo deployment/claude-code-agent -n claude-agent

# Rollback to specific revision
kubectl rollout undo deployment/claude-code-agent -n claude-agent --to-revision=2
```

### Update Kubernetes Manifests

```bash
# Apply updated manifests
kubectl apply -f infra/k8s/deployment.yaml

# Verify changes
kubectl describe deployment claude-code-agent -n claude-agent
```

---

## Scaling

### Current Design

The system runs as a **single replica** by design:
- Claude CLI maintains session state
- Concurrent prompts are serialized
- n8n workflows should use retry logic

### Resource Adjustments

Edit `infra/k8s/deployment.yaml` to adjust resources:

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "8Gi"
    cpu: "4"
```

Apply changes:
```bash
kubectl apply -f infra/k8s/deployment.yaml
```

---

## Backup and Recovery

### Backup Claude Session

```bash
# Export current secret
kubectl get secret claude-session -n claude-agent -o yaml > claude-session-backup.yaml
```

### Restore Claude Session

```bash
# Apply backup (after editing namespace if needed)
kubectl apply -f claude-session-backup.yaml
kubectl rollout restart deployment/claude-code-agent -n claude-agent
```

### Backup All Manifests

```bash
# Export all resources in namespace
kubectl get all,secrets,configmaps,networkpolicies,cronjobs -n claude-agent -o yaml > claude-agent-backup.yaml
```

---

## Maintenance Windows

### Planned Maintenance

1. **Notify stakeholders** via Teams
2. **Pause n8n workflows** that invoke Claude
3. **Perform maintenance** (updates, token refresh)
4. **Verify system health**
5. **Resume n8n workflows**
6. **Notify completion** via Teams

### Emergency Maintenance

For auth failures detected by watchdog:

1. Teams notification received
2. Check pod logs for details
3. Follow Token Refresh Procedure
4. Verify resolution
5. n8n workflows auto-resume on success

---

## Key Commands Reference

| Task | Command |
|------|---------|
| Check pod status | `kubectl get pods -n claude-agent` |
| View logs | `kubectl logs -n claude-agent deploy/claude-code-agent` |
| Health check | `kubectl exec -n claude-agent deploy/claude-code-agent -- curl -s http://localhost:3000/health` |
| Restart deployment | `kubectl rollout restart deployment/claude-code-agent -n claude-agent` |
| Test Claude auth | `kubectl exec -n claude-agent deploy/claude-code-agent -- claude -p "test"` |
| Trigger watchdog | `kubectl create job --from=cronjob/claude-auth-watchdog manual-check -n claude-agent` |
| View CronJob history | `kubectl get jobs -n claude-agent` |

---

## Contact

For issues not covered by this guide:
- Check [Troubleshooting Guide](troubleshooting.md)
- Review sprint quickstart docs in `specs/*/quickstart.md`
- Consult the implementation plan: `multi-agent-implementation-plan-v4.6.1.md`
