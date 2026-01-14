# Quickstart: Claude Session Tokens

**Feature**: 003-claude-session-tokens
**Prerequisites**: Claude Max subscription, Claude CLI installed, kubectl installed
**Time**: ~5 minutes

---

## Step 1: Verify Prerequisites

```powershell
# Check Claude CLI is installed
claude --version

# Check kubectl is installed
kubectl version --client
```

**Expected**: Both commands return version information without errors.

---

## Step 2: Logout Existing Session (Optional but Recommended)

```powershell
# Clear any existing session to ensure fresh tokens
claude logout
```

**Note**: This ensures you get fresh tokens rather than potentially stale ones.

---

## Step 3: Login to Claude Max

```powershell
# Start interactive login
claude login
```

**Process**:
1. Browser opens to Anthropic authentication page
2. Sign in with your Claude Max credentials
3. Authorize the CLI application
4. Return to terminal - login completes automatically

**Expected**: Terminal displays success message indicating logged in.

---

## Step 4: Verify Authentication

```powershell
# Test that Claude responds successfully
claude -p "Say 'auth test successful'"
```

**Expected**: Claude responds with "auth test successful" (or similar acknowledgment).

**If this fails**: Re-run Step 3 (login). Check network connectivity.

---

## Step 5: Verify Session Files Exist

```powershell
# List session files (Claude Code stores in user profile .claude directory)
Get-ChildItem "$env:USERPROFILE\.claude" -Force

# Check files have content (not empty)
Get-ChildItem "$env:USERPROFILE\.claude" -Force | Select-Object Name, Length
```

**Expected**:
- Multiple files listed including `.credentials.json` and `settings.json`
- All files have non-zero `Length`

**Note**: Key files are `.credentials.json` (authentication) and `settings.json` (configuration).

---

## Step 6: Generate Kubernetes Secret YAML

```powershell
# Generate secret YAML (dry-run, not applied to cluster)
# This includes all Claude session data from the .claude directory
kubectl create secret generic claude-session `
  --from-file="$env:USERPROFILE\.claude" `
  --dry-run=client -o yaml > claude-session-secret.yaml

# Verify file was created
Get-Item claude-session-secret.yaml
```

**Expected**: File `claude-session-secret.yaml` created in current directory.

**Note**: The file will be large (~500KB+) as it includes all session data, history, and cache files.

---

## Step 7: Verify Secret Structure

```powershell
# View the generated YAML (data will be base64 encoded)
Get-Content claude-session-secret.yaml

# Check it has the expected structure
Select-String -Path claude-session-secret.yaml -Pattern "kind: Secret"
Select-String -Path claude-session-secret.yaml -Pattern "name: claude-session"
```

**Expected**:
- YAML contains `kind: Secret`
- YAML contains `name: claude-session`
- YAML contains `data:` section with base64-encoded file contents

---

## Step 8: Verify Git Ignore

```powershell
# Ensure secret file is ignored by git
git check-ignore claude-session-secret.yaml

# If not ignored, the above returns nothing. Check .gitignore:
Get-Content .gitignore | Select-String "claude-session"
```

**Expected**: File should be listed in `.gitignore` or match a pattern.

**If not ignored**: Add to `.gitignore`:
```powershell
Add-Content .gitignore "`nclaude-session-secret.yaml"
```

---

## Verification Checklist

| Step | Verification | Expected |
|------|--------------|----------|
| Prerequisites | `claude --version` | Version displayed |
| Login | `claude login` | Success message |
| Auth Test | `claude -p "Say 'auth test successful'"` | Response received |
| Files Exist | `Get-ChildItem $env:USERPROFILE\.claude` | Files listed |
| Secret Generated | `Get-Item claude-session-secret.yaml` | File exists |
| Git Ignored | `git check-ignore claude-session-secret.yaml` | File path returned |

---

## Outputs for Next Sprint

Save this information for Sprint 5 (Kubernetes Deployment):

| Output | Value | Use |
|--------|-------|-----|
| Secret File | `claude-session-secret.yaml` | Apply to cluster |
| Secret Name | `claude-session` | Reference in Deployment |
| Mount Path | `/home/claude-agent/.claude/` | Init container copies here |

---

## Troubleshooting

### "claude: command not found"

Claude CLI is not installed or not in PATH.

```powershell
# Check if npm package is installed
npm list -g @anthropic-ai/claude-code

# Install if missing
npm install -g @anthropic-ai/claude-code
```

### "kubectl: command not found"

kubectl is not installed or not in PATH.

```powershell
# Install via winget
winget install Kubernetes.kubectl

# Or via chocolatey
choco install kubernetes-cli
```

### Login Fails with Network Error

Check internet connectivity and firewall settings for access to Anthropic authentication servers.

### Test Prompt Returns Authentication Error

Session may be corrupted. Re-run logout and login:

```powershell
claude logout
claude login
```

### Secret YAML is Empty or Missing Data

Session files may not exist. Run Steps 3-5 to ensure valid session.

---

## Cleanup (After Sprint 5 Apply)

After the secret is applied to the Kubernetes cluster in Sprint 5:

```powershell
# Delete local secret file (contains sensitive data)
Remove-Item claude-session-secret.yaml -Force

# Verify deletion
Test-Path claude-session-secret.yaml  # Should return False
```

---

## Token Refresh (When Needed)

When tokens expire (detected by failing Claude operations):

1. Re-run this entire quickstart (Steps 2-7)
2. Apply updated secret to cluster:
   ```powershell
   kubectl apply -f claude-session-secret.yaml -n claude-agent
   ```
3. Restart the agent pod to pick up new credentials:
   ```powershell
   kubectl rollout restart deployment/claude-code-agent -n claude-agent
   ```
