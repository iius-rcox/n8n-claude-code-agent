# Research: GitHub App Integration

**Feature**: 002-github-app
**Date**: 2026-01-14
**Purpose**: Resolve technical decisions and document best practices

## Research Topics

### 1. GitHub App vs Personal Access Token

**Decision**: Use GitHub App

**Rationale**:
- GitHub Apps are tied to the organization, not individual users
- Fine-grained permissions can be scoped per-repository
- No risk of credential loss when employees leave
- Higher API rate limits (5000 requests/hour vs 5000/hour for PAT)
- Installation access tokens expire after 1 hour (short-lived)
- Audit trail shows App actions, not personal user actions

**Alternatives Considered**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Personal Access Token | Simple setup | Tied to user, leaves when they leave | Rejected |
| OAuth App | User-based auth | Not suitable for server-to-server | Rejected |
| GitHub App | Organization-level, fine-grained | More setup steps | **Selected** |

### 2. GitHub App Permissions

**Decision**: Minimal permissions required for agent operations

| Permission | Level | Purpose |
|------------|-------|---------|
| Contents | Read & Write | Clone repos, push commits |
| Pull requests | Read & Write | Create PRs, add comments |
| Issues | Read & Write | Create issues, add comments |
| Metadata | Read | List repositories, basic info |

**Rationale**: These four permissions cover all Claude agent operations (code changes, PR creation, issue tracking) without granting unnecessary access.

**Alternatives Considered**:
- Administration permission: Rejected - not needed, too broad
- Workflows permission: Rejected - not triggering GitHub Actions
- Checks permission: Considered - may add later if CI integration needed

### 3. Key Vault Secret Naming Convention

**Decision**: Use kebab-case with `github-app-` prefix

| Secret | Name | Content |
|--------|------|---------|
| App ID | `github-app-id` | Numeric App ID |
| Private Key | `github-app-private-key` | PEM-encoded private key |

**Rationale**:
- Consistent with existing Key Vault secrets (e.g., `postgres-password`)
- Prefix groups related secrets together
- Kebab-case is readable and CLI-friendly

### 4. Private Key Storage Format

**Decision**: Store PEM file content directly in Key Vault

**Rationale**:
- Azure Key Vault supports multi-line secrets up to 25KB
- GitHub private keys are typically 1.6KB (RSA 2048)
- CSI Driver can mount as file with correct permissions
- No base64 encoding needed (Key Vault handles it)

**Alternatives Considered**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Store PEM directly | Simple, native support | None | **Selected** |
| Base64 encode | Common pattern | Extra encode/decode step | Rejected |
| Store as certificate | Native rotation | Different API, more complex | Rejected |

### 5. Installation Scope

**Decision**: Install on specific repositories, not entire organization

**Rationale**:
- Follows least privilege principle
- Agent only needs access to repositories it will work on
- Can expand installation later as needed
- Easier audit trail per-repository

**Initial Repositories**:
- `n8n-claude-code-agent` (this project)
- Additional repositories as agent capabilities expand

### 6. Token Generation Strategy

**Decision**: Generate installation access token on-demand before each operation

**Rationale**:
- Installation tokens expire after 1 hour
- Generating on-demand ensures always-valid token
- GitHub CLI (`gh auth login --with-token`) supports this pattern
- Avoids storing short-lived tokens in files

**Implementation Pattern**:
```
1. Read App ID from /secrets/github/app-id
2. Read private key from /secrets/github/private-key.pem
3. Generate JWT from App credentials
4. Exchange JWT for installation access token
5. Use token for GitHub API calls
```

### 7. CSI Driver Mount Path

**Decision**: Mount secrets at `/secrets/github/`

| File | Mount Path | Purpose |
|------|------------|---------|
| App ID | `/secrets/github/app-id` | Read by token generation script |
| Private Key | `/secrets/github/private-key.pem` | Read by token generation script |

**Rationale**:
- Consistent path across all pods
- `.pem` extension indicates file type
- `/secrets/` prefix clearly identifies sensitive data
- Separate from Claude session files at `/home/claude-agent/.claude/`

## Dependencies

### Prerequisites (from Sprint 1)

| Dependency | Status | Verified By |
|------------|--------|-------------|
| Key Vault `iius-akv` exists | Required | `az keyvault show --name iius-akv` |
| Managed identity has Key Vault Secrets User role | Required | `az role assignment list --assignee $OBJECT_ID` |
| CSI Driver enabled on AKS | Required | `kubectl get pods -n kube-system -l app=secrets-store-csi-driver` |

### GitHub Requirements

| Requirement | How to Verify |
|-------------|---------------|
| Organization admin access | Can access https://github.com/organizations/ii-us/settings/apps |
| Organization allows GitHub Apps | Check organization settings |

## Best Practices Applied

1. **Credential Rotation**: Private keys can be rotated in Key Vault; pods pick up new credentials on restart
2. **Audit Logging**: Key Vault diagnostic logs capture all secret access
3. **No Credential Copies**: Single source of truth in Key Vault
4. **Short-Lived Tokens**: Installation tokens expire in 1 hour
5. **Least Privilege**: Only required permissions granted to App
