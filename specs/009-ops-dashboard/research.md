# Research: Operations Dashboard

**Feature Branch**: `009-ops-dashboard`
**Date**: 2026-01-16

## Research Summary

This document captures technical decisions and best practices for implementing the Operations Dashboard.

---

## 1. Azure AD SSO with MSAL React

### Decision
Use `@azure/msal-react` with `PublicClientApplication` for Azure AD SSO authentication, with group membership checked via ID token claims or Microsoft Graph API fallback.

### Rationale
- Official Microsoft library with active maintenance
- Built-in token caching and silent refresh
- React hooks integration (`useMsal`, `useIsAuthenticated`)
- Handles token lifecycle automatically

### Implementation Pattern

```typescript
// msal-config.ts
import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // Higher security per tab
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
```

### Group-Based Access Control

**Approach**: Check `groups` claim in ID token; fallback to Graph API for overage handling.

```typescript
const idTokenClaims = accounts[0]?.idTokenClaims;
const groups = idTokenClaims?.groups || [];
const isAuthorized = groups.includes(AUTHORIZED_GROUP_ID);

// Handle overage (>200 groups) - check _claim_names
if (idTokenClaims?._claim_names?.groups) {
  // Query Microsoft Graph /me/memberOf
}
```

**Required Azure AD Setup**:
1. Register application in Azure AD
2. Configure ID token to include groups claim
3. Create security group for dashboard access
4. Add authorized operators to the group

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Custom JWT auth | Would need to build token management, refresh logic |
| Azure AD B2C | Designed for customer-facing apps, not internal tools |
| OpenID Connect manually | MSAL handles all OIDC complexity already |

---

## 2. Kubernetes Client for Node.js

### Decision
Use `@kubernetes/client-node` with in-cluster authentication via service account.

### Rationale
- Official Kubernetes client library
- Automatic service account detection when running in-cluster
- TypeScript support with generated API types
- Supports all required operations (pods, deployments, secrets, jobs, cronjobs)

### In-Cluster Authentication

```typescript
import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // Auto-detects in-cluster service account

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const batchApi = kc.makeApiClient(k8s.BatchV1Api);
```

### Key Operations

**Query Pod Status**:
```typescript
const pods = await coreApi.listNamespacedPod('claude-agent');
// Check pod.status.phase, pod.status.containerStatuses
```

**Create/Delete Secrets**:
```typescript
// Delete old secret
await coreApi.deleteNamespacedSecret('claude-session', 'claude-agent');

// Create new secret
const secret = new k8s.V1Secret();
secret.metadata = { name: 'claude-session' };
secret.data = {
  'credentials.json': Buffer.from(credentialsJson).toString('base64'),
  'settings.json': Buffer.from(settingsJson).toString('base64'),
};
await coreApi.createNamespacedSecret('claude-agent', secret);
```

**Trigger Deployment Rollout Restart**:
```typescript
const patch = {
  spec: {
    template: {
      metadata: {
        annotations: {
          'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
        }
      }
    }
  }
};

await appsApi.patchNamespacedDeployment(
  'claude-agent', 'claude-agent', patch,
  undefined, undefined, undefined, undefined,
  { headers: { 'Content-Type': 'application/merge-patch+json' } }
);
```

**Create Job from CronJob (Manual Trigger)**:
```typescript
const cronJob = await batchApi.readNamespacedCronJob('auth-watchdog', 'claude-agent');
const job = new k8s.V1Job();
job.apiVersion = 'batch/v1';
job.kind = 'Job';
job.metadata = {
  name: `auth-watchdog-manual-${Date.now()}`,
  annotations: { 'cronjob.kubernetes.io/instantiate': 'manual' }
};
job.spec = cronJob.body.spec.jobTemplate.spec;
await batchApi.createNamespacedJob('claude-agent', job);
```

### Required RBAC Permissions

```yaml
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
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| kubectl exec from Node.js | Security risk, harder to test, no type safety |
| Direct K8s REST API | Would need to implement auth, pagination, error handling |
| Helm SDK | Overkill for read/write operations |

---

## 3. Dashboard UI with React + shadcn/ui

### Decision
Use shadcn/ui Card components for dashboard panels with polling for real-time updates.

### Rationale
- shadcn/ui already configured in project (MCP server available)
- Card component provides modular, accessible structure
- Polling is simpler than SSE/WebSocket for this use case (30-second refresh interval)
- Skeleton loaders provide better perceived performance than spinners

### Component Structure

**Dashboard Layout**:
```
+------------------+------------------+
|   Health Panel   |  Auth Status     |
|   (Card)         |  (Card)          |
+------------------+------------------+
|   Token Refresh  |  CronJob Panel   |
|   (Card)         |  (Card)          |
+------------------+------------------+
|   Agent Executor (Card)             |
+-------------------------------------+
|   Execution History (Card + Table)  |
+-------------------------------------+
```

**shadcn/ui Components to Use**:
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `Badge` (status indicators: success/error/warning)
- `Button`, `Input`, `Textarea`
- `Progress` (for multi-step operations)
- `Skeleton` (loading states)
- `Alert` (error messages)

### Real-Time Updates: Polling

**Decision**: Use polling with 30-second interval for health status.

**Rationale**:
- Dashboard requirements allow 30-second staleness (SC-004)
- Simpler to implement and debug than SSE/WebSocket
- No persistent connection management needed
- Adequate for internal ops tool with few users

```typescript
// useHealth hook
const [health, setHealth] = useState<HealthStatus | null>(null);

useEffect(() => {
  const fetchHealth = async () => {
    const data = await api.getHealth();
    setHealth(data);
  };

  fetchHealth();
  const interval = setInterval(fetchHealth, 30000);
  return () => clearInterval(interval);
}, []);
```

### Loading States: Skeleton Screens

**Decision**: Use skeleton loaders that match component layout.

```tsx
// HealthPanelSkeleton.tsx
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-32" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-3/4" />
  </CardContent>
</Card>
```

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Server-Sent Events | Added complexity; polling meets 30s requirement |
| WebSocket | Bidirectional not needed; adds scaling complexity |
| Material UI | Already have shadcn/ui; would add bundle size |
| Real-time DB (Firebase) | Overkill; no persistent data storage needed |

---

## 4. CLI Push Script for Credentials

### Decision
Provide a PowerShell script that reads local Claude credentials and POSTs them to a secure dashboard endpoint.

### Rationale
- Operators already run `claude /login` locally
- Script is a natural extension of existing workflow
- No file upload UI complexity
- Credentials transmitted over HTTPS, never stored in browser

### Implementation Pattern

```powershell
# push-credentials.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$DashboardUrl,

    [Parameter(Mandatory=$true)]
    [string]$SessionToken
)

$credentialsPath = "$env:USERPROFILE\.claude\.credentials.json"
$settingsPath = "$env:USERPROFILE\.claude\settings.json"

if (-not (Test-Path $credentialsPath)) {
    Write-Error "Credentials not found. Run 'claude /login' first."
    exit 1
}

$payload = @{
    credentials = Get-Content $credentialsPath -Raw
    settings = Get-Content $settingsPath -Raw
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $SessionToken"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$DashboardUrl/api/credentials/push" `
        -Method POST -Headers $headers -Body $payload
    Write-Host "Credentials pushed successfully. Refresh will begin shortly."
} catch {
    Write-Error "Failed to push credentials: $_"
    exit 1
}
```

### Security Considerations
- Session token required (obtained from dashboard UI after Azure AD login)
- HTTPS only
- Token validated against Azure AD session
- Credentials processed immediately, not persisted on server

---

## Summary of Technical Decisions

| Area | Decision | Key Library/Tool |
|------|----------|------------------|
| Authentication | Azure AD SSO | @azure/msal-react |
| Authorization | Group membership check | ID token claims + Graph API |
| K8s Operations | In-cluster client | @kubernetes/client-node |
| Frontend | React SPA | React 18 + shadcn/ui |
| Build Tool | Vite | vite |
| Real-time Updates | Polling (30s) | setInterval + fetch |
| Loading States | Skeleton screens | shadcn/ui Skeleton |
| CLI Script | PowerShell | Invoke-RestMethod |
| Backend | Node.js API | Express or Fastify |
