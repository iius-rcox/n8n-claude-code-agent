# Research: Docker Image

**Feature**: 004-docker-image
**Date**: 2026-01-14
**Status**: Complete

## Research Topics

This document consolidates research findings for technical decisions in the Docker Image feature.

---

## R1: Base Image Selection

**Question**: What base image should be used for the Claude agent container?

**Decision**: `ubuntu:24.04`

**Rationale**:
- Azure CLI, GitHub CLI, and Claude CLI all have well-tested installation paths on Ubuntu
- Ubuntu 24.04 LTS provides security updates until 2029
- Node.js 20.x LTS has official Ubuntu packages
- Simpler debugging and troubleshooting vs. Alpine (glibc vs. musl)

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| `alpine:3.19` | Azure CLI installation complex; musl compatibility issues with some npm packages |
| `node:20-slim` | Would need to add Azure CLI and GitHub CLI; larger final image |
| `mcr.microsoft.com/azure-cli` | Missing Node.js and GitHub CLI; would need multi-stage build |
| `gcr.io/distroless/nodejs` | Cannot run shell scripts; no package manager for CLI tools |

---

## R2: Node.js HTTP Server Pattern

**Question**: How should the HTTP server handle graceful shutdown with in-flight requests?

**Decision**: Track active requests with counter + SIGTERM handler

**Rationale**:
- Node.js native `http` module is lightweight (no Express overhead)
- Active request counter allows waiting for completion before exit
- 120-second termination grace period matches Kubernetes default
- `spawnSync` for Claude CLI prevents zombie processes and exit code 143

**Implementation Pattern**:
```javascript
let activeRequests = 0;
let isShuttingDown = false;

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (activeRequests === 0) process.exit(0);
});

// On request start: activeRequests++
// On request end: activeRequests--; if (isShuttingDown && activeRequests === 0) exit(0)
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Express.js | Unnecessary dependency; adds ~50MB to image |
| Fastify | Same as Express; overkill for 2 endpoints |
| Cluster mode | Single replica design; no benefit |

---

## R3: Claude CLI Installation Method

**Question**: How should Claude CLI be installed in the container?

**Decision**: Global npm install (`npm install -g @anthropic-ai/claude-code`)

**Rationale**:
- Claude CLI is published as npm package `@anthropic-ai/claude-code`
- Global install puts `claude` binary in PATH automatically
- Node.js is already required for HTTP server
- Consistent with local development installation

**Version Pinning**: Use specific version in Dockerfile for reproducibility:
```dockerfile
RUN npm install -g @anthropic-ai/claude-code@2.x
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Download binary directly | No official binary releases; npm is the distribution method |
| Volume mount from host | Would require host to have Claude CLI; not portable |
| Build from source | Adds build dependencies; increases image size |

---

## R4: Non-Root User Configuration

**Question**: How should the non-root user be configured?

**Decision**: Create `claude-agent` user with UID 1000

**Rationale**:
- UID 1000 is standard for first non-root user
- Matches Kubernetes `runAsUser: 1000` security context
- Home directory `/home/claude-agent` provides `.claude/` session mount point
- Group ID 1000 matches `fsGroup` for volume permissions

**Implementation**:
```dockerfile
RUN groupadd -g 1000 claude-agent && \
    useradd -u 1000 -g 1000 -m -s /bin/bash claude-agent
USER claude-agent
WORKDIR /home/claude-agent
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| `nobody` user | No home directory; cannot mount session files |
| UID 65534 | Non-standard; would require Kubernetes config changes |
| Dynamic UID | OpenShift pattern; adds complexity without benefit on AKS |

---

## R5: Exit Code Strategy

**Question**: What exit codes should be used for different failure modes?

**Decision**: Follow existing project exit code convention

**Rationale**:
- Exit code 57 for authentication failure (already established in project)
- Exit code 0 for success (standard)
- Exit code 1 for general errors (standard)
- Consistent with n8n workflow error handling

**Exit Codes**:
| Code | Meaning | Handler |
|------|---------|---------|
| 0 | Success | Continue workflow |
| 1 | General error | Alert + retry |
| 57 | Authentication failure | Notify + pause |
| 124 | Timeout | Alert + retry |

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| HTTP status codes only | Would lose exit code granularity for scripts |
| Custom exit codes (200+) | Non-portable; some shells truncate to 8 bits |

---

## R6: Teams Notification Format

**Question**: How should authentication failure notifications be formatted?

**Decision**: Adaptive Card format with action buttons

**Rationale**:
- Adaptive Cards provide rich formatting in Teams
- Action buttons can link directly to refresh documentation
- Structured format easier to parse than plain text
- Consistent with enterprise notification patterns

**Message Template**:
```json
{
  "@type": "MessageCard",
  "summary": "Claude Agent Auth Failure",
  "sections": [{
    "activityTitle": "🔴 Authentication Failed",
    "facts": [
      { "name": "Pod", "value": "${POD_NAME}" },
      { "name": "Time", "value": "${TIMESTAMP}" }
    ],
    "text": "Claude session tokens have expired. Follow the refresh procedure."
  }],
  "potentialAction": [{
    "@type": "OpenUri",
    "name": "View Refresh Steps",
    "targets": [{ "os": "default", "uri": "${DOCS_URL}" }]
  }]
}
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Plain text | Less readable; no action buttons |
| Email notification | Slower delivery; requires SMTP setup |
| PagerDuty | Overkill for non-critical auth refresh |

---

## R7: Azure Container Registry Authentication

**Question**: How should the build machine authenticate to ACR for push?

**Decision**: Azure CLI login with current user credentials

**Rationale**:
- `az acr login` handles token acquisition automatically
- Works with existing Azure authentication from Sprint 1
- No additional service principal required for manual builds
- Kubernetes will use Workload Identity for pulls (Sprint 5)

**Commands**:
```bash
az login  # If not already logged in
az acr login --name iiusacr
docker push iiusacr.azurecr.io/claude-agent:v4.6.2
```

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Admin credentials | Less secure; not recommended for production |
| Service principal | Adds complexity for one-time push |
| ACR Tasks | Good for CI/CD but overkill for manual build |

---

## Summary

All technical decisions resolved. No NEEDS CLARIFICATION items remain.

| Topic | Decision | Risk Level |
|-------|----------|------------|
| Base Image | ubuntu:24.04 | Low |
| HTTP Server | Native Node.js with request tracking | Low |
| Claude CLI | npm global install | Low |
| Non-Root User | claude-agent UID 1000 | Low |
| Exit Codes | 0/1/57/124 convention | Low |
| Notifications | Teams Adaptive Card | Low |
| ACR Auth | az acr login | Low |

**Ready for Phase 1**: data-model.md, contracts/, quickstart.md
