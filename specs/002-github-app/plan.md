# Implementation Plan: GitHub App Integration

**Branch**: `002-github-app` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-github-app/spec.md`

## Summary

Create a GitHub App in the ii-us organization and securely store its credentials (App ID and private key) in Azure Key Vault for retrieval via the Secrets Store CSI Driver. This enables the Claude agent pods to authenticate with GitHub using application credentials rather than personal access tokens, with all credentials centrally managed and auditable.

## Technical Context

**Language/Version**: Azure CLI 2.x, GitHub Web UI
**Primary Dependencies**: Azure Key Vault, Secrets Store CSI Driver, GitHub Apps API
**Storage**: Azure Key Vault (secrets storage)
**Testing**: Azure CLI verification commands, GitHub API calls
**Target Platform**: Azure AKS (dev-aks cluster in rg_prod)
**Project Type**: Infrastructure configuration (one-time setup)
**Performance Goals**: Credential retrieval within 5 seconds of pod startup
**Constraints**: No credentials in version control, Kubernetes secrets, or environment variables
**Scale/Scope**: Single GitHub App, 2 Key Vault secrets, installation on multiple repositories

### Azure Environment (Existing)

| Resource | Value |
|----------|-------|
| Key Vault | `iius-akv` |
| Managed Identity | `claude-agent-identity` |
| AKS Cluster | `dev-aks` |
| Resource Group | `rg_prod` |

### Resources to Create

| Resource | Name | Purpose |
|----------|------|---------|
| GitHub App | `claude-code-agent` | Application identity for GitHub operations |
| Key Vault Secret | `github-app-id` | GitHub App ID |
| Key Vault Secret | `github-app-private-key` | GitHub App private key (PEM) |

## Implementation Approach

**Type**: Runbook

**Rationale**: One-time infrastructure setup per Constitution VI. Creating a GitHub App is a manual process through the GitHub web UI, and storing secrets in Key Vault requires interactive credential handling (private key download). CLI commands are documented in `quickstart.md` as a step-by-step runbook.

**Artifacts**:
- Runbook: `quickstart.md` (step-by-step instructions with CLI commands)
- Tasks: Reference quickstart.md step numbers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Spec-First Development

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Spec Before Code | PASS | spec.md created and approved before plan.md |
| Technology-Agnostic Requirements | PASS | Spec describes outcomes (authentication, secure storage) not implementation |
| Measurable Success Criteria | PASS | 6 measurable criteria (SC-001 through SC-006) |
| Independent User Stories | PASS | 3 user stories, each independently testable |

### II. Security by Default

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Least Privilege Access | PASS | FR-002-005: GitHub App permissions scoped to specific capabilities |
| Secrets Management | PASS | FR-008-009: Credentials stored in Key Vault, mounted via CSI Driver |
| No Static Credentials | PASS | FR-010: No credentials in version control, K8s secrets, or env vars |

### III. Phase Gates (NON-NEGOTIABLE)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Specify → Plan → Tasks → Implement | PASS | Currently in Plan phase after Spec completion |
| No Skipping Phases | PASS | Following prescribed sequence |
| Constitution Check | PASS | This section |

### IV. Infrastructure as Code

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Declarative Configuration | PASS | All commands documented in quickstart.md |
| No Manual Changes | PASS | GitHub App creation documented, secrets storage scripted |
| Reproducible Environments | PASS | Runbook enables recreation from documentation |

### V. Automation & Observability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Alerting Integration | N/A | One-time setup, no long-running service |

### VI. Pragmatic Automation

| Requirement | Status | Evidence |
|-------------|--------|----------|
| One-Time Tasks → Runbooks | PASS | Using quickstart.md approach |
| Complexity Justification | N/A | No scripts created for one-time tasks |

**Constitution Check Result**: **PASS** - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/002-github-app/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (GitHub App and Key Vault relationships)
├── quickstart.md        # Phase 1 output (deployment runbook)
├── contracts/           # Phase 1 output (N/A - no API contracts)
│   └── .gitkeep
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code

N/A - This feature creates GitHub and Azure resources via web UI and CLI commands. No application code is written.

**Structure Decision**: Runbook-only approach. All implementation is documented CLI commands and manual GitHub App configuration steps.

## Complexity Tracking

> No Constitution violations requiring justification. All requirements align with principles.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
