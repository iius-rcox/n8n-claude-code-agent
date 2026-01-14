# Feature Specification: Kubernetes Deployment

**Feature Branch**: `005-kubernetes-deployment`
**Created**: 2026-01-14
**Status**: Draft
**Input**: Sprint 5 from sprint-plan-v4.6.2.md - Deploy all Kubernetes resources with security hardening and n8n integration

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Namespace and Service Account Configuration (Priority: P1)

As a DevOps engineer, I need a dedicated Kubernetes namespace with a properly configured service account so that the Claude agent can authenticate to Azure services using Workload Identity.

**Why this priority**: Without a namespace and service account with Workload Identity annotation, no pods can be deployed and Azure authentication will fail. This is the foundational infrastructure that enables all other deployments.

**Independent Test**: Can be fully tested by applying namespace/service account manifests and verifying the service account has the correct Azure Workload Identity annotation.

**Acceptance Scenarios**:

1. **Given** I apply the namespace manifest, **When** the namespace is created, **Then** namespace `claude-agent` exists with appropriate labels
2. **Given** the namespace exists, **When** I apply the service account manifest, **Then** service account `claude-agent-sa` has annotation `azure.workload.identity/client-id` with the managed identity CLIENT_ID
3. **Given** the service account exists, **When** I describe it, **Then** it shows the label `azure.workload.identity/use: "true"`

---

### User Story 2 - Network Security with NetworkPolicies (Priority: P2)

As a security engineer, I need NetworkPolicies that enforce default-deny with explicit allow rules so that the Claude agent pod is isolated and only permitted traffic can reach it.

**Why this priority**: NetworkPolicies provide defense-in-depth security. Without them, any pod in the cluster could communicate with the Claude agent, violating the principle of least privilege.

**Independent Test**: Can be fully tested by applying NetworkPolicy manifests and verifying that only permitted traffic (DNS, Azure services, n8n ingress) is allowed while all other traffic is blocked.

**Acceptance Scenarios**:

1. **Given** I apply the default-deny NetworkPolicy, **When** I describe it, **Then** it denies all ingress and egress for pods in `claude-agent` namespace
2. **Given** default-deny is active, **When** I apply the DNS egress policy, **Then** pods can resolve DNS via kube-dns on UDP/TCP 53
3. **Given** default-deny is active, **When** I apply the Azure services policy, **Then** pods can reach Azure endpoints on TCP 443
4. **Given** default-deny is active, **When** I apply the n8n ingress policy, **Then** pods in `n8n-prod` namespace with label `app: n8n` can reach claude-agent on port 3000

---

### User Story 3 - Secret Management with CSI Driver and Kubernetes Secrets (Priority: P3)

As a DevOps engineer, I need GitHub App credentials mounted via CSI Driver from Key Vault and Claude session tokens as Kubernetes secrets so that the agent can authenticate to both GitHub and Claude.

**Why this priority**: Without credentials, the agent cannot perform its core function of interacting with GitHub repositories or executing Claude prompts.

**Independent Test**: Can be fully tested by applying SecretProviderClass and secrets, then verifying files are mounted correctly in a test pod.

**Acceptance Scenarios**:

1. **Given** I apply the SecretProviderClass, **When** a pod mounts the CSI volume, **Then** GitHub App credentials are available at `/secrets/github/`
2. **Given** I create the claude-session secret, **When** the init container runs, **Then** Claude session files are copied to the Claude home directory
3. **Given** I create the teams-webhook secret, **When** the pod starts, **Then** the webhook URL is available as an environment variable

---

### User Story 4 - Deployment with Security Hardening (Priority: P4)

As a DevOps engineer, I need a hardened Deployment manifest that runs the Claude agent with security best practices including read-only filesystem, dropped capabilities, and graceful shutdown.

**Why this priority**: The deployment is the main workload that runs the Claude agent. Security hardening prevents privilege escalation and limits blast radius of potential compromises.

**Independent Test**: Can be fully tested by applying the deployment manifest and verifying pod security context, volume mounts, and that the health endpoint responds.

**Acceptance Scenarios**:

1. **Given** I apply the deployment, **When** the pod starts, **Then** it runs as non-root user (UID 1001)
2. **Given** the pod is running, **When** I exec into it, **Then** the root filesystem is read-only except for explicit writable mounts
3. **Given** the pod is running, **When** I describe it, **Then** it has `seccompProfile: RuntimeDefault` and `allowPrivilegeEscalation: false`
4. **Given** the pod is running, **When** I send SIGTERM, **Then** it completes in-flight requests before shutting down (up to 120s grace period)

---

### User Story 5 - Service Exposure for n8n Integration (Priority: P5)

As an n8n workflow developer, I need a ClusterIP Service that exposes the Claude agent HTTP server so that n8n can invoke prompts via HTTP requests.

**Why this priority**: The Service is the integration point between n8n and the Claude agent. Without it, n8n cannot reach the agent's endpoints.

**Independent Test**: Can be fully tested by applying the service manifest and verifying connectivity from the n8n namespace to the service endpoint.

**Acceptance Scenarios**:

1. **Given** I apply the service manifest, **When** I describe the service, **Then** it routes port 80 to target port 3000 on pods with label `app: claude-code-agent`
2. **Given** the service exists, **When** n8n sends a request to `http://claude-agent.claude-agent.svc.cluster.local/health`, **Then** it receives a JSON response with `status: healthy`
3. **Given** the service exists, **When** n8n sends a POST to `/run` with a prompt, **Then** it receives a JSON response with the Claude execution result

---

### Edge Cases

- What happens when CSI Driver fails to mount secrets? Pod enters CrashLoopBackOff with clear error message indicating Key Vault access failure.
- What happens when Claude session tokens are expired? Health check passes but `/run` returns error with exit code 57, triggering auth watchdog notification.
- What happens when n8n sends a request during pod termination? Server returns 503 with `status: shutting_down` during graceful shutdown.
- What happens when NetworkPolicy blocks legitimate traffic? Pod cannot reach required services; administrator must check and update NetworkPolicies.
- What happens when init container fails to copy session files? Pod enters CrashLoopBackOff; administrator must verify claude-session secret exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Namespace MUST be named `claude-agent` with appropriate labels
- **FR-002**: ServiceAccount MUST have annotation `azure.workload.identity/client-id` with CLIENT_ID `866b8e62-d9ce-42d1-a6b0-4382baf39f7a`
- **FR-003**: ServiceAccount MUST have label `azure.workload.identity/use: "true"`
- **FR-004**: Default-deny NetworkPolicy MUST block all ingress and egress by default
- **FR-005**: DNS egress NetworkPolicy MUST allow traffic to kube-dns on UDP/TCP 53
- **FR-006**: Azure egress NetworkPolicy MUST allow traffic to Azure services on TCP 443
- **FR-007**: n8n ingress NetworkPolicy MUST allow traffic from `n8n-prod` namespace pods with label `app: n8n` to port 3000
- **FR-008**: SecretProviderClass MUST mount GitHub App credentials from Key Vault `iius-akv`
- **FR-009**: Kubernetes secret `claude-session` MUST contain Claude session token files
- **FR-010**: Kubernetes secret `teams-webhook` MUST contain Teams webhook URL
- **FR-011**: Deployment MUST use image `iiusacr.azurecr.io/claude-agent:v4.6.2`
- **FR-012**: Deployment MUST run as non-root user (UID 1001)
- **FR-013**: Deployment MUST have `readOnlyRootFilesystem: true` with explicit writable mounts
- **FR-014**: Deployment MUST have `seccompProfile: RuntimeDefault`
- **FR-015**: Deployment MUST have `allowPrivilegeEscalation: false` and `capabilities: drop: ["ALL"]`
- **FR-016**: Deployment MUST have `terminationGracePeriodSeconds: 120`
- **FR-017**: Deployment MUST have `preStop` lifecycle hook with sleep 10
- **FR-018**: Deployment MUST have init container to copy Claude session files to writable directory
- **FR-019**: Service MUST be type ClusterIP exposing port 80 to target port 3000
- **FR-020**: Service MUST select pods with label `app: claude-code-agent`

### Key Entities

- **Namespace**: Isolated environment `claude-agent` for all Claude agent resources
- **ServiceAccount**: Identity `claude-agent-sa` with Workload Identity federation to Azure managed identity
- **NetworkPolicy**: Four policies controlling traffic flow (default-deny, dns-egress, azure-egress, n8n-ingress)
- **SecretProviderClass**: CSI Driver configuration for mounting GitHub credentials from Key Vault
- **Deployment**: Main workload running the Claude agent container with security hardening
- **Service**: ClusterIP service exposing HTTP endpoints for n8n integration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Namespace and service account created within 1 minute of applying manifests
- **SC-002**: All 4 NetworkPolicies applied and verified within 2 minutes
- **SC-003**: Pod reaches Running state within 5 minutes of applying deployment
- **SC-004**: Health endpoint responds within 1 second after pod is ready
- **SC-005**: Pod runs as UID 1001 (non-root) verified via `kubectl exec whoami`
- **SC-006**: Pod security context includes `readOnlyRootFilesystem: true` and `seccompProfile: RuntimeDefault`
- **SC-007**: Service endpoint reachable from n8n namespace via DNS name `claude-agent.claude-agent.svc.cluster.local`
- **SC-008**: Graceful shutdown completes within 120 seconds while preserving in-flight requests

## Assumptions

- AKS cluster `dev-aks` is operational with OIDC issuer enabled
- Workload Identity is configured with federated credential for `system:serviceaccount:claude-agent:claude-agent-sa`
- Managed identity `claude-agent-identity` has Storage Blob Data Contributor and Key Vault Secrets User roles
- CSI Secrets Store Driver add-on is enabled on the AKS cluster
- Key Vault `iius-akv` contains `github-app-id` and `github-app-private-key` secrets
- Container image `iiusacr.azurecr.io/claude-agent:v4.6.2` is available in ACR
- n8n deployment exists in namespace `n8n-prod` with pods labeled `app: n8n`

## Dependencies

- **Sprint 1 (Azure Infrastructure)**: CLIENT_ID `866b8e62-d9ce-42d1-a6b0-4382baf39f7a` for service account annotation
- **Sprint 2 (GitHub App)**: Credentials stored in Key Vault for CSI mounting
- **Sprint 3 (Claude Session)**: Fresh session tokens for Kubernetes secret
- **Sprint 4 (Docker Image)**: Image `iiusacr.azurecr.io/claude-agent:v4.6.2` in ACR

## Out of Scope

- CronJob for authentication watchdog (Sprint 7)
- Teams notification workflow setup (Sprint 7)
- End-to-end n8n integration testing (Sprint 6)
- Multi-replica deployments (single replica pattern for this sprint)
- Horizontal Pod Autoscaler configuration
