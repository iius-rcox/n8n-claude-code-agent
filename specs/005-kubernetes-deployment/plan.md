# Implementation Plan: Kubernetes Deployment

**Branch**: `005-kubernetes-deployment` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-kubernetes-deployment/spec.md`

## Summary

Deploy the Claude Code Agent to Azure Kubernetes Service (AKS) with full security hardening. This includes creating a dedicated namespace with Workload Identity-enabled service account, applying defense-in-depth NetworkPolicies (default-deny with explicit allow rules), mounting secrets via CSI Driver and Kubernetes secrets, and deploying the container with read-only filesystem, dropped capabilities, and graceful shutdown handling.

## Technical Context

**Language/Version**: Kubernetes YAML manifests (API version v1, networking.k8s.io/v1, secrets-store.csi.x-k8s.io/v1)
**Primary Dependencies**: Azure Kubernetes Service (AKS), Azure Workload Identity, Secrets Store CSI Driver, Azure Key Vault
**Storage**: N/A (secrets mounted from Key Vault, session tokens from K8s secrets)
**Testing**: kubectl apply --dry-run=client, kubectl describe, curl health endpoint
**Target Platform**: Azure Kubernetes Service (dev-aks cluster in rg_prod, southcentralus)
**Project Type**: Infrastructure manifests (IaC)
**Performance Goals**: Pod ready within 5 minutes, health endpoint response < 1 second
**Constraints**: Non-root execution (UID 1001), read-only root filesystem, default-deny networking
**Scale/Scope**: Single replica deployment, 4 NetworkPolicies, 1 SecretProviderClass, 3 secrets

## Implementation Approach

**Type**: Hybrid

**Rationale**: Per Constitution VI (Pragmatic Automation):
- **Manifests (versioned YAML)**: Kubernetes resources MUST be declarative and version-controlled
- **Runbook (quickstart.md)**: kubectl apply commands are one-time setup; documenting in runbook is clearer than wrapper scripts
- **No wrapper scripts needed**: kubectl is idempotent, manifests are self-documenting

**Artifacts**:
- Kubernetes manifests in `infra/k8s/` directory
- Runbook in `quickstart.md` with step-by-step kubectl commands
- No shell scripts created (Constitution VI: one-time tasks → runbook)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Spec-First Development** | PASS | spec.md approved with 5 user stories, 20 FRs, 8 SCs |
| **II. Security by Default** | PASS | Default-deny NetworkPolicy (FR-004), Workload Identity (FR-002/003), CSI Driver for secrets (FR-008), non-root (FR-012), capabilities dropped (FR-015) |
| **III. Phase Gates** | PASS | Progressing Specify → Plan per workflow |
| **IV. Infrastructure as Code** | PASS | All manifests stored in `infra/k8s/`, versioned in git, no manual portal changes |
| **V. Automation & Observability** | PASS | Health probes on deployment, graceful shutdown (FR-016/017), distinct exit codes in container |
| **VI. Pragmatic Automation** | PASS | Hybrid approach: manifests + runbook, no unnecessary wrapper scripts |

### Security Requirements Check

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Network Security | PASS | Default-deny + explicit allow policies (FR-004 through FR-007) |
| Identity & Access | PASS | Workload Identity (FR-002/003), CSI Driver (FR-008), no static credentials |
| Container Security | PASS | Non-root UID 1001 (FR-012), readOnlyRootFilesystem (FR-013), seccomp (FR-014), no privilege escalation (FR-015) |

### Deployment Standards Check

| Standard | Status | Evidence |
|----------|--------|----------|
| Branch naming | PASS | `005-kubernetes-deployment` follows `###-feature-name` |
| Artifact location | PASS | All artifacts in `specs/005-kubernetes-deployment/` |
| Image tags | PASS | Semantic version `v4.6.2` (FR-011) |
| Resource requests | PASS | Will be specified in deployment manifest |
| Termination grace | PASS | 120 seconds (FR-016), preStop hook (FR-017) |

**Gate Status**: PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-kubernetes-deployment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (runbook)
├── contracts/           # Phase 1 output (manifest schemas)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
infra/
├── docker/              # Sprint 4: Container image files
│   ├── Dockerfile
│   ├── server.js
│   ├── check-auth.sh
│   └── notify.sh
└── k8s/                 # Sprint 5: Kubernetes manifests (NEW)
    ├── namespace.yaml           # Namespace + ServiceAccount
    ├── networkpolicy-default-deny.yaml
    ├── networkpolicy-allow-dns.yaml
    ├── networkpolicy-allow-azure.yaml
    ├── networkpolicy-allow-n8n.yaml
    ├── secretproviderclass.yaml # CSI Driver for GitHub credentials
    ├── deployment.yaml          # Main workload with security hardening
    └── service.yaml             # ClusterIP for n8n access
```

**Structure Decision**: Infrastructure manifests pattern - all Kubernetes YAML in `infra/k8s/` following the existing `infra/docker/` convention established in Sprint 4.

## Complexity Tracking

> No violations to justify - all Constitution gates passed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
