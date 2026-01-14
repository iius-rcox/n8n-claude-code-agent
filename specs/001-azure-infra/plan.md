# Implementation Plan: Azure Infrastructure Foundation

**Branch**: `001-azure-infra` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-azure-infra/spec.md`

## Summary

Establish all Azure resources required for Workload Identity and secure storage access for the Claude agent system. This includes creating a hardened storage account with network isolation, a user-assigned managed identity with federated credentials for AKS, RBAC role assignments scoped to specific resources, and enabling the Secrets Store CSI Driver for Key Vault integration.

## Technical Context

**Language/Version**: Azure CLI 2.x, Bash/PowerShell commands
**Primary Dependencies**: Azure Resource Manager, Azure Workload Identity, Secrets Store CSI Driver
**Storage**: Azure Blob Storage (Standard_LRS, StorageV2)
**Testing**: Azure CLI verification commands, kubectl exec validation
**Target Platform**: Azure AKS (dev-aks cluster in rg_prod)
**Project Type**: Infrastructure as Code (Azure CLI scripts)
**Performance Goals**: Authentication within 30 seconds of pod startup
**Constraints**: TLS 1.2+, default-deny network, least-privilege RBAC
**Scale/Scope**: Single storage account, single managed identity, 6 blob containers

### Azure Environment (Existing)

| Resource | Value |
|----------|-------|
| Subscription ID | `a78954fe-f6fe-4279-8be0-2c748be2f266` |
| Tenant ID | `953922e6-5370-4a01-a3d5-773a30df726b` |
| Resource Group | `rg_prod` |
| Region | `southcentralus` |
| AKS Cluster | `dev-aks` |
| Key Vault | `iius-akv` |

### Resources to Create

| Resource | Name | Purpose |
|----------|------|---------|
| Storage Account | `iiusagentstore` | Agent state and artifacts |
| Managed Identity | `claude-agent-identity` | Workload Identity for pods |
| Federated Credential | `claude-agent-fed-cred` | K8s service account binding |
| Blob Containers (6) | `agent-*` | Workflow phase storage |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Spec-First Development

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Spec Before Code | PASS | spec.md created and approved before plan.md |
| Technology-Agnostic Requirements | PASS | Spec describes outcomes (secure access, network isolation) not implementation |
| Measurable Success Criteria | PASS | 8 measurable criteria (SC-001 through SC-008) |
| Independent User Stories | PASS | 3 user stories, each independently testable |

### II. Security by Default

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Zero Trust Networking | PASS | FR-003: default-deny storage, FR-010: explicit subnet allowlist |
| Least Privilege Access | PASS | FR-006/007: roles scoped to specific resources, not RG |
| Secrets Management | PASS | FR-009: CSI Driver enabled for Key Vault mounting |
| Encryption in Transit | PASS | FR-002: TLS 1.2+ enforced |

### III. Phase Gates (NON-NEGOTIABLE)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Specify → Plan → Tasks → Implement | PASS | Currently in Plan phase after Spec completion |
| No Skipping Phases | PASS | Following prescribed sequence |
| Constitution Check | PASS | This section |
| Checkpoint Validation | PASS | Clarification session completed |

### IV. Infrastructure as Code

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Declarative Configuration | PASS | All resources defined as Azure CLI commands |
| No Manual Changes | PASS | SC-007/008: reproducible from scripts |
| Versioned Deployments | N/A | No container images in this phase |
| Reproducible Environments | PASS | SC-008: recreatable within 15 minutes |

### V. Automation & Observability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Health Probes | N/A | No long-running services in this phase |
| Graceful Shutdown | N/A | No long-running services in this phase |
| Distinct Exit Codes | PASS | Scripts will use standard exit codes |
| Alerting Integration | PASS | FR-012: Teams notifications via n8n |

**Constitution Check Result**: **PASS** - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-azure-infra/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (Azure resource relationships)
├── quickstart.md        # Phase 1 output (deployment runbook)
├── contracts/           # Phase 1 output (N/A - no API contracts)
│   └── .gitkeep
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Implementation Approach

**Type**: Runbook

**Rationale**: One-time infrastructure setup per Constitution VI. CLI commands are documented in `quickstart.md` as an 8-step runbook executed directly via terminal. No wrapper scripts needed.

**Artifacts**:
- Runbook: `quickstart.md` (step-by-step CLI commands)
- Tasks: Reference quickstart.md step numbers

**Structure Decision**: Direct CLI execution following quickstart.md. The quickstart.md serves as both documentation and reproducible instructions (satisfies SC-007, SC-008).

## Complexity Tracking

> No Constitution violations requiring justification. All requirements align with principles.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
