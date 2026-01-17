# Claude Code Agent Operations Dashboard

## Overview

This project provides a Kubernetes-deployed Claude Code agent with an operations dashboard for managing and monitoring the agent in a production environment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Kubernetes Service                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   ops-dashboard     │    │      claude-agent               │ │
│  │   namespace         │    │      namespace                  │ │
│  │                     │    │                                 │ │
│  │  ┌───────────────┐  │    │  ┌───────────────────────────┐  │ │
│  │  │  Dashboard    │  │───▶│  │  Claude Code Agent        │  │ │
│  │  │  (React +     │  │    │  │  (Node.js HTTP server     │  │ │
│  │  │   Express)    │  │    │  │   + Claude CLI)           │  │ │
│  │  └───────────────┘  │    │  └───────────────────────────┘  │ │
│  │                     │    │                                 │ │
│  └─────────────────────┘    │  ┌───────────────────────────┐  │ │
│                             │  │  Auth Watchdog CronJob    │  │ │
│                             │  │  (Every 30 min)           │  │ │
│                             │  └───────────────────────────┘  │ │
│                             └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Claude Code Agent (`/infra`)

A containerized Claude CLI agent that:
- Runs in a security-hardened Kubernetes pod
- Exposes an HTTP API for prompt execution
- Uses `--dangerously-skip-permissions` flag for non-interactive operation
- Authenticates via long-lived OAuth token stored in Kubernetes secret

**Key Files:**
- `/infra/docker/Dockerfile` - Agent container image
- `/infra/docker/server.js` - HTTP server wrapping Claude CLI
- `/infra/k8s/deployment.yaml` - Kubernetes deployment manifest

### 2. Operations Dashboard (`/dashboard`)

A React + Express application providing:
- **System Health** - Real-time pod status monitoring
- **Authentication Management** - OAuth token configuration UI
- **Auth Watchdog CronJob** - Periodic auth verification status
- **Prompt Executor** - Ad-hoc prompt execution interface
- **Execution History** - Record of past executions

**Key Features:**
- Azure AD authentication (MSAL)
- Collapsible panels with smart defaults (expand on issues)
- Real-time polling for status updates

**Structure:**
```
/dashboard
├── frontend/          # React + Vite + TypeScript
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Dashboard page
│       └── services/     # API client
├── backend/           # Express + TypeScript
│   └── src/
│       ├── api/          # REST routes
│       └── services/     # K8s client, token refresh
└── infra/k8s/         # Dashboard K8s manifests
```

### 3. Auth Watchdog CronJob

A Kubernetes CronJob that:
- Runs every 30 minutes
- Verifies Claude authentication is working
- Sends Teams webhook alerts on auth failure

## Authentication Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Local      │     │   Dashboard     │     │  Claude Agent    │
│   Terminal   │     │   (Browser)     │     │  (K8s Pod)       │
└──────┬───────┘     └────────┬────────┘     └────────┬─────────┘
       │                      │                       │
       │ claude setup-token   │                       │
       │ ───────────────────▶ │                       │
       │                      │                       │
       │ Copy token           │                       │
       │ ◀─────────────────── │                       │
       │                      │                       │
       │                      │ Paste token in UI     │
       │                      │ ─────────────────────▶│
       │                      │                       │
       │                      │ Create K8s secret     │
       │                      │ Restart pod           │
       │                      │ ─────────────────────▶│
       │                      │                       │
       │                      │ Verify auth working   │
       │                      │ ◀─────────────────────│
```

## Deployment

### Prerequisites
- Azure Kubernetes Service cluster
- Azure Container Registry
- Azure AD app registration
- DNS configured for dashboard URL

### Deploy Commands
```bash
# Build and push Claude agent
docker build --platform linux/amd64 -t iiusacr.azurecr.io/claude-agent:v4.6.5 -f infra/docker/Dockerfile infra/docker/
docker push iiusacr.azurecr.io/claude-agent:v4.6.5
kubectl apply -f infra/k8s/

# Build and push Dashboard
cd dashboard
docker build --platform linux/amd64 \
  --build-arg VITE_AZURE_AD_CLIENT_ID=<client-id> \
  --build-arg VITE_AZURE_AD_TENANT_ID=<tenant-id> \
  -t iiusacr.azurecr.io/ops-dashboard:v1.0.19 .
docker push iiusacr.azurecr.io/ops-dashboard:v1.0.19
kubectl apply -f infra/k8s/
```

## Current Versions
- Claude Agent: `v4.6.5`
- Dashboard: `v1.0.19`

## Dashboard URL
https://ops-dashboard.ii-us.com
