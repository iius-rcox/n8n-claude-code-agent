# Research: Claude Session Tokens

**Feature**: 003-claude-session-tokens
**Date**: 2026-01-14
**Purpose**: Resolve technical decisions and document best practices

## Research Topics

### 1. Claude CLI Session File Location

**Decision**: Use `$env:USERPROFILE\.claude` on Windows

**Rationale**:
- Claude CLI stores session data in the user's home directory under `.claude`
- On Windows, this resolves to `C:\Users\<username>\.claude`
- This is the standard location used by Claude Code (the CLI tool)
- Contains authentication tokens and session configuration

**Alternatives Considered**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Custom location | Could isolate agent tokens | Non-standard, requires config | Rejected |
| Environment variable | Flexible | Extra setup, potential confusion | Rejected |
| Default `.claude` | Standard, no config needed | None | **Selected** |

### 2. Session Files to Include in Secret

**Decision**: Include all files from `.claude` directory

**Rationale**:
- Claude CLI requires specific files for authentication
- Including all files ensures no required file is missed
- kubectl's `--from-file` flag handles directory contents automatically
- Base64 encoding is handled by kubectl

**Files Typically Present**:
- Authentication tokens
- Session configuration
- User preferences (may be needed for consistent behavior)

**Note**: Exact file names may vary by Claude CLI version. Including the entire directory ensures forward compatibility.

### 3. Kubernetes Secret Creation Method

**Decision**: Use `kubectl create secret generic` with `--from-file` and `--dry-run=client`

**Rationale**:
- `kubectl create secret generic` is the standard command for creating Opaque secrets
- `--from-file=<directory>` automatically includes all files as key-value pairs
- `--dry-run=client -o yaml` generates YAML without applying to cluster
- Output can be saved locally and applied later in Sprint 5

**Command Pattern**:
```powershell
kubectl create secret generic claude-session `
  --from-file="$env:USERPROFILE\.claude" `
  --dry-run=client -o yaml > claude-session-secret.yaml
```

**Alternatives Considered**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Manual YAML with base64 | Full control | Error-prone, tedious | Rejected |
| kubectl --from-file | Automatic encoding | Requires kubectl | **Selected** |
| Sealed Secrets | Encrypted at rest | Over-engineered for this use case | Rejected |

### 4. Token Validity and Refresh Strategy

**Decision**: Capture fresh tokens; refresh manually when expired

**Rationale**:
- Claude Max session tokens have limited validity (varies by account type)
- Sprint 7 will implement automated monitoring via CronJob
- For Sprint 3, manual refresh via logout/login is sufficient
- Tokens should remain valid for at least 24 hours per SC-005

**Refresh Process** (documented for Sprint 7):
1. CronJob runs `claude -p "health check"` periodically
2. If authentication fails (exit code indicates auth error), notify Teams
3. User performs manual refresh and updates Kubernetes secret

### 5. Git Ignore Strategy

**Decision**: Add `claude-session-secret.yaml` to `.gitignore`

**Rationale**:
- Secret YAML contains base64-encoded tokens (easily decoded)
- Must never be committed to version control
- Existing `.gitignore` should already exclude `*.yaml` secrets or we add specific entry
- FR-008 requires this exclusion

**Implementation**:
```gitignore
# Claude session secret (contains tokens)
claude-session-secret.yaml
```

### 6. Verification Test Prompt

**Decision**: Use `claude -p "Say 'auth test successful'"` for verification

**Rationale**:
- Simple prompt that confirms full authentication flow works
- Expected response is predictable and verifiable
- Quick execution (should complete in <10 seconds per SC-002)
- No side effects or resource consumption

**Alternative Test Methods**:

| Method | Pros | Cons | Decision |
|--------|------|------|----------|
| Simple echo prompt | Fast, predictable | None | **Selected** |
| Complex prompt | More thorough | Slower, harder to verify | Rejected |
| API health check | Direct | Requires API knowledge | Rejected |

## Dependencies

### Prerequisites

| Dependency | Status | Verified By |
|------------|--------|-------------|
| Claude CLI installed | Required | `claude --version` |
| Claude Max subscription | Required | Successful login |
| kubectl installed | Required | `kubectl version --client` |
| Network access | Required | Successful login |

### Output Consumers

| Consumer | What They Need |
|----------|---------------|
| Sprint 5 (Kubernetes) | `claude-session-secret.yaml` file |
| Init container | Secret mounted at `/home/claude-agent/.claude/` |

## Best Practices Applied

1. **Fresh Tokens**: Always logout before login to ensure fresh credentials
2. **Verification Before Export**: Test prompt confirms tokens work before creating secret
3. **Dry-Run First**: Generate YAML without cluster to catch errors early
4. **Secure Handling**: YAML file excluded from git, deleted after cluster apply
5. **Documentation**: All commands in quickstart.md for reproducibility
