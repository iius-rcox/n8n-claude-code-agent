# Research: Azure Infrastructure Foundation

**Feature**: 001-azure-infra
**Date**: 2026-01-14
**Status**: Complete

## Overview

This document consolidates research findings for implementing secure Azure infrastructure with Workload Identity, hardened storage, and Key Vault integration via CSI Driver.

---

## Decision 1: Azure Workload Identity Configuration

### Decision
Use user-assigned managed identity with federated credentials bound to a Kubernetes service account.

### Rationale
- **Passwordless authentication**: No static credentials stored anywhere
- **Native AKS integration**: Supported via OIDC issuer built into AKS
- **Fine-grained RBAC**: Identity receives only required permissions
- **Production-proven**: Microsoft-recommended approach for AKS workloads

### Implementation Details

**Federated Credential Subject Format** (CRITICAL):
```
system:serviceaccount:<namespace>:<service-account-name>
```
Example: `system:serviceaccount:claude-agent:claude-agent-sa`

**Service Account Requirements**:
- Label: `azure.workload.identity/use: "true"`
- Annotation: `azure.workload.identity/client-id: <CLIENT_ID>`

**Key Commands**:
```bash
# Get OIDC issuer
OIDC_ISSUER=$(az aks show --name dev-aks --resource-group rg_prod \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

# Create federated credential
az identity federated-credential create \
  --name "claude-agent-fed-cred" \
  --identity-name claude-agent-identity \
  --resource-group rg_prod \
  --issuer "$OIDC_ISSUER" \
  --subject "system:serviceaccount:claude-agent:claude-agent-sa" \
  --audiences "api://AzureADTokenExchange"
```

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Pod-managed identity (AAD Pod Identity v1) | Deprecated; replaced by Workload Identity |
| Static credentials in K8s secrets | Violates Constitution II (Security by Default) |
| System-assigned managed identity | Cannot federate with K8s service accounts |

---

## Decision 2: Storage Account Network Hardening

### Decision
Configure storage with default-deny network rules, explicit AKS subnet allowlist, and Azure services bypass.

### Rationale
- **Defense in depth**: Network layer blocks unauthorized access even if credentials leak
- **Compliance**: Meets TLS 1.2 requirement from FR-002
- **Operational flexibility**: Azure services bypass allows platform operations (backup, diagnostics)

### Implementation Details

**Security Settings**:
```bash
az storage account create \
  --name iiusagentstore \
  --resource-group rg_prod \
  --location southcentralus \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --https-only true \
  --min-tls-version TLS1_2 \
  --default-action Deny
```

**Network Rules**:
```bash
# Get AKS subnet ID
AKS_SUBNET_ID=$(az aks show --name dev-aks --resource-group rg_prod \
  --query "agentPoolProfiles[0].vnetSubnetId" -o tsv)

# Allow AKS subnet
az storage account network-rule add \
  --account-name iiusagentstore \
  --resource-group rg_prod \
  --subnet $AKS_SUBNET_ID

# Allow Azure services
az storage account update \
  --name iiusagentstore \
  --resource-group rg_prod \
  --bypass AzureServices
```

**Propagation Timing**:
- Network rule changes: ~1 minute to propagate
- TLS version changes: ~30 seconds

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Private endpoint only | More complex setup; subnet rules sufficient for AKS |
| IP-based allowlist | AKS pod IPs are dynamic; subnet rules more reliable |
| No network restrictions | Violates Constitution II (Zero Trust Networking) |

---

## Decision 3: Secrets Store CSI Driver Integration

### Decision
Enable Azure Key Vault provider add-on and configure SecretProviderClass with Workload Identity authentication.

### Rationale
- **Native integration**: Built-in AKS add-on, no custom deployment
- **Workload Identity compatible**: Uses same identity as storage access
- **Auto-rotation capable**: CSI driver supports secret refresh
- **File-based mounting**: Secrets appear as files, matching existing patterns

### Implementation Details

**Enable Add-on**:
```bash
az aks enable-addons \
  --addons azure-keyvault-secrets-provider \
  --name dev-aks \
  --resource-group rg_prod
```

**SecretProviderClass Configuration**:
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: github-app-akv
  namespace: claude-agent
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    clientID: "<CLIENT_ID>"
    keyvaultName: "iius-akv"
    tenantId: "953922e6-5370-4a01-a3d5-773a30df726b"
    objects: |
      array:
        - objectName: github-app-id
          objectType: secret
          objectAlias: app-id
        - objectName: github-app-private-key
          objectType: secret
          objectAlias: private-key.pem
```

**Pod Volume Mount**:
```yaml
volumes:
- name: secrets-store
  csi:
    driver: secrets-store.csi.k8s.io
    readOnly: true
    volumeAttributes:
      secretProviderClass: "github-app-akv"
```

**Verification**:
```bash
# Check CSI pods
kubectl get pods -n kube-system -l 'app in (secrets-store-csi-driver,secrets-store-provider-azure)'

# Check mounted secrets
kubectl exec <pod-name> -- ls /secrets/github/
```

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| External Secrets Operator | Additional dependency; CSI driver is built-in |
| Direct K8s secrets from Key Vault | Sync delay; CSI provides real-time access |
| HashiCorp Vault | External system; Key Vault already exists |

---

## Decision 4: RBAC Role Assignments

### Decision
Assign least-privilege roles scoped to specific resources (not resource groups).

### Rationale
- **Constitution compliance**: II.2 requires minimum required permissions
- **Blast radius limitation**: Compromised identity can only access specific resources
- **Audit clarity**: Role assignments clearly show exact permissions

### Implementation Details

**Storage Access**:
```bash
STORAGE_ID=$(az storage account show --name iiusagentstore \
  --resource-group rg_prod --query id -o tsv)

az role assignment create \
  --assignee $OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID
```

**Key Vault Access**:
```bash
KEYVAULT_ID=$(az keyvault show --name iius-akv \
  --resource-group rg_prod --query id -o tsv)

az role assignment create \
  --assignee $OBJECT_ID \
  --role "Key Vault Secrets User" \
  --scope $KEYVAULT_ID
```

### Roles Used

| Role | Scope | Purpose |
|------|-------|---------|
| Storage Blob Data Contributor | iiusagentstore | Read/write blobs in all containers |
| Key Vault Secrets User | iius-akv | Read secrets (not keys or certificates) |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Resource group scope | Overly permissive; grants access to all RG resources |
| Storage Account Contributor | Includes management operations; only data access needed |
| Key Vault Administrator | Includes management; only read secrets needed |

---

## Common Pitfalls & Troubleshooting

### Workload Identity Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Pods can't authenticate | Subject mismatch | Verify `system:serviceaccount:<ns>:<sa>` exactly matches |
| OIDC issuer not found | Feature not enabled | Run `az aks update --enable-oidc-issuer` |
| Invalid assertion | Missing label | Add `azure.workload.identity/use: "true"` to ServiceAccount |

### Storage Network Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Access denied from pod | Subnet rule missing | Add AKS subnet via network-rule add |
| Access denied from local | Working as expected | Default-deny is blocking external access |
| Azure service blocked | Bypass not set | Add `--bypass AzureServices` |

### CSI Driver Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Driver not found | Add-on not enabled | Run `az aks enable-addons` |
| Mount fails | RBAC missing | Assign Key Vault Secrets User role |
| Secret empty | Object name typo | Verify objectName matches Key Vault secret |

---

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Identity exists | `az identity show -n claude-agent-identity -g rg_prod` | Returns identity JSON |
| Fed cred exists | `az identity federated-credential list --identity-name claude-agent-identity -g rg_prod` | Lists credential |
| Storage hardened | `az storage account show -n iiusagentstore --query networkRuleSet.defaultAction` | `"Deny"` |
| TLS enforced | `az storage account show -n iiusagentstore --query minimumTlsVersion` | `"TLS1_2"` |
| CSI enabled | `kubectl get pods -n kube-system -l app=secrets-store-csi-driver` | Pods Running |
| RBAC assigned | `az role assignment list --assignee $OBJECT_ID` | Shows 2 roles |

---

## References

- [Azure Workload Identity](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview)
- [Storage Account Network Security](https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security)
- [Secrets Store CSI Driver](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver)
- [Key Vault RBAC](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
