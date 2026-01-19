# INSULATIONS, INC - Azure Infrastructure Testing Plan

## Document Information

| Property | Value |
|----------|-------|
| **Version** | 1.0 |
| **Created** | January 15, 2026 |
| **Environment** | Azure Production (South Central US) |
| **Subscription** | Azure subscription 1 (a78954fe-f6fe-4279-8be0-2c748be2f266) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Test Categories](#2-test-categories)
3. [Infrastructure Tests](#3-infrastructure-tests)
4. [AKS Cluster Tests](#4-aks-cluster-tests)
5. [Networking Tests](#5-networking-tests)
6. [Security Tests](#6-security-tests)
7. [Application Integration Tests](#7-application-integration-tests)
8. [Backup & Recovery Tests](#8-backup--recovery-tests)
9. [Performance Tests](#9-performance-tests)
10. [Monitoring & Alerting Tests](#10-monitoring--alerting-tests)
11. [Test Execution Schedule](#11-test-execution-schedule)
12. [Test Results Template](#12-test-results-template)

---

## 1. Overview

### 1.1 Purpose

This testing plan provides comprehensive validation procedures for the INSULATIONS, INC Azure infrastructure, ensuring all components function correctly, securely, and meet performance requirements.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| AKS cluster (dev-aks) | Application-level unit tests |
| VPN Gateway (S2S/P2S) | End-user acceptance testing |
| Virtual Machines (12 production VMs) | Third-party SaaS integrations |
| Storage accounts | On-premises hardware |
| Key Vault secrets | Branch office equipment |
| Recovery Services | |
| Network security | |

### 1.3 Test Environment

```
Primary Region: South Central US
Resource Groups: rg_prod, MC_rg_prod_dev-aks_southcentralus
VNet: vnet_prod (10.0.0.0/16)
AKS: dev-aks (Private Cluster)
```

---

## 2. Test Categories

| Category | Priority | Frequency | Owner |
|----------|----------|-----------|-------|
| Infrastructure Health | Critical | Daily (automated) | DevOps |
| AKS Cluster | Critical | Daily (automated) | DevOps |
| Networking/VPN | High | Weekly | Network Admin |
| Security | Critical | Weekly | Security Team |
| Backup/Recovery | High | Monthly | DevOps |
| Performance | Medium | Monthly | DevOps |
| Disaster Recovery | High | Quarterly | IT Leadership |

---

## 3. Infrastructure Tests

### 3.1 Virtual Machine Health Tests

#### TEST-VM-001: VM Availability Check

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VM-001 |
| **Description** | Verify all production VMs are running and accessible |
| **Priority** | Critical |
| **Frequency** | Every 5 minutes (automated) |

**Procedure:**
```powershell
# List all VMs with power state
az vm list -d --query "[].{Name:name, PowerState:powerState, ResourceGroup:resourceGroup}" -o table

# Expected: All 12 VMs show "VM running"
```

**Expected VMs:**
| VM Name | Expected State |
|---------|----------------|
| INSDAL9DC01 | VM running |
| INSDAL9DC02 | VM running |
| INSCOLFIL001 | VM running |
| INSDALFILE01 | VM running |
| INSCOLAVONTUS | VM running |
| INSCOLPVAULT | VM running |
| INSCOLRDS01 | VM running |
| INSCOLRDSWEB | VM running |
| INSCOLVISTA | VM running |
| INSCOLVSQL | VM running |
| INSDALSMTP | VM running |
| INSHARPORTAL | VM running |

**Pass Criteria:** All 12 VMs report "VM running"
**Fail Action:** Alert DevOps team, check Azure Service Health, investigate VM boot diagnostics

---

#### TEST-VM-002: Domain Controller Replication

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VM-002 |
| **Description** | Verify AD DS replication between domain controllers |
| **Priority** | Critical |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Run via Bastion on INSDAL9DC01
repadmin /replsummary
repadmin /showrepl

# Check for replication errors
dcdiag /v /c /d /e /s:INSDAL9DC01
```

**Pass Criteria:**
- No replication failures between INSDAL9DC01 and INSDAL9DC02
- All dcdiag tests pass
- Replication latency < 15 minutes

**Fail Action:** Check network connectivity between DCs, review DNS settings, check AD event logs

---

#### TEST-VM-003: SQL Server Connectivity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VM-003 |
| **Description** | Verify SQL Server (INSCOLVSQL) is accepting connections |
| **Priority** | Critical |
| **Frequency** | Every 15 minutes (automated) |

**Procedure:**
```powershell
# Test SQL connectivity from application server
Test-NetConnection -ComputerName 10.0.0.5 -Port 1433

# Verify SQL Server service status (via Bastion)
Get-Service -Name MSSQLSERVER
```

**Pass Criteria:**
- TCP port 1433 responds
- SQL Server service is running
- Vista database accessible

**Fail Action:** Check SQL Server logs, verify firewall rules, check disk space

---

### 3.2 Storage Account Tests

#### TEST-STOR-001: Storage Account Accessibility

| Field | Value |
|-------|-------|
| **Test ID** | TEST-STOR-001 |
| **Description** | Verify all storage accounts are accessible and healthy |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# List storage accounts and status
az storage account list --query "[].{Name:name, Status:statusOfPrimary, Tier:accessTier}" -o table

# Test blob access for each account
$accounts = @("ccproctemp2025", "iibackuparchive", "iiusagentstore", "n8nbackups9679")
foreach ($account in $accounts) {
    az storage container list --account-name $account --auth-mode login -o table
}
```

**Expected Storage Accounts:**
| Account | Tier | Purpose |
|---------|------|---------|
| ccproctemp2025 | Hot | Credit card processing |
| iibackuparchive | Cool | VM backup archives |
| iiusagentstore | Hot | Claude Agent storage |
| n8nbackups9679 | Cool | n8n backups |

**Pass Criteria:** All accounts report "available" status
**Fail Action:** Check Azure Storage health, verify RBAC permissions

---

#### TEST-STOR-002: Backup Archive Integrity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-STOR-002 |
| **Description** | Verify archived VM VHDs are intact and accessible |
| **Priority** | Medium |
| **Frequency** | Monthly |

**Procedure:**
```powershell
# List archived VHDs
az storage blob list --account-name iibackuparchive --container-name vm-backup-archives -o table

# Verify blob properties (no corruption)
az storage blob show --account-name iibackuparchive --container-name vm-backup-archives --name "INSNSH9DC01/insnsh9dc01-osdisk.vhd"
```

**Expected Archives:**
| VM | VHD Files | Expected Size |
|----|-----------|---------------|
| INSNSH9DC01 | 1 OS disk | ~127 GB |
| INSHARSQL001 | 1 OS + 2 data disks | ~1 TB |

**Pass Criteria:** All VHD blobs accessible, properties match expected sizes
**Fail Action:** Check blob integrity, verify no accidental deletions

---

## 4. AKS Cluster Tests

### 4.1 Cluster Health Tests

#### TEST-AKS-001: Cluster Connectivity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-001 |
| **Description** | Verify AKS cluster API server is accessible |
| **Priority** | Critical |
| **Frequency** | Every 5 minutes (automated) |

**Procedure:**
```powershell
# Get credentials (private cluster - requires VPN or Bastion)
az aks get-credentials --resource-group rg_prod --name dev-aks --overwrite-existing

# Test API server connectivity
kubectl cluster-info
kubectl get nodes
```

**Pass Criteria:**
- API server responds within 5 seconds
- All nodes report "Ready" status
- Kubernetes version matches expected (1.33.3)

**Fail Action:** Check VNet integration, verify private DNS resolution, check node health

---

#### TEST-AKS-002: Node Pool Health

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-002 |
| **Description** | Verify all AKS node pools are healthy |
| **Priority** | Critical |
| **Frequency** | Every 15 minutes (automated) |

**Procedure:**
```powershell
# Check node status
kubectl get nodes -o wide

# Check node conditions
kubectl describe nodes | Select-String -Pattern "Conditions:" -Context 0,10

# Verify node pool status
az aks nodepool list --resource-group rg_prod --cluster-name dev-aks -o table
```

**Expected Node Pools:**
| Pool | VM Size | Expected Count | Mode |
|------|---------|----------------|------|
| systempool | Standard_D4lds_v5 | 2 | System |
| optimized | Standard_B2ms | 2 | User |

**Pass Criteria:**
- All 4 nodes report "Ready"
- No node conditions show "Unknown" or "False" for critical checks
- Memory/CPU pressure conditions are "False"

**Fail Action:** Check node logs, verify VMSS health, check for pod evictions

---

#### TEST-AKS-003: Core Services Health

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-003 |
| **Description** | Verify AKS core services (DNS, networking) are functional |
| **Priority** | Critical |
| **Frequency** | Every 15 minutes (automated) |

**Procedure:**
```powershell
# Check kube-system pods
kubectl get pods -n kube-system

# Test DNS resolution
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- nslookup kubernetes.default

# Check CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check Cilium (network policy)
kubectl get pods -n kube-system -l k8s-app=cilium
```

**Pass Criteria:**
- All kube-system pods are Running
- DNS resolution works for internal services
- CoreDNS pods healthy
- Cilium agents running on all nodes

**Fail Action:** Check CoreDNS logs, verify Cilium configuration, restart affected pods

---

#### TEST-AKS-004: Add-on Functionality

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-004 |
| **Description** | Verify AKS add-ons are functioning correctly |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Key Vault Secrets Provider
kubectl get pods -n kube-system -l app=secrets-store-csi-driver
kubectl get secretproviderclass --all-namespaces

# KEDA
kubectl get pods -n kube-system -l app=keda-operator

# Web App Routing (NGINX)
kubectl get pods -n app-routing-system

# Azure Policy
kubectl get pods -n kube-system -l app=azure-policy
```

**Expected Add-ons:**
| Add-on | Namespace | Expected Pods |
|--------|-----------|---------------|
| Secrets Store CSI | kube-system | 4+ pods |
| KEDA | kube-system | 2 pods (operator + metrics) |
| Web App Routing | app-routing-system | 2+ pods |
| Azure Policy | kube-system | 2 pods |

**Pass Criteria:** All add-on pods running and healthy
**Fail Action:** Check add-on logs, verify managed identity permissions

---

#### TEST-AKS-005: Workload Identity Integration

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-005 |
| **Description** | Verify workload identity can authenticate to Azure services |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Check service accounts with workload identity
kubectl get serviceaccounts --all-namespaces -o jsonpath='{range .items[?(@.metadata.annotations.azure\.workload\.identity/client-id)]}{.metadata.namespace}/{.metadata.name}: {.metadata.annotations.azure\.workload\.identity/client-id}{"\n"}{end}'

# Test Key Vault access (from a test pod with workload identity)
kubectl run keyvault-test --image=mcr.microsoft.com/azure-cli --rm -it --restart=Never --serviceaccount=<sa-name> -- az keyvault secret list --vault-name iius-akv
```

**Pass Criteria:**
- Service accounts correctly annotated
- Pods can authenticate to Key Vault without explicit credentials

**Fail Action:** Verify federated credentials, check OIDC issuer configuration

---

### 4.2 Application Deployment Tests

#### TEST-AKS-006: n8n Deployment Health

| Field | Value |
|-------|-------|
| **Test ID** | TEST-AKS-006 |
| **Description** | Verify n8n workflow automation is deployed and accessible |
| **Priority** | Critical |
| **Frequency** | Every 15 minutes (automated) |

**Procedure:**
```powershell
# Check n8n namespace
kubectl get all -n n8n

# Verify n8n pods
kubectl get pods -n n8n -l app=n8n

# Test n8n service endpoint
kubectl port-forward svc/n8n 5678:5678 -n n8n &
curl http://localhost:5678/healthz
```

**Pass Criteria:**
- n8n pods are Running (at least 1 replica)
- Health endpoint returns 200 OK
- Database connection successful

**Fail Action:** Check n8n logs, verify PostgreSQL connectivity, check secrets

---

## 5. Networking Tests

### 5.1 VPN Gateway Tests

#### TEST-VPN-001: Site-to-Site VPN Connectivity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VPN-001 |
| **Description** | Verify all S2S VPN tunnels are connected |
| **Priority** | Critical |
| **Frequency** | Every 15 minutes (automated) |

**Procedure:**
```powershell
# List VPN connections and status
az network vpn-connection list -g rg_prod --query "[].{Name:name, Status:connectionStatus, EgressBytes:egressBytesTransferred, IngressBytes:ingressBytesTransferred}" -o table
```

**Expected S2S Connections (11 total):**
| Connection | Location | Expected Status |
|------------|----------|-----------------|
| Baton_Rouge | Louisiana | Connected |
| Bossier_City | Louisiana | Connected |
| BR-Industriplex | Louisiana | Connected |
| HarahanEdwards | Louisiana | Connected |
| Harahan_Commerce | Louisiana | Connected |
| Harahan_Edwards_2nd | Louisiana | Connected |
| Houston-Depot-B | Texas | Connected |
| Houston-Dept-A | Texas | Connected |
| Houston_Sommermeyer | Texas | Connected |
| Pasadena | Texas | Connected |
| Sulphur | Louisiana | Connected |

**Pass Criteria:** All 11 connections show "Connected" status
**Fail Action:** Check local gateway device, verify shared key, check Azure VPN diagnostics

---

#### TEST-VPN-002: Point-to-Site VPN Authentication

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VPN-002 |
| **Description** | Verify P2S VPN authentication via Azure AD |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
1. Connect using Azure VPN Client
2. Authenticate with Azure AD credentials
3. Verify IP assignment from 172.16.10.0/24 pool
4. Test connectivity to internal resources

```powershell
# From connected P2S client
Test-NetConnection -ComputerName 10.0.0.200 -Port 3389  # DC1
Test-NetConnection -ComputerName 10.0.0.5 -Port 1433    # SQL Server
```

**Pass Criteria:**
- Azure AD authentication succeeds
- Client receives IP from P2S pool
- Can reach internal VMs

**Fail Action:** Verify AAD tenant configuration, check VPN client logs

---

#### TEST-VPN-003: BGP Peering Status

| Field | Value |
|-------|-------|
| **Test ID** | TEST-VPN-003 |
| **Description** | Verify BGP sessions are established (where enabled) |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Check VPN gateway BGP settings
az network vnet-gateway show -g rg_prod -n vnet_prod --query "bgpSettings" -o json

# List connections with BGP enabled
az network vpn-connection list -g rg_prod --query "[?enableBgp==true].{Name:name, EnableBgp:enableBgp}" -o table
```

**BGP-Enabled Connections:**
- BR-Industriplex
- Houston-Depot-B
- Pasadena

**Pass Criteria:** BGP sessions established, routes learned correctly
**Fail Action:** Check BGP peer status, verify ASN configuration

---

### 5.2 Network Security Tests

#### TEST-NET-001: NSG Rule Validation

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-001 |
| **Description** | Verify NSG rules are correctly configured |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List NSG rules
az network nsg list -g rg_prod -o table
az network nsg rule list --nsg-name II_NSG -g rg_prod -o table
```

**Pass Criteria:**
- Default deny rules in place
- No overly permissive rules (e.g., Any/Any Allow)
- Required service ports open

**Fail Action:** Review recent NSG changes, validate against security baseline

---

#### TEST-NET-002: Bastion Connectivity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-002 |
| **Description** | Verify Azure Bastion can connect to VMs |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
1. Navigate to Azure Portal > Bastion
2. Connect to each VM type:
   - Domain Controller (INSDAL9DC01)
   - SQL Server (INSCOLVSQL)
   - RDS Server (INSCOLRDSWEB)

**Pass Criteria:**
- Bastion connection established within 30 seconds
- RDP session functional
- Kerberos authentication works

**Fail Action:** Check Bastion subnet, verify VM NSG allows Bastion

---

#### TEST-NET-003: Private DNS Resolution

| Field | Value |
|-------|-------|
| **Test ID** | TEST-NET-003 |
| **Description** | Verify private DNS zones resolve correctly |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# From a VM in the VNet
nslookup dns-275668076-1mnu3cfq.6b50eed7-ab6c-40cb-b2ee-4ccc91d3aaf2.private.southcentralus.azmk8s.io

# Verify private DNS zone link
az network private-dns zone list -o table
az network private-dns link vnet list -g MC_rg_prod_dev-aks_southcentralus -z privatelink.southcentralus.azmk8s.io -o table
```

**Pass Criteria:**
- AKS private FQDN resolves to internal IP
- VNet link is active

**Fail Action:** Check private DNS zone configuration, verify VNet link

---

## 6. Security Tests

### 6.1 Identity & Access Tests

#### TEST-SEC-001: Key Vault Access Audit

| Field | Value |
|-------|-------|
| **Test ID** | TEST-SEC-001 |
| **Description** | Verify Key Vault access is properly restricted |
| **Priority** | Critical |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List Key Vault role assignments
az role assignment list --scope "/subscriptions/a78954fe-f6fe-4279-8be0-2c748be2f266/resourceGroups/rg_prod/providers/Microsoft.KeyVault/vaults/iius-akv" -o table

# Check recent access logs
az monitor activity-log list --resource-id "/subscriptions/a78954fe-f6fe-4279-8be0-2c748be2f266/resourceGroups/rg_prod/providers/Microsoft.KeyVault/vaults/iius-akv" --start-time (Get-Date).AddDays(-7) -o table
```

**Pass Criteria:**
- Only authorized principals have access
- No unexpected access attempts in logs
- RBAC authorization enabled

**Fail Action:** Review access policies, investigate unauthorized access attempts

---

#### TEST-SEC-002: Managed Identity Audit

| Field | Value |
|-------|-------|
| **Test ID** | TEST-SEC-002 |
| **Description** | Verify managed identities have appropriate permissions |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List all managed identities
az identity list -o table

# Check role assignments for each identity
$identities = @(
    "dev-aks-uami",
    "claude-agent-identity",
    "n8n-keyvault-identity",
    "external-secrets-identity"
)

foreach ($id in $identities) {
    Write-Host "=== $id ==="
    az role assignment list --assignee (az identity show -g rg_prod -n $id --query principalId -o tsv) -o table
}
```

**Pass Criteria:**
- Each identity has only required permissions
- No excessive privileges (Owner, Contributor at subscription level)

**Fail Action:** Review and restrict excessive permissions

---

#### TEST-SEC-003: Secret Rotation Verification

| Field | Value |
|-------|-------|
| **Test ID** | TEST-SEC-003 |
| **Description** | Verify secrets are rotated per policy |
| **Priority** | High |
| **Frequency** | Monthly |

**Procedure:**
```powershell
# List secrets with creation dates
az keyvault secret list --vault-name iius-akv --query "[].{Name:name, Created:attributes.created, Updated:attributes.updated}" -o table

# Check secrets older than 90 days
az keyvault secret list --vault-name iius-akv --query "[?attributes.created < '$(Get-Date).AddDays(-90)'].name" -o tsv
```

**Secrets Requiring Rotation:**
| Secret Type | Rotation Period |
|-------------|-----------------|
| API Keys (MS Graph, etc.) | 90 days |
| Database passwords | 180 days |
| Service account credentials | 365 days |

**Pass Criteria:** No secrets exceed rotation period
**Fail Action:** Initiate secret rotation procedure

---

### 6.2 Network Security Tests

#### TEST-SEC-004: Public Endpoint Audit

| Field | Value |
|-------|-------|
| **Test ID** | TEST-SEC-004 |
| **Description** | Verify only required public endpoints are exposed |
| **Priority** | Critical |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List all public IPs
az network public-ip list -g rg_prod -o table

# For each public IP, verify it's required
# Scan for open ports
nmap -sV <public-ip>
```

**Authorized Public Endpoints:**
| Resource | Public IP | Required Ports |
|----------|-----------|----------------|
| VPN Gateway | 52.248.91.147, 52.248.91.162, 52.249.36.236 | 443, 1194 |
| Bastion | 13.84.46.217 | 443 |
| INSCOLPVAULT | 13.65.248.143 | Application-specific |
| INSCOLRDSWEB | 52.183.197.153 | 443 |
| INSCOLRDS01 | 104.210.204.217 | 3389 |
| INSCOLVISTA | 104.214.34.192 | Application-specific |
| INSCOLVSQL | 4.151.125.166 | 1433 (review necessity) |

**Pass Criteria:**
- Only documented public endpoints exist
- No unexpected open ports

**Fail Action:** Remove unauthorized public IPs, investigate exposure

---

## 7. Application Integration Tests

### 7.1 Claude Agent Integration

#### TEST-INT-001: Claude API Connectivity

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-001 |
| **Description** | Verify Claude API can be reached from AKS |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Test from AKS pod with claude-agent-identity
kubectl run claude-test --image=curlimages/curl --rm -it --restart=Never -- \
  curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages \
  -H "x-api-key: <test-key>" \
  -H "anthropic-version: 2023-06-01"
```

**Pass Criteria:**
- API endpoint reachable (401 expected without valid key)
- Network egress working

**Fail Action:** Check outbound NSG rules, verify DNS resolution

---

#### TEST-INT-002: n8n Webhook Functionality

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-002 |
| **Description** | Verify n8n can receive and process webhooks |
| **Priority** | High |
| **Frequency** | Daily |

**Procedure:**
```powershell
# Test webhook endpoint
curl -X POST https://n8n.ii-us.com/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Verify execution in n8n
# Check n8n execution history
```

**Pass Criteria:**
- Webhook receives request
- Workflow executes successfully
- Response returned within 30 seconds

**Fail Action:** Check ingress configuration, verify n8n logs

---

### 7.2 External Service Integration

#### TEST-INT-003: Microsoft Graph API Integration

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-003 |
| **Description** | Verify MS Graph API authentication works |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Get access token using stored credentials
$clientId = az keyvault secret show --vault-name iius-akv --name MS-GRAPH-CLIENT-ID --query value -o tsv
$clientSecret = az keyvault secret show --vault-name iius-akv --name MS-GRAPH-CLIENT-SECRET --query value -o tsv
$tenantId = az keyvault secret show --vault-name iius-akv --name MS-GRAPH-TENANT-ID --query value -o tsv

# Test token acquisition
$body = @{
    client_id = $clientId
    client_secret = $clientSecret
    scope = "https://graph.microsoft.com/.default"
    grant_type = "client_credentials"
}
Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Method POST -Body $body
```

**Pass Criteria:**
- Access token obtained successfully
- Token has expected scopes

**Fail Action:** Check app registration, verify secret validity

---

#### TEST-INT-004: SafetyAmp Integration

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-004 |
| **Description** | Verify SafetyAmp API connectivity |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Test SafetyAmp API
$token = az keyvault secret show --vault-name iius-akv --name SAFETYAMP-TOKEN --query value -o tsv
curl -H "Authorization: Bearer $token" https://api.safetyamp.com/health
```

**Pass Criteria:** API responds with 200 OK
**Fail Action:** Check token validity, verify network connectivity

---

#### TEST-INT-005: Samsara Fleet Integration

| Field | Value |
|-------|-------|
| **Test ID** | TEST-INT-005 |
| **Description** | Verify Samsara API connectivity for fleet/telematics |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
$apiKey = az keyvault secret show --vault-name iius-akv --name SAMSARA-API-KEY --query value -o tsv
curl -H "Authorization: Bearer $apiKey" https://api.samsara.com/fleet/vehicles
```

**Pass Criteria:** API responds with vehicle data
**Fail Action:** Check API key validity, verify network connectivity

---

## 8. Backup & Recovery Tests

### 8.1 Azure Backup Tests

#### TEST-BKP-001: Backup Job Status

| Field | Value |
|-------|-------|
| **Test ID** | TEST-BKP-001 |
| **Description** | Verify all VM backup jobs completed successfully |
| **Priority** | Critical |
| **Frequency** | Daily |

**Procedure:**
```powershell
# List backup items and last backup status
az backup item list \
  --vault-name "II-Azure-Migrate-MigrateVault-1460196499" \
  --resource-group rg_azure_migrate \
  --backup-management-type AzureIaasVM \
  --query "[].{VM:properties.friendlyName, Status:properties.lastBackupStatus, LastBackup:properties.lastRecoveryPoint}" \
  -o table
```

**Expected Results:**
| VM | Expected Status |
|----|-----------------|
| INSCOLAVONTUS | Completed |
| INSCOLFIL001 | Completed |
| INSCOLPVAULT | Completed |
| INSCOLRDS01 | Completed |
| INSCOLRDSWEB | Completed |
| INSCOLVISTA | Completed |
| INSCOLVSQL | Completed |
| INSDAL9DC01 | Completed |
| INSDAL9DC02 | Completed |
| INSDALFILE01 | Completed |
| INSDALSMTP | Completed |
| INSHARPORTAL | Completed |

**Pass Criteria:** All 12 VMs show "Completed" status
**Fail Action:** Check backup job logs, verify VM agent status

---

#### TEST-BKP-002: Recovery Point Verification

| Field | Value |
|-------|-------|
| **Test ID** | TEST-BKP-002 |
| **Description** | Verify recovery points exist and are within retention period |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List recovery points for critical VMs
$vms = @("INSDAL9DC01", "INSCOLVSQL", "INSCOLFIL001")
foreach ($vm in $vms) {
    Write-Host "=== $vm ==="
    az backup recoverypoint list \
      --vault-name "II-Azure-Migrate-MigrateVault-1460196499" \
      --resource-group rg_azure_migrate \
      --container-name "iaasvmcontainerv2;rg_prod;$vm" \
      --item-name "vm;iaasvmcontainerv2;rg_prod;$vm" \
      --query "[0:5].{Name:name, Time:properties.recoveryPointTime}" \
      -o table
}
```

**Pass Criteria:**
- Each VM has at least 7 recovery points
- Most recent recovery point within 24 hours
- Recovery points span 30-day retention period

**Fail Action:** Check backup policy, investigate missed backups

---

### 8.2 Recovery Tests

#### TEST-BKP-003: File-Level Recovery Test

| Field | Value |
|-------|-------|
| **Test ID** | TEST-BKP-003 |
| **Description** | Verify file-level recovery from backup works |
| **Priority** | High |
| **Frequency** | Monthly |

**Procedure:**
1. Select test VM (INSCOLFIL001)
2. Initiate file recovery from Azure Portal
3. Mount recovery volume
4. Copy test file to verify integrity
5. Unmount recovery volume

**Pass Criteria:**
- Recovery volume mounts successfully
- Files accessible and intact
- Recovery completes within 30 minutes

**Fail Action:** Check VM agent, verify backup consistency

---

#### TEST-BKP-004: Full VM Recovery Test

| Field | Value |
|-------|-------|
| **Test ID** | TEST-BKP-004 |
| **Description** | Verify full VM can be restored from backup |
| **Priority** | Critical |
| **Frequency** | Quarterly |

**Procedure:**
1. Select non-critical VM for test (INSDALSMTP)
2. Restore to new VM with "-restored" suffix
3. Verify restored VM boots
4. Verify data integrity
5. Delete test VM after validation

**Pass Criteria:**
- VM restores successfully
- VM boots and services start
- Data integrity verified
- Restore completes within 2 hours

**Fail Action:** Investigate backup integrity, check restore logs

---

## 9. Performance Tests

### 9.1 Resource Utilization Tests

#### TEST-PERF-001: VM Resource Utilization

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-001 |
| **Description** | Verify VM resource utilization is within acceptable limits |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Get VM metrics for last 24 hours
$vms = az vm list -g rg_prod --query "[].name" -o tsv
foreach ($vm in $vms) {
    Write-Host "=== $vm ==="
    az monitor metrics list \
      --resource "/subscriptions/a78954fe-f6fe-4279-8be0-2c748be2f266/resourceGroups/rg_prod/providers/Microsoft.Compute/virtualMachines/$vm" \
      --metric "Percentage CPU" "Available Memory Bytes" \
      --interval PT1H \
      --aggregation Average \
      -o table
}
```

**Thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| CPU % | > 70% avg | > 90% avg |
| Memory Available | < 20% | < 10% |
| Disk I/O | > 80% | > 95% |

**Pass Criteria:** All VMs within warning thresholds
**Fail Action:** Investigate high utilization, consider VM resize

---

#### TEST-PERF-002: AKS Resource Utilization

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-002 |
| **Description** | Verify AKS cluster resource utilization |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# Node resource utilization
kubectl top nodes

# Pod resource utilization
kubectl top pods --all-namespaces | Sort-Object -Property cpu -Descending | Select-Object -First 20

# Check for resource-constrained pods
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}: CPU={.spec.containers[*].resources.requests.cpu}, Mem={.spec.containers[*].resources.requests.memory}{"\n"}{end}'
```

**Thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| Node CPU | > 70% | > 85% |
| Node Memory | > 70% | > 85% |
| Pod Restarts | > 5/hour | > 20/hour |

**Pass Criteria:** Cluster resources within thresholds
**Fail Action:** Scale node pool, investigate resource-heavy pods

---

### 9.2 Network Performance Tests

#### TEST-PERF-003: VPN Throughput Test

| Field | Value |
|-------|-------|
| **Test ID** | TEST-PERF-003 |
| **Description** | Verify VPN tunnel throughput meets requirements |
| **Priority** | Medium |
| **Frequency** | Monthly |

**Procedure:**
1. Use iperf3 between Azure VM and branch office
2. Test TCP throughput
3. Test UDP throughput
4. Measure latency

```powershell
# From Azure VM
iperf3 -c <branch-office-ip> -t 60 -P 4

# Expected throughput for VpnGw2AZ: up to 1.25 Gbps aggregate
```

**Thresholds:**
| Connection Type | Minimum Throughput |
|-----------------|-------------------|
| S2S VPN (per tunnel) | 100 Mbps |
| P2S VPN | 50 Mbps |

**Pass Criteria:** Throughput meets minimum requirements
**Fail Action:** Check VPN gateway SKU, investigate network congestion

---

## 10. Monitoring & Alerting Tests

### 10.1 Alert Configuration Tests

#### TEST-MON-001: Alert Rule Validation

| Field | Value |
|-------|-------|
| **Test ID** | TEST-MON-001 |
| **Description** | Verify all critical alert rules are configured and active |
| **Priority** | High |
| **Frequency** | Weekly |

**Procedure:**
```powershell
# List all alert rules
az monitor metrics alert list -g rg_prod -o table
az monitor activity-log alert list -g rg_prod -o table

# Verify alert action groups
az monitor action-group list -g rg_prod -o table
```

**Required Alerts:**
| Alert | Condition | Severity |
|-------|-----------|----------|
| VM Down | PowerState != Running | Sev 0 |
| High CPU | CPU > 90% for 15 min | Sev 1 |
| Low Disk Space | Disk < 10% | Sev 1 |
| Backup Failed | Backup status = Failed | Sev 1 |
| VPN Disconnected | Connection status != Connected | Sev 1 |
| AKS Node Not Ready | Node condition != Ready | Sev 0 |

**Pass Criteria:** All required alerts configured and enabled
**Fail Action:** Create missing alerts, verify action groups

---

#### TEST-MON-002: Alert Notification Test

| Field | Value |
|-------|-------|
| **Test ID** | TEST-MON-002 |
| **Description** | Verify alert notifications are received |
| **Priority** | High |
| **Frequency** | Monthly |

**Procedure:**
1. Trigger test alert via Azure Portal
2. Verify email notification received
3. Verify Teams notification received (if configured)
4. Record notification latency

**Pass Criteria:**
- Email notification received within 5 minutes
- Correct recipients notified
- Alert details accurate

**Fail Action:** Check action group configuration, verify email addresses

---

### 10.2 Log Analytics Tests

#### TEST-MON-003: Log Ingestion Verification

| Field | Value |
|-------|-------|
| **Test ID** | TEST-MON-003 |
| **Description** | Verify logs are being ingested into Log Analytics |
| **Priority** | Medium |
| **Frequency** | Weekly |

**Procedure:**
```kusto
// Run in Log Analytics workspace
// Check AKS container logs
ContainerLogV2
| where TimeGenerated > ago(1h)
| summarize count() by Computer
| order by count_ desc

// Check VM performance logs
Perf
| where TimeGenerated > ago(1h)
| summarize count() by Computer
| order by count_ desc
```

**Pass Criteria:**
- Logs ingested from all AKS nodes
- Logs ingested from all VMs with agents
- No gaps > 15 minutes

**Fail Action:** Check OMS agent status, verify workspace connectivity

---

## 11. Test Execution Schedule

### 11.1 Automated Tests (Continuous)

| Test ID | Frequency | Automation Tool |
|---------|-----------|-----------------|
| TEST-VM-001 | Every 5 min | Azure Monitor |
| TEST-AKS-001 | Every 5 min | Azure Monitor |
| TEST-AKS-002 | Every 15 min | Azure Monitor |
| TEST-AKS-006 | Every 15 min | Prometheus/Alertmanager |
| TEST-VPN-001 | Every 15 min | Azure Monitor |
| TEST-BKP-001 | Daily | Azure Backup |

### 11.2 Weekly Test Schedule

| Day | Tests |
|-----|-------|
| Monday | TEST-VM-002, TEST-SEC-001, TEST-SEC-002 |
| Tuesday | TEST-NET-001, TEST-NET-002, TEST-NET-003 |
| Wednesday | TEST-AKS-003, TEST-AKS-004, TEST-AKS-005 |
| Thursday | TEST-INT-003, TEST-INT-004, TEST-INT-005 |
| Friday | TEST-PERF-001, TEST-PERF-002, TEST-MON-001 |

### 11.3 Monthly Test Schedule

| Week | Tests |
|------|-------|
| Week 1 | TEST-SEC-003, TEST-SEC-004 |
| Week 2 | TEST-BKP-002, TEST-BKP-003 |
| Week 3 | TEST-PERF-003, TEST-MON-002, TEST-MON-003 |
| Week 4 | TEST-VPN-002, TEST-VPN-003, TEST-STOR-002 |

### 11.4 Quarterly Test Schedule

| Quarter | Tests |
|---------|-------|
| Q1, Q2, Q3, Q4 | TEST-BKP-004 (Full VM Recovery) |

---

## 12. Test Results Template

### Test Execution Record

```markdown
## Test Execution: [TEST-ID]

**Date:** YYYY-MM-DD
**Executed By:** [Name]
**Environment:** Production / Staging

### Pre-Conditions
- [ ] VPN connected
- [ ] Azure CLI authenticated
- [ ] kubectl configured

### Execution Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Results
| Check | Expected | Actual | Pass/Fail |
|-------|----------|--------|-----------|
| [Check 1] | [Expected] | [Actual] | ✅/❌ |
| [Check 2] | [Expected] | [Actual] | ✅/❌ |

### Evidence
- Screenshot: [link]
- Logs: [link]

### Overall Result: PASS / FAIL

### Notes
[Any additional observations]

### Follow-up Actions
- [ ] [Action 1]
- [ ] [Action 2]
```

---

## Appendix A: Test Environment Access

### Required Permissions

| Test Category | Required Role |
|---------------|---------------|
| VM Tests | Virtual Machine Contributor |
| AKS Tests | Azure Kubernetes Service Cluster Admin |
| Storage Tests | Storage Blob Data Contributor |
| Key Vault Tests | Key Vault Secrets Officer |
| Network Tests | Network Contributor |
| Backup Tests | Backup Operator |

### Access Methods

| Resource | Access Method |
|----------|---------------|
| Azure Portal | https://portal.azure.com |
| Azure CLI | `az login` |
| AKS | `az aks get-credentials -g rg_prod -n dev-aks` |
| VMs | Azure Bastion (vnet_prod-bastion) |
| VPN | Azure VPN Client (P2S) |

---

## Appendix B: Contact Information

### Escalation Path

| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | DevOps Team | 15 minutes |
| L2 | IT Manager | 1 hour |
| L3 | External Support (Microsoft) | 4 hours |

### Key Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | [TBD] | [TBD] |
| Network Admin | [TBD] | [TBD] |
| Security Lead | [TBD] | [TBD] |
| Microsoft TAM | [TBD] | [TBD] |

---

*Document Version: 1.0*
*Last Updated: January 15, 2026*
*Next Review: February 15, 2026*
