# Implementation Plan: Docker Image

**Branch**: `004-docker-image` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-docker-image/spec.md`

## Summary

Build and publish a container image containing all required tooling (Azure CLI, GitHub CLI, Claude CLI, Node.js, jq, yq) with an HTTP server for n8n integration and authentication monitoring scripts. The image will be pushed to Azure Container Registry for Kubernetes deployment in Sprint 5.

## Technical Context

**Language/Version**: Node.js 20.x LTS (HTTP server), Bash (scripts)
**Primary Dependencies**: Azure CLI, GitHub CLI, Claude CLI (@anthropic-ai/claude-code), Node.js HTTP module
**Storage**: N/A (stateless container)
**Testing**: Manual verification via container shell and HTTP endpoints
**Target Platform**: Linux container (amd64) on Azure Kubernetes Service
**Project Type**: Container image with embedded scripts
**Performance Goals**: Health check response < 1s, build time < 10 minutes
**Constraints**: Non-root execution (UID 1000), graceful shutdown within 120s
**Scale/Scope**: Single replica deployment, ClusterIP service (internal only)

## Implementation Approach

**Type**: Hybrid

**Rationale**: Per Constitution VI (Pragmatic Automation):
- **Scripts**: The HTTP server (`server.js`) and auth check (`check-auth.sh`) run repeatedly in production (scheduled jobs, continuous service) - these MUST be scripted with proper error handling and exit codes
- **Runbook**: The Docker build and push is a one-time setup per version - documented CLI commands in `quickstart.md` are sufficient

**Artifacts**:
- `infra/docker/Dockerfile` - Container image definition
- `infra/docker/server.js` - HTTP server for health checks and prompt execution
- `infra/docker/check-auth.sh` - Authentication monitoring script
- `infra/docker/notify.sh` - Teams notification script
- `quickstart.md` - Build and push commands

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Spec-First Development
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Approved spec.md exists | ✅ PASS | `specs/004-docker-image/spec.md` validated |
| Technology-agnostic requirements | ✅ PASS | Spec describes outcomes (tools available, endpoints respond) |
| Measurable success criteria | ✅ PASS | 8 criteria with numeric thresholds (SC-001 to SC-008) |
| Independent user stories | ✅ PASS | Each story has independent test method |

### II. Security by Default
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Least privilege access | ✅ PASS | Non-root user (FR-006, SC-008) |
| Secrets management | ✅ PASS | Tokens mounted from K8s secrets (Sprint 3) |
| No hardcoded secrets | ✅ PASS | Webhook URL via environment variable |

### III. Phase Gates
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Specify → Plan sequence | ✅ PASS | spec.md complete, now in plan phase |
| Constitution Check | ✅ PASS | This section |

### IV. Infrastructure as Code
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Declarative configuration | ✅ PASS | Dockerfile + scripts in repository |
| Versioned deployments | ✅ PASS | Semantic version tag v4.6.2 (FR-015) |
| Reproducible builds | ✅ PASS | Dockerfile enables reproducible builds |

### V. Automation & Observability
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Health probes | ✅ PASS | `/health` endpoint (FR-007) |
| Graceful shutdown | ✅ PASS | SIGTERM handling (FR-009, FR-010) |
| Distinct exit codes | ✅ PASS | Exit codes 0 (success), 57 (auth failure) (FR-013) |
| Alerting integration | ✅ PASS | Teams webhook notification (FR-012, FR-014) |

### VI. Pragmatic Automation
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Repeated tasks scripted | ✅ PASS | HTTP server and auth check are scripted |
| One-time tasks documented | ✅ PASS | Build/push in quickstart.md |
| CI/CD ready | ✅ PASS | Scripts have proper exit codes |

**GATE STATUS**: ✅ ALL GATES PASS

## Project Structure

### Documentation (this feature)

```text
specs/004-docker-image/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (build/push commands)
├── contracts/           # Phase 1 output (HTTP API contracts)
│   └── http-api.yaml    # OpenAPI spec for /health and /run
├── checklists/
│   └── requirements.md  # Requirements traceability (complete)
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
infra/
└── docker/
    ├── Dockerfile           # Container image definition
    ├── server.js            # HTTP server (health + run endpoints)
    ├── check-auth.sh        # Authentication monitoring script
    └── notify.sh            # Teams notification script
```

**Structure Decision**: Container artifacts placed in `infra/docker/` following infrastructure-as-code pattern. Scripts are embedded in the image at build time.

## Complexity Tracking

> No violations requiring justification. All constitution gates pass.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
