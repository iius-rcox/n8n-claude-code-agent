# Data Model: GitHub App Integration

**Feature**: 002-github-app
**Date**: 2026-01-14

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Platform                                 │
│  ┌─────────────────┐         ┌─────────────────┐         ┌───────────────┐ │
│  │   GitHub App    │────────▶│  Installation   │────────▶│  Repository   │ │
│  │  ii-us-claude-  │  1:N    │  (per org/repo) │   1:N   │  (ii-us/...)  │ │
│  │   code-agent    │         │                 │         │               │ │
│  └────────┬────────┘         └────────┬────────┘         └───────────────┘ │
│           │                           │                                     │
│           │ credentials               │ generates                           │
│           ▼                           ▼                                     │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │   Private Key   │         │  Installation   │                           │
│  │   (RSA 2048)    │         │  Access Token   │                           │
│  │                 │         │  (expires 1hr)  │                           │
│  └────────┬────────┘         └─────────────────┘                           │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            │ stored in
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Platform                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Key Vault (iius-akv)                          │   │
│  │  ┌─────────────────┐         ┌─────────────────────────────┐       │   │
│  │  │ github-app-id   │         │ github-app-private-key      │       │   │
│  │  │ (numeric)       │         │ (PEM format)                │       │   │
│  │  └─────────────────┘         └─────────────────────────────┘       │   │
│  └──────────────────────────────────────┬──────────────────────────────┘   │
│                                         │                                   │
│                                         │ mounted via CSI Driver            │
│                                         ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Kubernetes (claude-agent namespace)               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │              SecretProviderClass (github-app-akv)           │   │   │
│  │  │  ┌─────────────────┐    ┌─────────────────────────────────┐ │   │   │
│  │  │  │/secrets/github/ │    │         Pod Volume Mount        │ │   │   │
│  │  │  │  ├── app-id     │◀───│  csi.storage.k8s.io/secret-...  │ │   │   │
│  │  │  │  └── private-   │    │                                 │ │   │   │
│  │  │  │      key.pem    │    └─────────────────────────────────┘ │   │   │
│  │  │  └─────────────────┘                                        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entities

### GitHub App

| Attribute | Type | Description |
|-----------|------|-------------|
| App ID | Integer | Unique identifier assigned by GitHub |
| Name | String | `ii-us-claude-code-agent` |
| Owner | Organization | `ii-us` |
| Private Key | RSA 2048 | PEM-encoded private key for JWT signing |
| Permissions | Object | Scoped permissions (contents, PRs, issues, metadata) |

**Lifecycle**:
1. Created manually via GitHub web UI
2. Private key generated on creation
3. Installed on repositories
4. Generates installation tokens for API access

### Installation

| Attribute | Type | Description |
|-----------|------|-------------|
| Installation ID | Integer | Unique per organization/repository scope |
| App ID | Integer | Reference to parent GitHub App |
| Target Type | Enum | `Organization` or `Repository` |
| Repositories | List | Repositories the app can access |

**Lifecycle**:
1. Created when App is installed on org/repo
2. Persists until App is uninstalled
3. Used to generate installation access tokens

### Installation Access Token

| Attribute | Type | Description |
|-----------|------|-------------|
| Token | String | Bearer token for GitHub API |
| Expires At | DateTime | UTC timestamp, typically 1 hour from creation |
| Permissions | Object | Inherited from App permissions |
| Repository Selection | String | `all` or `selected` |

**Lifecycle**:
1. Generated on-demand using App credentials
2. Valid for 1 hour
3. Used for all GitHub API operations
4. Regenerated when expired

### Key Vault Secret

| Attribute | Type | Description |
|-----------|------|-------------|
| Name | String | `github-app-id` or `github-app-private-key` |
| Value | String | Secret content |
| Content Type | String | `text/plain` |
| Enabled | Boolean | Must be `true` |
| Version | String | Auto-generated GUID |

**Lifecycle**:
1. Created via Azure CLI
2. Encrypted at rest
3. Accessed via CSI Driver
4. Can be rotated (new version created)

### SecretProviderClass

| Attribute | Type | Description |
|-----------|------|-------------|
| Name | String | `github-app-akv` |
| Provider | String | `azure` |
| Key Vault Name | String | `iius-akv` |
| Objects | Array | Secrets to mount |
| Tenant ID | String | Azure AD tenant |
| Client ID | String | Managed identity client ID |

**Lifecycle**:
1. Created once in Kubernetes
2. Referenced by pod volume mounts
3. CSI driver reads on pod startup
4. Updates require pod restart

## Relationships

| From | To | Cardinality | Description |
|------|-----|-------------|-------------|
| GitHub App | Installation | 1:N | One App can have multiple installations |
| Installation | Repository | 1:N | One installation can cover multiple repos |
| GitHub App | Private Key | 1:1 | Each App has exactly one active private key |
| Key Vault | Secret | 1:N | One vault stores multiple secrets |
| SecretProviderClass | Secret | 1:N | One SPC references multiple secrets |
| Pod | SecretProviderClass | N:1 | Multiple pods can use same SPC |

## State Transitions

### GitHub App Creation Flow

```
[Not Exists] ──create──▶ [Created] ──generate key──▶ [Has Key] ──install──▶ [Installed]
```

### Token Generation Flow

```
[No Token] ──read credentials──▶ [Have Credentials] ──sign JWT──▶ [Have JWT] ──exchange──▶ [Have Token]
     ▲                                                                                         │
     │                                                                                         │
     └─────────────────────────────── token expires ───────────────────────────────────────────┘
```

### Secret Access Flow

```
[Pod Starting] ──mount CSI──▶ [Fetch from KV] ──decrypt──▶ [Write to tmpfs] ──▶ [Available at /secrets/]
```

## Validation Rules

| Entity | Rule | Error |
|--------|------|-------|
| GitHub App | Must have private key before use | "App not configured" |
| GitHub App | Must be installed on target repo | "App not installed" |
| Key Vault Secret | `github-app-id` must be numeric | "Invalid App ID format" |
| Key Vault Secret | `github-app-private-key` must be valid PEM | "Invalid private key" |
| Installation Token | Must not be expired | "Token expired, regenerate" |
| SecretProviderClass | Must reference valid Key Vault | "Key Vault not found" |
| SecretProviderClass | Must use correct managed identity | "Access denied" |
