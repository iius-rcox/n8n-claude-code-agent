# Quickstart: Docker Image

**Feature**: 004-docker-image
**Prerequisites**: Docker Desktop, Azure CLI logged in, access to iiusacr registry
**Time**: ~15 minutes

---

## Step 1: Verify Prerequisites

```powershell
# Check Docker is running
docker version

# Check Azure CLI is logged in
az account show

# Check access to ACR
az acr show --name iiusacr --query "name" -o tsv
```

**Expected**: All commands return without errors. ACR name is `iiusacr`.

---

## Step 2: Create Directory Structure

```powershell
# Create infra/docker directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "C:\Users\rcox\n8n-claude-code-agent\infra\docker"
```

**Expected**: Directory `infra/docker` exists.

---

## Step 3: Create Dockerfile

Create the file `infra/docker/Dockerfile` with the content from tasks.md implementation.

**Key components**:
- Base image: `ubuntu:24.04`
- Installed tools: Azure CLI, GitHub CLI, Claude CLI, Node.js 20.x, jq, yq
- Non-root user: `claude-agent` (UID 1000)
- Scripts: `server.js`, `check-auth.sh`, `notify.sh`

---

## Step 4: Create HTTP Server Script

Create the file `infra/docker/server.js` implementing:
- `/health` endpoint (GET)
- `/run` endpoint (POST)
- Graceful shutdown with SIGTERM handling
- Active request tracking

---

## Step 5: Create Auth Check Script

Create the file `infra/docker/check-auth.sh` implementing:
- Claude authentication test via simple prompt
- Exit code 0 on success, 57 on failure
- Trigger notification script on failure

---

## Step 6: Create Notification Script

Create the file `infra/docker/notify.sh` implementing:
- Teams webhook POST with Adaptive Card format
- Include pod name and timestamp
- Link to refresh documentation

---

## Step 7: Build Docker Image

```powershell
# Navigate to docker directory
cd "C:\Users\rcox\n8n-claude-code-agent\infra\docker"

# Build the image with version tag
docker build -t iiusacr.azurecr.io/claude-agent:v4.6.2 .

# Verify build completed
docker images | Select-String "claude-agent"
```

**Expected**: Image `iiusacr.azurecr.io/claude-agent:v4.6.2` appears in list.

**Success Criteria**: SC-001 - Build completes in under 10 minutes.

---

## Step 8: Verify Container Tools

```powershell
# Run container and verify tools are available
docker run --rm iiusacr.azurecr.io/claude-agent:v4.6.2 sh -c "
  echo '=== Tool Versions ==='
  az --version | head -1
  gh --version
  claude --version
  node --version
  jq --version
  yq --version
  echo '=== User Check ==='
  whoami
  id
"
```

**Expected**:
- All 6 tools print version information
- `whoami` returns `claude-agent`
- `id` shows `uid=1001(claude-agent) gid=1001(claude-agent)`

**Success Criteria**: SC-002 (all tools present), SC-008 (non-root user).

---

## Step 9: Test Health Endpoint

```powershell
# Start container in background
$containerId = docker run -d -p 3000:3000 iiusacr.azurecr.io/claude-agent:v4.6.2

# Wait for startup
Start-Sleep -Seconds 3

# Test health endpoint
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get

# Stop container
docker stop $containerId
```

**Expected**: JSON response with `status: "healthy"`.

**Success Criteria**: SC-003 - Response within 1 second.

---

## Step 10: Login to Azure Container Registry

```powershell
# Login to ACR (uses Azure CLI credentials)
az acr login --name iiusacr
```

**Expected**: "Login Succeeded" message.

---

## Step 11: Push Image to Registry

```powershell
# Push image to ACR
docker push iiusacr.azurecr.io/claude-agent:v4.6.2
```

**Expected**: Push completes with layer upload progress.

**Success Criteria**: SC-007 - Available in registry within 5 minutes.

---

## Step 12: Verify Image in Registry

```powershell
# List tags in repository
az acr repository show-tags --name iiusacr --repository claude-agent --output table

# Get image digest
az acr repository show --name iiusacr --image claude-agent:v4.6.2 --query "digest" -o tsv
```

**Expected**:
- Tag `v4.6.2` appears in list
- Digest returned (sha256:...)

---

## Verification Checklist

| Step | Verification | Expected |
|------|--------------|----------|
| Prerequisites | `docker version` | Version displayed |
| Build | `docker images` | Image listed |
| Tools | Version commands | 6 tools respond |
| Non-root | `whoami` | `claude-agent` |
| Health | `/health` request | JSON response |
| Push | `docker push` | Completes |
| Registry | ACR tags query | `v4.6.2` listed |

---

## Outputs for Sprint 5

Save this information for Sprint 5 (Kubernetes Deployment):

| Output | Value | Use |
|--------|-------|-----|
| Image | `iiusacr.azurecr.io/claude-agent:v4.6.2` | Deployment container spec |
| Port | `3000` | Service and probe configuration |
| Health Path | `/health` | Liveness/readiness probes |
| Run Path | `/run` | n8n HTTP Request node |
| User UID | `1001` | Security context (Ubuntu 24.04 reserves UID 1000) |

---

## Troubleshooting

### "Cannot connect to Docker daemon"

Docker Desktop is not running.

```powershell
# Start Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### "unauthorized: authentication required" on push

ACR login expired. Re-run Step 10.

### Build fails with "network unreachable"

Check internet connectivity. Azure CLI and npm require external access during build.

### Health endpoint returns connection refused

Server may not have started. Check container logs:

```powershell
docker logs $containerId
```

### "exit code 57" from auth check

Claude session tokens are not mounted or expired. This is expected when running locally without session files.

---

## Cleanup (Development)

After testing, remove local images to free disk space:

```powershell
# Remove local image (keeps registry copy)
docker rmi iiusacr.azurecr.io/claude-agent:v4.6.2

# Prune unused images
docker image prune -f
```

---

## Image Update Procedure

When updating the image for a new version:

1. Update version tag in Dockerfile and commands (e.g., `v4.6.3`)
2. Rebuild: `docker build -t iiusacr.azurecr.io/claude-agent:v4.6.3 .`
3. Push: `docker push iiusacr.azurecr.io/claude-agent:v4.6.3`
4. Update Kubernetes deployment (Sprint 5) with new tag
5. Rollout: `kubectl rollout restart deployment/claude-code-agent -n claude-agent`
