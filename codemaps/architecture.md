# Architecture Codemap

**Freshness:** 2026-01-26T00:00:00Z

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  dashboard/frontend/ - Vite + React 18 + Tailwind + Radix UI   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (fetch)
┌─────────────────────────▼───────────────────────────────────────┐
│                     Backend API (Express)                       │
│  dashboard/backend/ - Node.js + TypeScript + JWT Auth          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Claude Agent  │ │ Kubernetes    │ │ Azure AD      │
│ Pod (HTTP)    │ │ API           │ │ (MSAL/OIDC)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Directory Structure

```
n8n-claude-code-agent/
├── dashboard/
│   ├── backend/          # Express API server
│   └── frontend/         # React SPA
├── infra/
│   ├── docker/           # Container config + server.js
│   └── k8s/              # Kubernetes manifests
├── specs/                # Feature specifications (SDD)
├── tests/                # Jest + BATS test suites
├── .claude/              # Claude Code CLI config
└── .specify/             # Spec-driven development tools
```

## Key Entry Points

| Component | Entry Point | Port |
|-----------|-------------|------|
| Backend API | `dashboard/backend/src/index.ts` | 3000 |
| Frontend | `dashboard/frontend/src/main.tsx` | 5173 (dev) |
| Claude Server | `infra/docker/server.js` | 3000 |

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS, Radix UI |
| Backend | Node.js 20+, Express 4, TypeScript, @kubernetes/client-node |
| Auth | Azure AD (MSAL), JWT, JWKS validation |
| Infra | Kubernetes (AKS), Docker, Azure Key Vault (CSI) |
| Testing | Jest 29, Vitest, Playwright, BATS |

## Service Communication

```
Frontend → Backend API → Claude Agent Service → Claude CLI
                      → Kubernetes Service → K8s API
                      → Token Refresh Service → Secrets
```

## Authentication Flow

1. Frontend: MSAL interactive login → Azure AD
2. Backend: JWT validation via JWKS endpoint
3. Group membership check (optional)
4. Bearer token in Authorization header

## Security Hardening (K8s)

- Non-root user (UID 1001)
- Read-only root filesystem
- All capabilities dropped
- Seccomp: RuntimeDefault
- Zero-trust network policies
