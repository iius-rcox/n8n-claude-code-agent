# Quickstart: GitHub App Integration

**Feature**: 002-github-app
**Prerequisites**: Sprint 1 complete (Key Vault accessible, CSI Driver enabled)
**Time**: ~15 minutes

---

## Step 1: Create GitHub App

1. Navigate to: https://github.com/organizations/ii-us/settings/apps/new

2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | GitHub App name | `ii-us-claude-code-agent` |
   | Homepage URL | `https://github.com/ii-us/n8n-claude-code-agent` |
   | Webhook | **Uncheck** "Active" (not needed) |

3. Set **Repository permissions**:

   | Permission | Access |
   |------------|--------|
   | Contents | Read and write |
   | Pull requests | Read and write |
   | Issues | Read and write |
   | Metadata | Read-only |

4. Set **Where can this GitHub App be installed?**:
   - Select: **Only on this account**

5. Click **Create GitHub App**

6. **Save the App ID** displayed on the next page (e.g., `123456`)

---

## Step 2: Generate Private Key

1. On the GitHub App page, scroll to **Private keys** section

2. Click **Generate a private key**

3. A `.pem` file will download automatically (e.g., `claude-code-agent.2026-01-14.private-key.pem`)

4. **Keep this file secure** - do not commit to version control

---

## Step 3: Install GitHub App on Repositories

1. On the GitHub App page, click **Install App** in the left sidebar

2. Select the **ii-us** organization

3. Choose **Only select repositories**

4. Select repositories the agent will access:
   - `n8n-claude-code-agent`
   - (Add more as needed)

5. Click **Install**

---

## Step 4: Store App ID in Key Vault

```bash
# Set variables
APP_ID="YOUR_APP_ID_HERE"  # Replace with actual App ID from Step 1

# Store App ID in Key Vault
az keyvault secret set \
  --vault-name iius-akv \
  --name "github-app-id" \
  --value "$APP_ID"
```

**Verification**:
```bash
az keyvault secret show --vault-name iius-akv --name "github-app-id" --query "value" -o tsv
```

---

## Step 5: Store Private Key in Key Vault

```bash
# Set path to downloaded private key
PRIVATE_KEY_PATH="C:\Users\rcox\Downloads\claude-code-agent.2026-01-14.private-key.pem"

# Store private key in Key Vault (use --file for multi-line content)
az keyvault secret set \
  --vault-name iius-akv \
  --name "github-app-private-key" \
  --file "$PRIVATE_KEY_PATH"
```

**Verification**:
```bash
# Check secret exists (don't output value for security)
az keyvault secret show --vault-name iius-akv --name "github-app-private-key" --query "name" -o tsv
```

---

## Step 6: Clean Up Local Private Key

After storing in Key Vault, securely delete the local private key file:

```powershell
# Windows PowerShell
Remove-Item -Path "C:\Users\rcox\Downloads\claude-code-agent.*.private-key.pem" -Force
```

---

## Verification Tests

### Test 1: Verify Secrets in Key Vault

```bash
# List GitHub-related secrets
az keyvault secret list --vault-name iius-akv --query "[?starts_with(name, 'github-app')].name" -o tsv
```

**Expected output**:
```
github-app-id
github-app-private-key
```

### Test 2: Verify Managed Identity Can Access Secrets

```bash
# Get managed identity object ID
OBJECT_ID=$(az identity show --name claude-agent-identity --resource-group rg_prod --query principalId -o tsv)

# Check role assignments include Key Vault Secrets User
az role assignment list --assignee $OBJECT_ID --scope /subscriptions/a78954fe-f6fe-4279-8be0-2c748be2f266/resourceGroups/rg_prod/providers/Microsoft.KeyVault/vaults/iius-akv --query "[].roleDefinitionName" -o tsv
```

**Expected output** (should include):
```
Key Vault Secrets User
```

### Test 3: Verify GitHub App Installation

1. Navigate to: https://github.com/organizations/ii-us/settings/installations

2. Find `ii-us-claude-code-agent` in the list

3. Verify the correct repositories are listed

---

## Outputs for Next Sprint

Save these values for Sprint 5 (Kubernetes deployment):

| Output | Value | Use |
|--------|-------|-----|
| App ID Secret Name | `github-app-id` | SecretProviderClass objectName |
| App ID Value | `2658380` | GitHub App authentication |
| Private Key Secret Name | `github-app-private-key` | SecretProviderClass objectName |
| Key Vault Name | `iius-akv` | SecretProviderClass keyvaultName |
| Tenant ID | `953922e6-5370-4a01-a3d5-723a30df726b` | SecretProviderClass tenantId |
| GitHub App Name | `ii-us-claude-code-agent` | Reference |

---

## Troubleshooting

### "Vault not found" when storing secrets

```bash
# Verify Key Vault exists
az keyvault show --name iius-akv --query "name" -o tsv
```

### "Access denied" when storing secrets

```bash
# Check your current user has Key Vault access
az keyvault secret list --vault-name iius-akv
```

If denied, you may need Key Vault Administrator role:
```bash
# Add yourself as Key Vault Administrator (requires elevated permissions)
az role assignment create \
  --role "Key Vault Administrator" \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --scope /subscriptions/a78954fe-f6fe-4279-8be0-2c748be2f266/resourceGroups/rg_prod/providers/Microsoft.KeyVault/vaults/iius-akv
```

### "Invalid PEM format" when reading private key

Ensure the private key file:
- Starts with `-----BEGIN RSA PRIVATE KEY-----`
- Ends with `-----END RSA PRIVATE KEY-----`
- Has no extra whitespace or BOM characters

---

## Rollback

To remove GitHub App credentials:

```bash
# Delete secrets from Key Vault (soft delete)
az keyvault secret delete --vault-name iius-akv --name "github-app-id"
az keyvault secret delete --vault-name iius-akv --name "github-app-private-key"

# To permanently delete (purge):
az keyvault secret purge --vault-name iius-akv --name "github-app-id"
az keyvault secret purge --vault-name iius-akv --name "github-app-private-key"
```

To uninstall GitHub App:
1. Go to https://github.com/organizations/ii-us/settings/installations
2. Click on `ii-us-claude-code-agent`
3. Click **Uninstall**
