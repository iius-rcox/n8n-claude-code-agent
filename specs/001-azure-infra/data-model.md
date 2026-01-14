# Data Model: Azure Infrastructure Foundation

**Feature**: 001-azure-infra
**Date**: 2026-01-14

## Overview

This document describes the Azure resource entities, their relationships, and the Kubernetes resources that bind to them for Workload Identity authentication.

---

## Entity Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Resources                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐         ┌────────────────────┐                      │
│  │   Storage Account  │         │     Key Vault      │                      │
│  │   iiusagentstore   │         │     iius-akv       │                      │
│  │                    │         │                    │                      │
│  │  ┌──────────────┐  │         │  ┌──────────────┐  │                      │
│  │  │ Containers   │  │         │  │   Secrets    │  │                      │
│  │  │ - agent-state│  │         │  │ - github-*   │  │                      │
│  │  │ - agent-spec │  │         │  └──────────────┘  │                      │
│  │  │ - agent-plan │  │         │                    │                      │
│  │  │ - agent-*    │  │         └─────────┬──────────┘                      │
│  │  └──────────────┘  │                   │                                 │
│  └─────────┬──────────┘                   │                                 │
│            │                              │                                 │
│            │ Storage Blob                 │ Key Vault                       │
│            │ Data Contributor             │ Secrets User                    │
│            │                              │                                 │
│            └──────────┬───────────────────┘                                 │
│                       │                                                      │
│                       ▼                                                      │
│           ┌────────────────────┐                                            │
│           │  Managed Identity  │◄────────┐                                  │
│           │ claude-agent-      │         │                                  │
│           │ identity           │         │                                  │
│           └─────────┬──────────┘         │                                  │
│                     │                    │                                  │
│                     │ Federated          │                                  │
│                     │ Credential         │                                  │
│                     │                    │                                  │
│                     ▼                    │                                  │
│           ┌────────────────────┐         │                                  │
│           │ claude-agent-      │         │                                  │
│           │ fed-cred           │         │                                  │
│           │                    │         │                                  │
│           │ subject:           │         │                                  │
│           │ system:service-    │         │                                  │
│           │ account:claude-    │         │                                  │
│           │ agent:claude-      │         │                                  │
│           │ agent-sa           │         │                                  │
│           └─────────┬──────────┘         │                                  │
│                     │                    │                                  │
└─────────────────────┼────────────────────┼──────────────────────────────────┘
                      │                    │
                      │ OIDC Token         │ Token Exchange
                      │ Exchange           │
                      ▼                    │
┌─────────────────────┼────────────────────┼──────────────────────────────────┐
│                     │  Kubernetes        │                                  │
├─────────────────────┼────────────────────┼──────────────────────────────────┤
│                     │                    │                                  │
│           ┌─────────▼──────────┐         │                                  │
│           │  ServiceAccount    │         │                                  │
│           │  claude-agent-sa   │─────────┘                                  │
│           │                    │                                            │
│           │  annotations:      │                                            │
│           │    client-id: ...  │                                            │
│           │  labels:           │                                            │
│           │    workload-       │                                            │
│           │    identity/use    │                                            │
│           └─────────┬──────────┘                                            │
│                     │                                                        │
│                     │ mounted by                                             │
│                     ▼                                                        │
│           ┌────────────────────┐         ┌────────────────────┐             │
│           │       Pod          │         │ SecretProviderClass│             │
│           │  claude-code-agent │◄────────│ github-app-akv     │             │
│           │                    │  CSI    │                    │             │
│           │  /secrets/github/  │  mount  │ objects:           │             │
│           │  /workspace/       │         │ - github-app-id    │             │
│           │  /home/.claude/    │         │ - github-app-      │             │
│           └────────────────────┘         │   private-key      │             │
│                                          └────────────────────┘             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Definitions

### Azure Resources

#### Storage Account: `iiusagentstore`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `iiusagentstore` | Globally unique |
| Resource Group | `rg_prod` | Existing |
| Location | `southcentralus` | Required region |
| SKU | `Standard_LRS` | Locally redundant |
| Kind | `StorageV2` | General purpose v2 |
| Min TLS Version | `TLS1_2` | Security requirement |
| Public Blob Access | `false` | Security requirement |
| Default Network Action | `Deny` | Zero-trust |
| Bypass | `AzureServices` | Platform operations |

**Containers** (6):

| Container | Purpose |
|-----------|---------|
| `agent-state` | Lease files, task envelopes |
| `agent-spec` | Specification artifacts |
| `agent-plan` | Implementation plans |
| `agent-verification` | Verification results |
| `agent-review` | Code review artifacts |
| `agent-release` | Release artifacts |

---

#### Managed Identity: `claude-agent-identity`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `claude-agent-identity` | Descriptive |
| Resource Group | `rg_prod` | Existing |
| Location | `southcentralus` | Same as cluster |
| Type | `UserAssigned` | Required for federation |
| Client ID | `<generated>` | Used in K8s annotation |
| Principal ID | `<generated>` | Used in role assignments |

**Role Assignments**:

| Role | Scope | Purpose |
|------|-------|---------|
| Storage Blob Data Contributor | `/subscriptions/.../storageAccounts/iiusagentstore` | Read/write blobs |
| Key Vault Secrets User | `/subscriptions/.../vaults/iius-akv` | Read secrets |

---

#### Federated Credential: `claude-agent-fed-cred`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `claude-agent-fed-cred` | Descriptive |
| Identity | `claude-agent-identity` | Parent identity |
| Issuer | `<AKS OIDC Issuer URL>` | From cluster |
| Subject | `system:serviceaccount:claude-agent:claude-agent-sa` | K8s SA binding |
| Audiences | `api://AzureADTokenExchange` | Standard value |

---

### Kubernetes Resources

#### Namespace: `claude-agent`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `claude-agent` | Isolation boundary |
| Labels | `kubernetes.io/metadata.name: claude-agent` | For NetworkPolicy selectors |

---

#### ServiceAccount: `claude-agent-sa`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `claude-agent-sa` | Referenced in fed cred |
| Namespace | `claude-agent` | Matches subject |
| Annotation | `azure.workload.identity/client-id: <CLIENT_ID>` | Links to identity |
| Label | `azure.workload.identity/use: "true"` | Enables injection |

---

#### SecretProviderClass: `github-app-akv`

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `github-app-akv` | Referenced in pod |
| Namespace | `claude-agent` | Same as pod |
| Provider | `azure` | Key Vault provider |
| Parameters.clientID | `<CLIENT_ID>` | Workload Identity |
| Parameters.keyvaultName | `iius-akv` | Existing vault |
| Parameters.tenantId | `953922e6-...` | Azure tenant |

**Objects Mounted**:

| Object Name | Alias | Mount Path |
|-------------|-------|------------|
| `github-app-id` | `app-id` | `/secrets/github/app-id` |
| `github-app-private-key` | `private-key.pem` | `/secrets/github/private-key.pem` |

---

## Relationships

### Identity Chain

```
Pod → ServiceAccount → FederatedCredential → ManagedIdentity → RBAC Roles → Azure Resources
```

1. **Pod** uses `serviceAccountName: claude-agent-sa`
2. **ServiceAccount** has label `azure.workload.identity/use: "true"`
3. **FederatedCredential** trusts `system:serviceaccount:claude-agent:claude-agent-sa`
4. **ManagedIdentity** receives access token via OIDC exchange
5. **RBAC Roles** grant access to Storage Account and Key Vault
6. **Azure Resources** accept authenticated requests

### Network Flow

```
Pod (AKS subnet) → Storage Account (subnet allowlist) → Blob Operations
Pod (AKS subnet) → Key Vault → Secret Read (via CSI)
```

---

## State Transitions

### Resource Provisioning Order

```
1. Storage Account (iiusagentstore)
   └─ State: Created

2. Blob Containers (6x)
   └─ State: Created

3. Managed Identity (claude-agent-identity)
   └─ State: Created
   └─ Output: CLIENT_ID, OBJECT_ID

4. RBAC Role Assignments
   └─ State: Assigned (Storage Blob Data Contributor)
   └─ State: Assigned (Key Vault Secrets User)

5. Federated Credential
   └─ State: Created
   └─ Prerequisite: AKS OIDC Issuer URL

6. CSI Driver Add-on
   └─ State: Enabled

7. Storage Network Rules
   └─ State: Configured (default deny + subnet allow)
```

### Dependencies

| Resource | Depends On |
|----------|------------|
| Blob Containers | Storage Account |
| Role Assignments | Managed Identity, Storage Account/Key Vault |
| Federated Credential | Managed Identity, AKS OIDC Issuer |
| Network Rules | Storage Account, AKS Subnet |

---

## Validation Rules

### Storage Account

- Name must be 3-24 lowercase alphanumeric characters
- Name must be globally unique across Azure
- Must be in same region as AKS cluster

### Managed Identity

- Name must be unique within resource group
- Must be in same tenant as AKS cluster

### Federated Credential

- Subject format must be exactly: `system:serviceaccount:<namespace>:<name>`
- Issuer must match AKS OIDC issuer URL exactly
- Audience must be `api://AzureADTokenExchange`

### Service Account

- Name must match subject in federated credential
- Namespace must match subject in federated credential
- Must have both label AND annotation for Workload Identity
