# Multi-Agent Development System — Implementation Plan v4.6.0 (II-US)

Production-ready implementation for INSULATIONS, INC Azure environment using Claude Max subscription.

---

## Version History

| Version | Key Changes |
|---------|-------------|
| v4.0 - v4.5.3 | Core architecture, concurrency, hardening |
| **v4.6.0** | Claude Max session tokens (no API key), II-US resource names |

---

## Authentication Strategy

| Component | Method |
|-----------|--------|
| **Azure** | Workload Identity (managed identity + federated credential) |
| **GitHub** | GitHub App installation token |
| **Claude** | Max subscription session tokens (mounted from K8s secret) |

> **Assumption**: Claude Max session tokens have sufficient longevity for automated use. If tokens expire, manual refresh required (copy updated `~/.claude/` to K8s secret).

---

## II-US Azure Environment

### Existing Resources

| Resource | Value |
|----------|-------|
| **Subscription ID** | `a78954fe-f6fe-4279-8be0-2c748be2f266` |
| **Tenant ID** | `953922e6-5370-4a01-a3d5-773a30df726b` |
| **Resource Group** | `rg_prod` |
| **Region** | `southcentralus` |
| **AKS Cluster** | `dev-aks` |
| **Container Registry** | `iiusacr.azurecr.io` |
| **Key Vault** | `iius-akv` |

### Resources to Create

| Resource | Name | Purpose |
|----------|------|---------|
| Storage Account | `iiusagentstore` | Agent state and artifacts |
| Managed Identity | `claude-agent-identity` | Workload Identity |
| K8s Namespace | `claude-agent` | Agent workloads |
| K8s Service Account | `claude-agent-sa` | Identity binding |
| K8s Secret | `claude-session` | Claude Max tokens |
| K8s Secret | `github-app` | GitHub App credentials |

---

## Phase 1: Azure Infrastructure

### 1.1 Create Storage Account

```bash
RESOURCE_GROUP="rg_prod"
LOCATION="southcentralus"
STORAGE_ACCOUNT="iiusagentstore"

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false

# Create containers
for container in agent-state agent-spec agent-plan agent-verification agent-review agent-release; do
  az storage container create \
    --account-name $STORAGE_ACCOUNT \
    --name $container \
    --auth-mode login
done
```

### 1.2 Create Managed Identity

```bash
IDENTITY_NAME="claude-agent-identity"

az identity create \
  --name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Capture outputs
CLIENT_ID=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query clientId -o tsv)
OBJECT_ID=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)

echo "CLIENT_ID=$CLIENT_ID"  # Save this for K8s service account
```

### 1.3 Grant Storage Access

```bash
STORAGE_ID=$(az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query id -o tsv)

az role assignment create \
  --assignee $OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID
```

### 1.4 Create Federated Credential

```bash
AKS_CLUSTER="dev-aks"

OIDC_ISSUER=$(az aks show --name $AKS_CLUSTER --resource-group $RESOURCE_GROUP --query "oidcIssuerProfile.issuerUrl" -o tsv)

az identity federated-credential create \
  --name "claude-agent-fed-cred" \
  --identity-name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --issuer "$OIDC_ISSUER" \
  --subject "system:serviceaccount:claude-agent:claude-agent-sa" \
  --audiences "api://AzureADTokenExchange"
```

---

## Phase 2: GitHub App

### 2.1 Create GitHub App

1. Go to: https://github.com/organizations/ii-us/settings/apps/new
2. Settings:
   - **Name**: `II-US Claude Agent`
   - **Homepage**: `https://ii-us.com`
   - **Webhook**: Uncheck "Active"
3. Permissions (Repository):
   - Contents: Read & Write
   - Pull requests: Read & Write
   - Issues: Read & Write
   - Metadata: Read-only
4. Create, note **App ID**, generate **Private Key**
5. Install on target repositories

### 2.2 Store in Key Vault (Optional)

```bash
az keyvault secret set --vault-name iius-akv --name "github-app-id" --value "YOUR_APP_ID"
az keyvault secret set --vault-name iius-akv --name "github-app-private-key" --file private-key.pem
```

---

## Phase 3: Capture Claude Session Tokens

### 3.1 On Your Machine (One-Time Setup)

```powershell
# PowerShell - Ensure fresh login
claude logout
claude login
# Complete OAuth in browser

# Verify working
claude -p "Say 'auth test successful'"

# Check contents
Get-ChildItem "$env:USERPROFILE\.claude" -Force
```

### 3.2 Create K8s Secret from Tokens

```powershell
# PowerShell - Create secret YAML
$claudeDir = "$env:USERPROFILE\.claude"

# Base64 encode each file
$files = Get-ChildItem $claudeDir -Force | Where-Object { -not $_.PSIsContainer }

Write-Output "apiVersion: v1"
Write-Output "kind: Secret"
Write-Output "metadata:"
Write-Output "  name: claude-session"
Write-Output "  namespace: claude-agent"
Write-Output "type: Opaque"
Write-Output "data:"

foreach ($file in $files) {
    $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file.FullName))
    Write-Output "  $($file.Name): $content"
}
```

Or simpler - use kubectl directly:

```bash
# From WSL or bash
kubectl create secret generic claude-session \
  --namespace claude-agent \
  --from-file=$HOME/.claude/ \
  --dry-run=client -o yaml > claude-session-secret.yaml

kubectl apply -f claude-session-secret.yaml
```

### 3.3 Refresh Tokens (When Needed)

If tokens expire, repeat 3.1-3.2 to update the secret:

```bash
kubectl delete secret claude-session -n claude-agent
kubectl create secret generic claude-session --namespace claude-agent --from-file=$HOME/.claude/
```

---

## Phase 4: Docker Image

### 4.1 Dockerfile

```dockerfile
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl git jq bash coreutils ca-certificates gnupg nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# yq
RUN curl -fsSL https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \
    -o /usr/local/bin/yq && chmod +x /usr/local/bin/yq

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Agent user
RUN useradd -m -s /bin/bash claude-agent \
    && mkdir -p /home/claude-agent/scripts /home/claude-agent/.claude /workspace/work \
    && chown -R claude-agent:claude-agent /home/claude-agent /workspace

COPY scripts/ /home/claude-agent/scripts/
RUN chmod +x /home/claude-agent/scripts/*.sh

USER claude-agent
WORKDIR /workspace

ENV STORAGE_ACCOUNT=iiusagentstore
ENV HOME=/home/claude-agent
```

### 4.2 Build and Push

```bash
az acr login --name iiusacr
docker build -t iiusacr.azurecr.io/claude-agent:v4.6.0 .
docker push iiusacr.azurecr.io/claude-agent:v4.6.0
```

---

## Phase 5: Kubernetes Deployment

### 5.1 Namespace and Service Account

```yaml
# claude-agent-ns.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: claude-agent
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: claude-agent-sa
  namespace: claude-agent
  annotations:
    azure.workload.identity/client-id: "<CLIENT_ID_FROM_STEP_1.2>"
  labels:
    azure.workload.identity/use: "true"
```

### 5.2 GitHub Secret

```yaml
# github-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-app
  namespace: claude-agent
type: Opaque
stringData:
  app-id: "YOUR_GITHUB_APP_ID"
  private-key.pem: |
    -----BEGIN RSA PRIVATE KEY-----
    YOUR_PRIVATE_KEY_HERE
    -----END RSA PRIVATE KEY-----
```

### 5.3 Deployment

```yaml
# claude-agent-deploy.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-code-agent
  namespace: claude-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: claude-code-agent
  template:
    metadata:
      labels:
        app: claude-code-agent
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: claude-agent-sa
      containers:
      - name: agent
        image: iiusacr.azurecr.io/claude-agent:v4.6.0
        command: ["sleep", "infinity"]
        env:
        - name: STORAGE_ACCOUNT
          value: "iiusagentstore"
        volumeMounts:
        - name: claude-session
          mountPath: /home/claude-agent/.claude
          readOnly: true
        - name: github-creds
          mountPath: /secrets/github
          readOnly: true
        - name: workspace
          mountPath: /workspace
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "8Gi"
            cpu: "4"
      volumes:
      - name: claude-session
        secret:
          secretName: claude-session
      - name: github-creds
        secret:
          secretName: github-app
      - name: workspace
        emptyDir:
          sizeLimit: 10Gi
```

### 5.4 Deploy

```bash
az aks get-credentials --resource-group rg_prod --name dev-aks

kubectl apply -f claude-agent-ns.yaml
kubectl apply -f github-secret.yaml
# Apply claude-session secret (from Phase 3.2)
kubectl apply -f claude-agent-deploy.yaml

kubectl get pods -n claude-agent
```

---

## Phase 6: Verify

### 6.1 Azure Auth

```bash
kubectl exec -it -n claude-agent deploy/claude-code-agent -- bash

# Test Workload Identity
az login --identity --allow-no-subscriptions
az storage container list --account-name iiusagentstore --auth-mode login -o table
```

### 6.2 Claude Auth

```bash
# Still in pod
claude -p "Say 'Claude Max auth working'"
```

### 6.3 GitHub Auth

```bash
export GITHUB_PRIVATE_KEY_FILE="/secrets/github/private-key.pem"
source /home/claude-agent/scripts/mint-github-token.sh
gh auth status
```

---

## Scripts

All scripts in `/home/claude-agent/scripts/`. See v4.5.3 for full script contents - no changes needed for v4.6.0 except:

### run-agent.sh (Updated Section)

```bash
# Claude auth - use mounted session tokens
# Tokens mounted at /home/claude-agent/.claude via K8s secret
# No setup needed - $HOME/.claude already populated

# Verify Claude works
claude -p "health check" >/dev/null 2>&1 || {
  echo "ERROR: Claude auth failed - session tokens may be expired" >&2
  echo "ACTION: Refresh tokens and update claude-session secret" >&2
  exit 1
}
```

---

## Quick Reference

### Run Agent

```bash
kubectl exec -n claude-agent deploy/claude-code-agent -- \
  /home/claude-agent/scripts/run-agent.sh \
  TICKET-001 pm intake agent-spec 3600
```

### Refresh Claude Tokens

```bash
# On your machine
claude logout && claude login

# Update secret
kubectl delete secret claude-session -n claude-agent
kubectl create secret generic claude-session -n claude-agent --from-file=$HOME/.claude/
kubectl rollout restart deployment/claude-code-agent -n claude-agent
```

### Break Stuck Lease

```bash
az storage blob lease break \
  --account-name iiusagentstore \
  --container-name agent-state \
  --blob-name TICKET-001/task-envelope.yml \
  --auth-mode login
```

---

## Checklist

### Azure (Phase 1)
- [ ] Create storage account `iiusagentstore`
- [ ] Create 6 blob containers
- [ ] Create managed identity `claude-agent-identity`
- [ ] Grant Storage Blob Data Contributor
- [ ] Create federated credential
- [ ] Note CLIENT_ID for K8s service account

### GitHub (Phase 2)
- [ ] Create GitHub App in ii-us org
- [ ] Note App ID
- [ ] Generate and save private key
- [ ] Install app on target repos

### Claude (Phase 3)
- [ ] Fresh `claude login` on your machine
- [ ] Create K8s secret from `~/.claude/`

### Docker (Phase 4)
- [ ] Build image
- [ ] Push to iiusacr

### Kubernetes (Phase 5)
- [ ] Create namespace
- [ ] Create service account with CLIENT_ID annotation
- [ ] Create github-app secret
- [ ] Apply claude-session secret
- [ ] Deploy agent pod

### Verify (Phase 6)
- [ ] Azure Workload Identity works
- [ ] Claude commands work
- [ ] GitHub auth works
- [ ] End-to-end agent test passes

---

*Version: 4.6.0*  
*Environment: II-US Production (rg_prod / dev-aks)*  
*Auth: Claude Max + Workload Identity + GitHub App*
