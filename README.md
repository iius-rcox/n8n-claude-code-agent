# n8n-claude-code-agent

A production-ready Claude AI agent deployed on Azure Kubernetes Service (AKS) with n8n workflow integration for automated code generation and task execution.

## Overview

This project provides infrastructure for running Claude (Max subscription) as a containerized service that can be invoked via HTTP from n8n workflows. It includes:

- **HTTP Server**: REST API for prompt execution (`/run`) and health checks (`/health`)
- **Authentication Monitoring**: CronJob watchdog with Teams notifications on auth failures
- **Security Hardening**: Zero-trust networking, Workload Identity, read-only filesystem
- **Automated Testing**: Jest unit/integration tests with 80%+ coverage

## Architecture

```
┌─────────────┐     HTTP      ┌──────────────────┐     CLI      ┌─────────────┐
│   n8n       │ ──────────────│  Claude Agent    │──────────────│  Claude AI  │
│  Workflow   │   POST /run   │   (Pod)          │   claude -p  │  (Anthropic)│
└─────────────┘               └──────────────────┘              └─────────────┘
                                      │
                              ┌───────┴───────┐
                              │               │
                        ┌─────┴─────┐   ┌─────┴─────┐
                        │  Azure    │   │  GitHub   │
                        │  Storage  │   │  (CSI)    │
                        └───────────┘   └───────────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| HTTP Server | `infra/docker/server.js` | REST API for Claude execution |
| Auth Check | `infra/docker/check-auth.sh` | Validates Claude session tokens |
| Notifier | `infra/docker/notify.sh` | Teams webhook notifications |
| Dockerfile | `infra/docker/Dockerfile` | Container image definition |
| K8s Manifests | `infra/k8s/*.yaml` | Kubernetes deployment resources |

## Quick Start

### Prerequisites

- Azure subscription with AKS cluster
- Claude Max subscription with valid session tokens
- n8n instance in the same cluster
- kubectl configured for cluster access

### Deploy

```bash
# 1. Create namespace and service account
kubectl apply -f infra/k8s/namespace.yaml

# 2. Apply NetworkPolicies
kubectl apply -f infra/k8s/networkpolicy-default-deny.yaml
kubectl apply -f infra/k8s/networkpolicy-allow-dns.yaml
kubectl apply -f infra/k8s/networkpolicy-allow-azure.yaml
kubectl apply -f infra/k8s/networkpolicy-allow-n8n.yaml

# 3. Create secrets (see docs/operations.md for details)
kubectl create secret generic claude-session -n claude-agent --from-file="$HOME/.claude/"
kubectl create secret generic teams-webhook -n claude-agent --from-literal=url='YOUR_WEBHOOK_URL'

# 4. Apply SecretProviderClass and deployment
kubectl apply -f infra/k8s/secretproviderclass.yaml
kubectl apply -f infra/k8s/deployment.yaml
kubectl apply -f infra/k8s/service.yaml

# 5. Deploy auth watchdog
kubectl apply -f infra/k8s/cronjob.yaml
```

### Verify

```bash
# Check pod status
kubectl get pods -n claude-agent

# Test health endpoint
kubectl port-forward -n claude-agent svc/claude-agent 8080:80
curl http://localhost:8080/health
```

## API Reference

### POST /run

Execute a Claude prompt.

**Request:**
```json
{
  "prompt": "Your prompt text here",
  "timeout": 300000,
  "workdir": "/workspace"
}
```

**Response (Success):**
```json
{
  "success": true,
  "output": "Claude's response...",
  "exitCode": 0,
  "duration": 1234
}
```

**Response (Auth Failure):**
```json
{
  "success": false,
  "error": "Claude session tokens expired or invalid",
  "exitCode": 57,
  "duration": 500
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "activeRequests": 0
}
```

## Exit Codes

| Code | Meaning | n8n Action |
|------|---------|------------|
| 0 | Success | Continue workflow |
| 1 | General error | Alert operations |
| 57 | Auth failure | Pause workflows, alert |
| 124 | Timeout | Retry or alert |

## Development

### Run Tests

```bash
# Install dependencies
npm install

# Run all tests with coverage
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run shell script tests (requires BATS)
npm run test:scripts

# Run all tests
npm run test:all
```

### Build Container

```bash
cd infra/docker
docker build -t iiusacr.azurecr.io/claude-agent:v4.6.4 .
docker push iiusacr.azurecr.io/claude-agent:v4.6.4
```

## Project Structure

```
n8n-claude-code-agent/
├── infra/
│   ├── docker/           # Container image and scripts
│   │   ├── Dockerfile
│   │   ├── server.js     # HTTP server
│   │   ├── check-auth.sh # Auth validation
│   │   └── notify.sh     # Teams notifications
│   └── k8s/              # Kubernetes manifests
│       ├── namespace.yaml
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── cronjob.yaml
│       ├── secretproviderclass.yaml
│       └── networkpolicy-*.yaml
├── tests/
│   ├── unit/             # Jest unit tests
│   ├── integration/      # Jest integration tests
│   ├── scripts/          # BATS shell tests
│   ├── mocks/            # Test mocks
│   └── fixtures/         # Test data
├── specs/                # Feature specifications (001-008)
├── docs/                 # Operational documentation
├── .github/workflows/    # CI/CD pipelines
├── package.json
├── jest.config.js
└── README.md
```

## Security

### Network Policies

- **Default Deny**: All traffic blocked by default
- **Allow DNS**: Egress to kube-dns (UDP/TCP 53)
- **Allow Azure**: Egress to Azure services (TCP 443)
- **Allow n8n**: Ingress from n8n namespace (TCP 3000)

### Container Security

- Non-root user (UID 1001)
- Read-only root filesystem
- Dropped all capabilities
- Seccomp profile: RuntimeDefault
- No privilege escalation

### Authentication

- **Azure**: Workload Identity with federated credentials
- **GitHub**: App credentials via CSI Driver from Key Vault
- **Claude**: Session tokens from Kubernetes secret

## Token Refresh

When Claude session tokens expire (exit code 57), follow these steps to refresh authentication:

### 1. Re-authenticate Claude CLI locally

```powershell
# On your local machine with Claude Max subscription
claude /login
```

### 2. Delete the old Kubernetes secret

```bash
kubectl delete secret claude-session -n claude-agent
```

### 3. Create new secret from fresh tokens

```bash
kubectl create secret generic claude-session -n claude-agent \
  --from-file=credentials.json=$HOME/.claude/.credentials.json \
  --from-file=settings.json=$HOME/.claude/settings.json
```

### 4. Restart the deployment

```bash
kubectl rollout restart deployment/claude-agent -n claude-agent
```

### 5. Verify authentication

```bash
kubectl exec -n claude-agent deploy/claude-agent -- claude -p "Say: auth test" --max-turns 1
```

You should see a successful response from Claude.

## Monitoring

### Auth Watchdog

A CronJob runs every 30 minutes to validate Claude authentication:
- On success: Silent (exit 0)
- On failure: Teams notification sent (exit 57)

### Health Checks

- **Liveness Probe**: GET /health every 30s (fails after 3 attempts)
- **Readiness Probe**: GET /health every 10s (fails after 3 attempts)

## Documentation

| Document | Purpose |
|----------|---------|
| [Operations Guide](docs/operations.md) | Day-to-day operational procedures |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |
| [Architecture](docs/architecture.md) | Detailed system design |

## Sprint History

| Sprint | Feature | Status |
|--------|---------|--------|
| S1 | Azure Infrastructure | Complete |
| S2 | GitHub App | Complete |
| S3 | Claude Session Tokens | Complete |
| S4 | Docker Image | Complete |
| S5 | Kubernetes Deployment | Complete |
| S6 | Verification | Complete |
| S7 | Teams Prompting | Complete |
| S8 | Automated Testing | Complete |

## License

ISC

## Contributing

This project uses spec-driven development. See `.specify/memory/constitution.md` for governance rules.
