# Quickstart: Operations Dashboard

**Feature Branch**: `009-ops-dashboard`
**Date**: 2026-01-16

This runbook covers one-time setup steps for deploying the Operations Dashboard.

---

## Prerequisites

- Azure CLI installed and authenticated (`az login`)
- kubectl configured for the AKS cluster (`dev-aks`)
- Access to Azure AD as an admin (to create app registration and security group)
- Node.js 20+ installed locally (for development)

---

## Step 1: Create Azure AD Security Group

Create a security group for operators who will have access to the dashboard.

```bash
# Create security group
az ad group create \
  --display-name "Claude Agent Operators" \
  --mail-nickname "claude-agent-operators" \
  --description "Operators with access to Claude Agent Operations Dashboard"

# Note the group Object ID from output - you'll need it for configuration
# Example: "id": "12345678-1234-1234-1234-123456789abc"
```

Add operators to the group:

```bash
# Get user's object ID
az ad user show --id operator@yourdomain.com --query id -o tsv

# Add user to group
az ad group member add \
  --group "Claude Agent Operators" \
  --member-id <user-object-id>
```

---

## Step 2: Register Azure AD Application

Create an app registration for the dashboard.

```bash
# Create app registration
az ad app create \
  --display-name "Claude Agent Operations Dashboard" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://ops-dashboard.yourdomain.com" "http://localhost:5173"

# Note the Application (client) ID from output
# Example: "appId": "abcdef12-3456-7890-abcd-ef1234567890"
```

Configure the app:

```bash
APP_ID="<your-app-id>"

# Add API permissions for Microsoft Graph (to read group membership)
az ad app permission add \
  --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions 5f8c59db-677d-491f-a6b8-5f174b11ec1d=Scope

# Grant admin consent
az ad app permission admin-consent --id $APP_ID
```

Configure token claims to include groups:

1. Go to Azure Portal > Azure Active Directory > App registrations
2. Select "Claude Agent Operations Dashboard"
3. Go to Token configuration
4. Click "Add groups claim"
5. Select "Security groups"
6. Save

---

## Step 3: Create Kubernetes Namespace and Service Account

```bash
# Create namespace for dashboard
kubectl create namespace ops-dashboard

# Apply service account with required RBAC
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ops-dashboard
  namespace: ops-dashboard
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ops-dashboard-role
  namespace: claude-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets"]
    verbs: ["get", "list", "create", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "patch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ops-dashboard-binding
  namespace: claude-agent
subjects:
  - kind: ServiceAccount
    name: ops-dashboard
    namespace: ops-dashboard
roleRef:
  kind: Role
  name: ops-dashboard-role
  apiGroup: rbac.authorization.k8s.io
EOF
```

---

## Step 4: Create Configuration Secret

Store the Azure AD configuration in a Kubernetes secret:

```bash
kubectl create secret generic ops-dashboard-config -n ops-dashboard \
  --from-literal=AZURE_AD_CLIENT_ID="<your-app-id>" \
  --from-literal=AZURE_AD_TENANT_ID="<your-tenant-id>" \
  --from-literal=AUTHORIZED_GROUP_ID="<security-group-object-id>" \
  --from-literal=CLAUDE_AGENT_NAMESPACE="claude-agent" \
  --from-literal=CLAUDE_AGENT_SERVICE="http://claude-agent.claude-agent.svc.cluster.local"
```

---

## Step 5: Deploy NetworkPolicy

Apply default-deny policy for the dashboard namespace:

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: ops-dashboard
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: ops-dashboard
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-azure-ad
  namespace: ops-dashboard
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - protocol: TCP
          port: 443
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress
  namespace: ops-dashboard
spec:
  podSelector:
    matchLabels:
      app: ops-dashboard
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-claude-agent
  namespace: ops-dashboard
spec:
  podSelector:
    matchLabels:
      app: ops-dashboard
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: claude-agent
      ports:
        - protocol: TCP
          port: 3000
EOF
```

---

## Step 6: Configure Ingress (Optional)

If using NGINX Ingress Controller:

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ops-dashboard
  namespace: ops-dashboard
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ops-dashboard.yourdomain.com
      secretName: ops-dashboard-tls
  rules:
    - host: ops-dashboard.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ops-dashboard
                port:
                  number: 80
EOF
```

---

## Step 7: Verify Setup

Run these commands to verify the setup:

```bash
# Check namespace exists
kubectl get namespace ops-dashboard

# Check service account and RBAC
kubectl get serviceaccount ops-dashboard -n ops-dashboard
kubectl get rolebinding ops-dashboard-binding -n claude-agent

# Check secrets exist
kubectl get secret ops-dashboard-config -n ops-dashboard

# Check network policies
kubectl get networkpolicies -n ops-dashboard
```

---

## Configuration Reference

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `AZURE_AD_CLIENT_ID` | Azure AD app registration client ID | `abcdef12-3456-...` |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID | `12345678-1234-...` |
| `AUTHORIZED_GROUP_ID` | Security group object ID for access control | `87654321-4321-...` |
| `CLAUDE_AGENT_NAMESPACE` | Namespace where Claude agent runs | `claude-agent` |
| `CLAUDE_AGENT_SERVICE` | URL to Claude agent service | `http://claude-agent...` |
| `PORT` | Port for dashboard backend | `3000` |

---

## Next Steps

After completing this setup:

1. Build and push the dashboard container image (see CI/CD)
2. Apply the deployment manifest
3. Verify dashboard is accessible
4. Add operators to the Azure AD security group
5. Test token refresh workflow

---

## Troubleshooting

### "Access Denied" after Azure AD login

- Verify user is member of the security group: `az ad group member check --group "Claude Agent Operators" --member-id <user-id>`
- Verify group ID in configuration matches the actual group
- Check if groups claim is included in ID token (Azure Portal > App > Token configuration)

### Cannot reach Claude agent from dashboard

- Check NetworkPolicy allows egress to claude-agent namespace
- Verify service URL is correct: `kubectl get svc -n claude-agent`
- Test connectivity: `kubectl exec -n ops-dashboard deploy/ops-dashboard -- curl http://claude-agent.claude-agent.svc.cluster.local/health`

### RBAC permission denied

- Verify RoleBinding exists: `kubectl get rolebinding ops-dashboard-binding -n claude-agent`
- Check Role has correct permissions: `kubectl describe role ops-dashboard-role -n claude-agent`
