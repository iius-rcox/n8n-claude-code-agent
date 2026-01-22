# Quickstart Guide - Dashboard UX Improvements

**Feature**: 014-dashboard-ux
**Phase**: 1 - Developer Setup
**Created**: 2026-01-21

## Overview

This guide helps developers set up their local environment to implement the Dashboard UX Improvements feature. Follow these steps sequentially to ensure all dependencies are installed and the development environment is properly configured.

## Prerequisites

Ensure you have the following installed:

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Docker**: For local Azure Blob Storage emulation (Azurite)
- **Git**: Version control
- **Azure CLI**: For AKS cluster access (production testing only)
- **kubectl**: Kubernetes CLI (production testing only)

Verify installations:

```bash
node --version    # Should be v20.x.x
npm --version     # Should be 10.x.x
docker --version  # Any recent version
git --version     # Any recent version
```

## Repository Setup

### 1. Clone and Branch

```bash
# Navigate to project root
cd /Users/rogercox/n8n-claude-code-agent

# Ensure you're on main branch and up to date
git checkout main
git pull origin main

# Create feature branch (already exists from /speckit.specify)
git checkout 014-dashboard-ux

# Verify branch
git branch --show-current  # Should output: 014-dashboard-ux
```

### 2. Install Dependencies

Install dependencies for both frontend and backend:

```bash
# Root dependencies (if any)
npm install

# Dashboard backend dependencies
cd dashboard/backend
npm install

# Dashboard frontend dependencies
cd ../frontend
npm install

# Return to project root
cd ../..
```

Expected installation time: 2-3 minutes

## Development Environment Setup

### 3. Configure Environment Variables

#### Backend Configuration

Create `dashboard/backend/.env` file:

```bash
# Azure Blob Storage (local emulation)
AZURE_STORAGE_CONNECTION_STRING="<use-azurite-default-connection-string-from-docs>"

# Kubernetes (local - skip if not testing K8s features)
KUBECONFIG=~/.kube/config

# Teams Webhook (optional - use dummy URL for local dev)
TEAMS_WEBHOOK_URL=https://webhook.example.com/dummy

# n8n API (use production or local n8n instance)
N8N_API_URL=https://n8n.ii-us.com
N8N_API_KEY=your-api-key-here

# Server configuration
PORT=3001
NODE_ENV=development

# CORS (allow frontend dev server)
CORS_ORIGIN=http://localhost:5173
```

#### Frontend Configuration

Create `dashboard/frontend/.env` file:

```bash
# Backend API URL
VITE_API_URL=http://localhost:3001

# Azure AD Authentication (get from Azure portal)
VITE_AZURE_AD_CLIENT_ID=your-client-id
VITE_AZURE_AD_TENANT_ID=your-tenant-id

# WebSocket URL (for real-time updates)
VITE_WS_URL=ws://localhost:3001
```

**Note**: For Azure AD credentials, contact the infrastructure team or use the existing values from production.

### 4. Start Azure Blob Storage Emulator (Azurite)

```bash
# Install Azurite globally (if not already installed)
npm install -g azurite

# Start Azurite in a separate terminal
azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log

# Azurite will start on:
# - Blob service: http://127.0.0.1:10000
# - Queue service: http://127.0.0.1:10001
# - Table service: http://127.0.0.1:10002
```

Keep this terminal open while developing.

### 5. Seed Local Storage (Optional)

Create sample task envelopes for testing:

```bash
# Run the seed script (create this if it doesn't exist)
node dashboard/backend/scripts/seed-local-storage.js
```

This creates sample tasks in various states (stuck, normal, completed) for testing.

## Running the Development Servers

### 6. Start Backend Server

In a new terminal:

```bash
cd dashboard/backend
npm run dev

# Server will start on http://localhost:3001
# Hot reload enabled via tsx watch
```

Expected output:
```
[tsx] watching path(s): src/**/*
[tsx] starting: node --loader tsx/esm src/index.ts
Dashboard backend listening on port 3001
Connected to Azure Blob Storage
```

### 7. Start Frontend Server

In another new terminal:

```bash
cd dashboard/frontend
npm run dev

# Vite dev server will start on http://localhost:5173
```

Expected output:
```
VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 8. Access Dashboard

Open your browser to:
```
http://localhost:5173
```

You should see the Azure AD login screen. After authenticating, you'll be redirected to the dashboard.

## Verifying the Setup

### Health Checks

Test that all services are running:

```bash
# Backend health check
curl http://localhost:3001/health
# Expected: {"status":"healthy","timestamp":"2026-01-21T09:00:00Z"}

# Frontend accessible
curl http://localhost:5173
# Expected: HTML response

# Azurite blob service
curl http://127.0.0.1:10000/devstoreaccount1?restype=container&comp=list
# Expected: XML listing of containers
```

### Test API Endpoints

```bash
# Test token status endpoint
curl http://localhost:3001/api/auth/status
# Expected: {"authenticated":false,"method":"session","error":"Token not configured"}

# Test storage search (requires Azurite running)
curl "http://localhost:3001/api/storage/agent-state/search?query=TASK"
# Expected: {"query":"TASK","container":"agent-state","results":[],"matchCount":0,"totalCount":0}
```

## Development Workflow

### Making Changes

1. **Backend changes**: Edit files in `dashboard/backend/src/`
   - Server auto-reloads via `tsx watch`
   - Check terminal for compilation errors

2. **Frontend changes**: Edit files in `dashboard/frontend/src/`
   - Vite hot-reloads automatically
   - Check browser console for errors

### Running Tests

```bash
# Backend tests
cd dashboard/backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# Frontend tests
cd dashboard/frontend
npm test                    # Vitest unit tests
npm run test:watch          # Watch mode
npm run test:e2e            # Playwright E2E tests (requires built app)
```

### Linting and Formatting

```bash
# Backend
cd dashboard/backend
npm run lint                # ESLint
npm run lint:fix            # Auto-fix issues

# Frontend
cd dashboard/frontend
npm run lint                # ESLint
npm run lint:fix            # Auto-fix issues
```

## Feature-Specific Setup

### Working on Stuck Task Actions (User Story 1)

**Prerequisites**:
- n8n API access configured
- Sample stuck tasks in Azurite

**Setup**:
```bash
# Create sample stuck task envelope
cat > /tmp/azurite/agent-state/TASK-001/task-envelope.yml << EOF
task_id: TASK-001
title: Test stuck task
currentPhase: implementation
phases:
  implementation:
    startedAt: $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)
    executionId: '12345'
EOF
```

**Test in UI**:
1. Navigate to Pipeline Board
2. Task TASK-001 should appear as stuck (>30 min in phase)
3. Verify "Retry Task", "Why Stuck?", "Escalate" buttons appear

### Working on Token Expiration Countdown (User Story 2)

**Prerequisites**:
- Backend configured with session token
- Token status endpoint returns valid expiration

**Mock token expiration**:
```bash
# Modify backend to return mock expiration (30 minutes from now)
# Edit dashboard/backend/src/routes/auth.ts
```

**Test in UI**:
1. Navigate to Token Refresh panel
2. Verify countdown timer displays
3. Color should be green (>30 min remaining)

### Working on Task Age Heat Map (User Story 3)

**Prerequisites**:
- Multiple tasks with varying ages

**Create test data**:
```bash
# Create tasks of different ages
for hours in 0 2 5 13; do
  echo "Creating task aged ${hours}h"
  # Script to create task with specific age
done
```

**Test in UI**:
1. Navigate to Pipeline Board
2. Verify color-coded borders (green/yellow/orange/red)
3. Verify time-in-phase badges

### Working on Bulk Component Actions (User Story 4)

**Prerequisites**:
- kubectl configured for local Kind cluster OR mock K8s API

**Setup local Kubernetes**:
```bash
# Install Kind (Kubernetes in Docker)
brew install kind  # macOS
# or: curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64

# Create local cluster
kind create cluster --name dashboard-dev

# Deploy sample components
kubectl create namespace claude-agent
kubectl create deployment claude-code-agent --image=nginx -n claude-agent
kubectl create deployment auth-watchdog --image=nginx -n claude-agent
```

**Test in UI**:
1. Navigate to Health Panel
2. Verify checkboxes on component cards
3. Select multiple components
4. Click "Restart All" and verify confirmation dialog

### Working on File Search (User Story 5)

**Prerequisites**:
- Azurite running with sample blobs

**Seed test data**:
```bash
# Create sample blob structure
az storage blob upload \
  --account-name devstoreaccount1 \
  --container-name agent-state \
  --name TASK-001/envelope.json \
  --file sample.json \
  --connection-string "$AZURE_STORAGE_CONNECTION_STRING"

# Repeat for multiple files
```

**Test in UI**:
1. Navigate to Storage Browser
2. Select agent-state container
3. Type "TASK-001" in search field
4. Verify filtered results appear

## Common Issues and Solutions

### Issue: Backend fails to start with "Connection refused"

**Cause**: Azurite not running or wrong connection string

**Solution**:
```bash
# Verify Azurite is running
ps aux | grep azurite

# Restart Azurite
pkill azurite
azurite --silent --location /tmp/azurite
```

### Issue: Frontend shows "CORS error" in browser console

**Cause**: Backend CORS configuration doesn't allow frontend origin

**Solution**:
Edit `dashboard/backend/.env`:
```
CORS_ORIGIN=http://localhost:5173
```

Restart backend server.

### Issue: Azure AD authentication fails

**Cause**: Invalid client ID or tenant ID

**Solution**:
1. Verify `VITE_AZURE_AD_CLIENT_ID` and `VITE_AZURE_AD_TENANT_ID` in `dashboard/frontend/.env`
2. Contact infrastructure team for correct values
3. Alternatively, disable Azure AD for local dev (requires code modification)

### Issue: Tests fail with "MODULE_NOT_FOUND"

**Cause**: Dependencies not installed or outdated

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify Node version matches project requirements
node --version  # Should be v20.x
```

### Issue: Hot reload not working

**Cause**: File watcher limits exceeded (Linux)

**Solution**:
```bash
# Increase inotify watch limit (Linux only)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Production Testing (Optional)

### Accessing Production Dashboard

**Prerequisites**:
- Azure CLI authenticated
- AKS cluster access configured

**Steps**:
```bash
# Login to Azure
az login

# Get AKS credentials
az aks get-credentials \
  --resource-group rg_prod \
  --name dev-aks

# Verify kubectl access
kubectl get pods -n claude-agent

# Port-forward to dashboard (if needed)
kubectl port-forward -n ops-dashboard svc/ops-dashboard 8080:80
```

Access at: `http://localhost:8080`

### Testing Against Production APIs

**Caution**: Be careful when testing against production n8n and AKS. Avoid making destructive changes.

Update `dashboard/backend/.env`:
```
N8N_API_URL=https://n8n.ii-us.com
N8N_API_KEY=<production-key>
AZURE_STORAGE_CONNECTION_STRING=<production-connection-string>
```

## Next Steps

After completing setup:

1. Review the spec document: `specs/014-dashboard-ux/spec.md`
2. Review the data model: `specs/014-dashboard-ux/data-model.md`
3. Review API contracts: `specs/014-dashboard-ux/contracts/`
4. Read the research findings: `specs/014-dashboard-ux/research.md`
5. Begin implementation following the plan: `specs/014-dashboard-ux/plan.md`

## Getting Help

- **Spec questions**: Review `specs/014-dashboard-ux/spec.md`
- **Technical questions**: Review `specs/014-dashboard-ux/plan.md` and `research.md`
- **Infrastructure issues**: Contact II-US DevOps team
- **Azure AD issues**: Contact II-US Security team

## Useful Commands Reference

```bash
# Start all services (requires 3 terminals)
# Terminal 1: Azurite
azurite --silent --location /tmp/azurite

# Terminal 2: Backend
cd dashboard/backend && npm run dev

# Terminal 3: Frontend
cd dashboard/frontend && npm run dev

# Run tests
cd dashboard/backend && npm test
cd dashboard/frontend && npm test

# Build for production
cd dashboard/backend && npm run build
cd dashboard/frontend && npm run build

# Lint code
cd dashboard/backend && npm run lint
cd dashboard/frontend && npm run lint
```

## Environment Cleanup

When done developing:

```bash
# Stop all servers (Ctrl+C in each terminal)

# Stop Azurite
pkill azurite

# Clean Azurite data (optional)
rm -rf /tmp/azurite

# Unset environment variables (optional)
unset AZURE_STORAGE_CONNECTION_STRING
unset N8N_API_KEY
```
