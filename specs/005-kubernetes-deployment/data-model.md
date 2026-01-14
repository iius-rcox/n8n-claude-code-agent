# Data Model: Kubernetes Deployment

**Feature**: 005-kubernetes-deployment
**Date**: 2026-01-14
**Status**: Complete

## Kubernetes Resource Entities

### Namespace

**Purpose**: Isolated environment for all Claude agent resources.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `v1` | Yes |
| kind | string | `Namespace` | Yes |
| metadata.name | string | `claude-agent` | Yes |
| metadata.labels.app | string | `claude-code-agent` | Yes |

---

### ServiceAccount

**Purpose**: Identity for pods with Workload Identity federation to Azure managed identity.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `v1` | Yes |
| kind | string | `ServiceAccount` | Yes |
| metadata.name | string | `claude-agent-sa` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| metadata.annotations."azure.workload.identity/client-id" | string | `866b8e62-d9ce-42d1-a6b0-4382baf39f7a` | Yes |
| metadata.labels."azure.workload.identity/use" | string | `"true"` | Yes |

---

### NetworkPolicy (Default Deny)

**Purpose**: Block all ingress and egress by default for pods in namespace.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `networking.k8s.io/v1` | Yes |
| kind | string | `NetworkPolicy` | Yes |
| metadata.name | string | `default-deny-all` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.podSelector | object | `{}` (selects all pods) | Yes |
| spec.policyTypes | array | `["Ingress", "Egress"]` | Yes |

---

### NetworkPolicy (Allow DNS)

**Purpose**: Permit DNS resolution via kube-dns.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `networking.k8s.io/v1` | Yes |
| kind | string | `NetworkPolicy` | Yes |
| metadata.name | string | `allow-dns` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.podSelector | object | `{}` | Yes |
| spec.policyTypes | array | `["Egress"]` | Yes |
| spec.egress[0].to[0].namespaceSelector.matchLabels | object | `{"kubernetes.io/metadata.name": "kube-system"}` | Yes |
| spec.egress[0].to[0].podSelector.matchLabels | object | `{"k8s-app": "kube-dns"}` | Yes |
| spec.egress[0].ports | array | `[{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]` | Yes |

---

### NetworkPolicy (Allow Azure)

**Purpose**: Permit HTTPS traffic to Azure services.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `networking.k8s.io/v1` | Yes |
| kind | string | `NetworkPolicy` | Yes |
| metadata.name | string | `allow-azure-egress` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.podSelector | object | `{}` | Yes |
| spec.policyTypes | array | `["Egress"]` | Yes |
| spec.egress[0].ports | array | `[{protocol: TCP, port: 443}]` | Yes |

**Note**: Egress to 0.0.0.0/0 on port 443. More restrictive CIDR ranges could be used but Azure service IPs change.

---

### NetworkPolicy (Allow n8n Ingress)

**Purpose**: Permit HTTP traffic from n8n pods.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `networking.k8s.io/v1` | Yes |
| kind | string | `NetworkPolicy` | Yes |
| metadata.name | string | `allow-ingress-from-n8n` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.podSelector.matchLabels | object | `{"app": "claude-code-agent"}` | Yes |
| spec.policyTypes | array | `["Ingress"]` | Yes |
| spec.ingress[0].from[0].namespaceSelector.matchLabels | object | `{"kubernetes.io/metadata.name": "n8n-prod"}` | Yes |
| spec.ingress[0].from[0].podSelector.matchLabels | object | `{"app": "n8n"}` | Yes |
| spec.ingress[0].ports | array | `[{protocol: TCP, port: 3000}]` | Yes |

---

### SecretProviderClass

**Purpose**: CSI Driver configuration for mounting GitHub credentials from Key Vault.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `secrets-store.csi.x-k8s.io/v1` | Yes |
| kind | string | `SecretProviderClass` | Yes |
| metadata.name | string | `github-app-akv` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.provider | string | `azure` | Yes |
| spec.parameters.usePodIdentity | string | `"false"` | Yes |
| spec.parameters.useVMManagedIdentity | string | `"false"` | Yes |
| spec.parameters.clientID | string | `866b8e62-d9ce-42d1-a6b0-4382baf39f7a` | Yes |
| spec.parameters.keyvaultName | string | `iius-akv` | Yes |
| spec.parameters.tenantId | string | Azure tenant ID | Yes |
| spec.parameters.objects | string | YAML array of secrets | Yes |

**Objects Configuration**:
```yaml
objects: |
  array:
    - |
      objectName: github-app-id
      objectType: secret
      objectAlias: app-id
    - |
      objectName: github-app-private-key
      objectType: secret
      objectAlias: private-key.pem
```

---

### Secret (Claude Session)

**Purpose**: Kubernetes secret containing Claude session token files.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `v1` | Yes |
| kind | string | `Secret` | Yes |
| metadata.name | string | `claude-session` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| type | string | `Opaque` | Yes |
| data | object | Base64-encoded session files | Yes |

**Note**: Created from local Claude session files via kubectl.

---

### Secret (Teams Webhook)

**Purpose**: Kubernetes secret containing Teams webhook URL.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `v1` | Yes |
| kind | string | `Secret` | Yes |
| metadata.name | string | `teams-webhook` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| type | string | `Opaque` | Yes |
| data.url | string | Base64-encoded webhook URL | Yes |

---

### Deployment

**Purpose**: Main workload running the Claude agent container.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `apps/v1` | Yes |
| kind | string | `Deployment` | Yes |
| metadata.name | string | `claude-code-agent` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.replicas | integer | `1` | Yes |
| spec.strategy.type | string | `Recreate` | Yes |
| spec.selector.matchLabels | object | `{"app": "claude-code-agent"}` | Yes |

**Pod Template Spec**:

| Field | Type | Value | Required |
|-------|------|-------|----------|
| metadata.labels.app | string | `claude-code-agent` | Yes |
| metadata.labels."azure.workload.identity/use" | string | `"true"` | Yes |
| spec.serviceAccountName | string | `claude-agent-sa` | Yes |
| spec.terminationGracePeriodSeconds | integer | `120` | Yes |

**Pod Security Context**:

| Field | Type | Value |
|-------|------|-------|
| runAsNonRoot | boolean | `true` |
| runAsUser | integer | `1001` |
| runAsGroup | integer | `1001` |
| fsGroup | integer | `1001` |
| seccompProfile.type | string | `RuntimeDefault` |

**Container Spec**:

| Field | Type | Value |
|-------|------|-------|
| name | string | `claude-agent` |
| image | string | `iiusacr.azurecr.io/claude-agent:v4.6.2` |
| ports[0].containerPort | integer | `3000` |
| securityContext.allowPrivilegeEscalation | boolean | `false` |
| securityContext.capabilities.drop | array | `["ALL"]` |
| securityContext.readOnlyRootFilesystem | boolean | `true` |

**Volume Mounts**:

| Mount Path | Volume Name | Read-Only |
|------------|-------------|-----------|
| /home/claude-agent/.claude | claude-home | No |
| /home/claude-agent/.azure | azure-home | No |
| /tmp | tmp | No |
| /workspace | workspace | No |
| /secrets/github | github-secrets | Yes |

---

### Service

**Purpose**: ClusterIP service exposing HTTP endpoints for n8n access.

| Field | Type | Value | Required |
|-------|------|-------|----------|
| apiVersion | string | `v1` | Yes |
| kind | string | `Service` | Yes |
| metadata.name | string | `claude-agent` | Yes |
| metadata.namespace | string | `claude-agent` | Yes |
| spec.type | string | `ClusterIP` | Yes |
| spec.selector.app | string | `claude-code-agent` | Yes |
| spec.ports[0].name | string | `http` | Yes |
| spec.ports[0].port | integer | `80` | Yes |
| spec.ports[0].targetPort | integer | `3000` | Yes |
| spec.ports[0].protocol | string | `TCP` | Yes |

**Service DNS Name**: `claude-agent.claude-agent.svc.cluster.local`

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    claude-agent Namespace                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │   ServiceAccount │    │         NetworkPolicies       │  │
│  │  claude-agent-sa │    │  - default-deny-all          │  │
│  │                  │    │  - allow-dns                 │  │
│  │  ↳ Workload ID   │    │  - allow-azure-egress        │  │
│  │    annotation    │    │  - allow-ingress-from-n8n    │  │
│  └────────┬─────────┘    └──────────────────────────────┘  │
│           │                                                 │
│           ▼                                                 │
│  ┌────────────────────────────────────────────────────────┐│
│  │                      Deployment                         ││
│  │                   claude-code-agent                     ││
│  │                                                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ ││
│  │  │ Init        │  │ Main        │  │ Volumes        │ ││
│  │  │ Container   │  │ Container   │  │                │ ││
│  │  │             │  │             │  │ - claude-home  │ ││
│  │  │ Copies      │──│ claude-     │──│ - azure-home   │ ││
│  │  │ session     │  │ agent:v4.6.2│  │ - tmp          │ ││
│  │  │ tokens      │  │             │  │ - workspace    │ ││
│  │  └─────────────┘  └─────────────┘  │ - github-csi   │ ││
│  │                                     └────────────────┘ ││
│  └────────────────────────────────────────────────────────┘│
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │     Service      │◄──── n8n-prod namespace              │
│  │   claude-agent   │      (port 80 → 3000)                │
│  │   ClusterIP      │                                      │
│  └──────────────────┘                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                      Secrets                         │   │
│  │                                                      │   │
│  │  ┌─────────────────┐  ┌────────────────────────┐   │   │
│  │  │ SecretProvider  │  │ K8s Secrets            │   │   │
│  │  │ Class           │  │                        │   │   │
│  │  │                 │  │ - claude-session       │   │   │
│  │  │ github-app-akv  │  │ - teams-webhook        │   │   │
│  │  │ (CSI Driver)    │  │                        │   │   │
│  │  └────────┬────────┘  └────────────────────────┘   │   │
│  │           │                                         │   │
│  │           ▼                                         │   │
│  │    Azure Key Vault (iius-akv)                      │   │
│  │    - github-app-id                                 │   │
│  │    - github-app-private-key                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

| Entity | Rule | Error Message |
|--------|------|---------------|
| Namespace | Name must be `claude-agent` | "Invalid namespace name" |
| ServiceAccount | Must have workload identity annotation | "Missing azure.workload.identity/client-id annotation" |
| ServiceAccount | Must have workload identity label | "Missing azure.workload.identity/use label" |
| NetworkPolicy | Must target claude-agent namespace | "NetworkPolicy must be in claude-agent namespace" |
| Deployment | Must use non-root user | "runAsNonRoot must be true" |
| Deployment | Must drop all capabilities | "capabilities.drop must include ALL" |
| Deployment | Must have readOnlyRootFilesystem | "readOnlyRootFilesystem must be true" |
| Service | Must be ClusterIP type | "Service must be ClusterIP, not LoadBalancer or NodePort" |
