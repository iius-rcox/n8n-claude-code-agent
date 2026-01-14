# Quickstart: Azure Infrastructure Foundation

**Feature**: 001-azure-infra
**Date**: 2026-01-14
**Estimated Time**: 15 minutes

## Prerequisites

- [ ] Azure CLI installed and authenticated (`az login`)
- [ ] kubectl configured for dev-aks cluster
- [ ] Sufficient RBAC permissions (Owner/Contributor on rg_prod)
- [ ] AKS cluster `dev-aks` running with OIDC issuer enabled

### Verify Prerequisites

```bash
# Check Azure CLI
az account show --query name -o tsv
# Expected: Your subscription name

# Check kubectl context
kubectl config current-context
# Expected: dev-aks (or similar)

# Check OIDC issuer enabled
az aks show --name dev-aks --resource-group rg_prod \
  --query "oidcIssuerProfile.issuerUrl" -o tsv
# Expected: https://oidc.prod-aks... (URL, not empty)
```

---

## Step 1: Set Environment Variables

```bash
# Azure environment
export RESOURCE_GROUP="rg_prod"
export LOCATION="southcentralus"
export SUBSCRIPTION_ID="a78954fe-f6fe-4279-8be0-2c748be2f266"
export TENANT_ID="953922e6-5370-4a01-a3d5-773a30df726b"

# Resources to create
export STORAGE_ACCOUNT="iiusagentstore"
export IDENTITY_NAME="claude-agent-identity"
export AKS_CLUSTER="dev-aks"
export KEY_VAULT="iius-akv"

# Kubernetes
export K8S_NAMESPACE="claude-agent"
export K8S_SERVICE_ACCOUNT="claude-agent-sa"
```

---

## Step 2: Create Storage Account (Hardened)

```bash
# Create storage with security settings
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --https-only true \
  --min-tls-version TLS1_2 \
  --default-action Deny

# Verify creation
az storage account show --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP --query provisioningState -o tsv
# Expected: Succeeded
```

---

## Step 3: Create Blob Containers

```bash
# Create all 6 containers
for container in agent-state agent-spec agent-plan agent-verification agent-review agent-release; do
  az storage container create \
    --account-name $STORAGE_ACCOUNT \
    --name $container \
    --auth-mode login
  echo "Created: $container"
done

# Verify containers
az storage container list --account-name $STORAGE_ACCOUNT \
  --auth-mode login --query "[].name" -o tsv
# Expected: 6 container names
```

---

## Step 4: Create Managed Identity

```bash
# Create identity
az identity create \
  --name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Capture outputs (IMPORTANT - save these!)
export CLIENT_ID=$(az identity show \
  --name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --query clientId -o tsv)

export OBJECT_ID=$(az identity show \
  --name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

echo "CLIENT_ID: $CLIENT_ID"
echo "OBJECT_ID: $OBJECT_ID"
# Save these values for Kubernetes configuration!
```

---

## Step 5: Configure RBAC Role Assignments

```bash
# Get resource IDs
export STORAGE_ID=$(az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

export KEYVAULT_ID=$(az keyvault show \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --query id -o tsv)

# Assign Storage Blob Data Contributor
az role assignment create \
  --assignee $OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID

# Assign Key Vault Secrets User
az role assignment create \
  --assignee $OBJECT_ID \
  --role "Key Vault Secrets User" \
  --scope $KEYVAULT_ID

# Verify assignments
az role assignment list --assignee $OBJECT_ID \
  --query "[].{Role:roleDefinitionName, Scope:scope}" -o table
# Expected: 2 rows showing both roles
```

---

## Step 6: Create Federated Credential

```bash
# Get OIDC issuer URL
export OIDC_ISSUER=$(az aks show \
  --name $AKS_CLUSTER \
  --resource-group $RESOURCE_GROUP \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

echo "OIDC Issuer: $OIDC_ISSUER"

# Create federated credential
az identity federated-credential create \
  --name "claude-agent-fed-cred" \
  --identity-name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --issuer "$OIDC_ISSUER" \
  --subject "system:serviceaccount:${K8S_NAMESPACE}:${K8S_SERVICE_ACCOUNT}" \
  --audiences "api://AzureADTokenExchange"

# Verify
az identity federated-credential list \
  --identity-name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[].{Name:name, Subject:subject}" -o table
# Expected: 1 row with correct subject
```

---

## Step 7: Enable CSI Driver Add-on

```bash
# Enable Secrets Store CSI Driver
az aks enable-addons \
  --addons azure-keyvault-secrets-provider \
  --name $AKS_CLUSTER \
  --resource-group $RESOURCE_GROUP

# Verify CSI pods are running
kubectl get pods -n kube-system \
  -l 'app in (secrets-store-csi-driver,secrets-store-provider-azure)' \
  --no-headers | wc -l
# Expected: 2+ pods (depends on node count)
```

---

## Step 8: Configure Storage Network Rules

```bash
# Get AKS subnet ID
export AKS_SUBNET_ID=$(az aks show \
  --name $AKS_CLUSTER \
  --resource-group $RESOURCE_GROUP \
  --query "agentPoolProfiles[0].vnetSubnetId" -o tsv)

echo "AKS Subnet: $AKS_SUBNET_ID"

# Add subnet rule (if subnet exists)
if [ -n "$AKS_SUBNET_ID" ]; then
  az storage account network-rule add \
    --account-name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --subnet $AKS_SUBNET_ID
  echo "Subnet rule added"
else
  echo "WARNING: No subnet found. Manual network configuration required."
fi

# Enable Azure services bypass
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --bypass AzureServices

# Verify network rules
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "networkRuleSet.{DefaultAction:defaultAction, Bypass:bypass}" -o table
# Expected: DefaultAction=Deny, Bypass=AzureServices
```

---

## Verification

### Test 1: Storage Account Hardening

```bash
# Check TLS version
az storage account show --name $STORAGE_ACCOUNT \
  --query minimumTlsVersion -o tsv
# Expected: TLS1_2

# Check public access disabled
az storage account show --name $STORAGE_ACCOUNT \
  --query allowBlobPublicAccess -o tsv
# Expected: false

# Check default deny
az storage account show --name $STORAGE_ACCOUNT \
  --query "networkRuleSet.defaultAction" -o tsv
# Expected: Deny
```

### Test 2: Identity Configuration

```bash
# Check federated credential exists
az identity federated-credential show \
  --identity-name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --name "claude-agent-fed-cred" \
  --query subject -o tsv
# Expected: system:serviceaccount:claude-agent:claude-agent-sa
```

### Test 3: CSI Driver Health

```bash
# Check driver pods
kubectl get pods -n kube-system \
  -l app=secrets-store-csi-driver \
  -o jsonpath='{.items[*].status.phase}'
# Expected: Running Running ...

# Check provider pods
kubectl get pods -n kube-system \
  -l app=secrets-store-provider-azure \
  -o jsonpath='{.items[*].status.phase}'
# Expected: Running Running ...
```

---

## Output Summary

After completing all steps, you should have:

| Resource | Name | Status |
|----------|------|--------|
| Storage Account | iiusagentstore | Created, hardened |
| Blob Containers | 6x agent-* | Created |
| Managed Identity | claude-agent-identity | Created |
| Federated Credential | claude-agent-fed-cred | Created |
| RBAC: Storage | Storage Blob Data Contributor | Assigned |
| RBAC: Key Vault | Key Vault Secrets User | Assigned |
| CSI Driver | azure-keyvault-secrets-provider | Enabled |
| Network Rules | Default deny + AKS subnet | Configured |

**Save these values for Kubernetes deployment**:
```bash
echo "CLIENT_ID=$CLIENT_ID"
```

---

## Troubleshooting

### Storage Access Denied

```bash
# Temporarily allow all (debugging only!)
az storage account update --name $STORAGE_ACCOUNT --default-action Allow

# After testing, restore security
az storage account update --name $STORAGE_ACCOUNT --default-action Deny
```

### Federated Credential Subject Mismatch

```bash
# Verify exact match
echo "Federated subject: system:serviceaccount:${K8S_NAMESPACE}:${K8S_SERVICE_ACCOUNT}"

# Delete and recreate if wrong
az identity federated-credential delete \
  --identity-name $IDENTITY_NAME \
  --resource-group $RESOURCE_GROUP \
  --name "claude-agent-fed-cred"
```

### CSI Driver Not Running

```bash
# Check add-on status
az aks show --name $AKS_CLUSTER --resource-group $RESOURCE_GROUP \
  --query "addonProfiles.azureKeyvaultSecretsProvider.enabled" -o tsv

# Re-enable if needed
az aks enable-addons \
  --addons azure-keyvault-secrets-provider \
  --name $AKS_CLUSTER \
  --resource-group $RESOURCE_GROUP
```

---

## Next Steps

1. **Create Kubernetes namespace and service account** (Sprint 5)
2. **Deploy SecretProviderClass for GitHub credentials** (Sprint 5)
3. **Deploy agent pod with Workload Identity** (Sprint 5)
4. **Configure Teams webhook for monitoring** (Sprint 7)

**Estimated next sprint**: Kubernetes Deployment (Sprint 5)
