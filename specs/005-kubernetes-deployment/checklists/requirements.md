# Requirements Checklist: Kubernetes Deployment

**Feature**: 005-kubernetes-deployment
**Spec Version**: 1.0
**Validated**: 2026-01-14

## Functional Requirements Validation

### Namespace and Service Account (US1)

| ID | Requirement | Testable | Clear | Complete |
|----|-------------|----------|-------|----------|
| FR-001 | Namespace MUST be named `claude-agent` with appropriate labels | [x] | [x] | [x] |
| FR-002 | ServiceAccount MUST have annotation `azure.workload.identity/client-id` with CLIENT_ID | [x] | [x] | [x] |
| FR-003 | ServiceAccount MUST have label `azure.workload.identity/use: "true"` | [x] | [x] | [x] |

### NetworkPolicies (US2)

| ID | Requirement | Testable | Clear | Complete |
|----|-------------|----------|-------|----------|
| FR-004 | Default-deny NetworkPolicy MUST block all ingress and egress by default | [x] | [x] | [x] |
| FR-005 | DNS egress NetworkPolicy MUST allow traffic to kube-dns on UDP/TCP 53 | [x] | [x] | [x] |
| FR-006 | Azure egress NetworkPolicy MUST allow traffic to Azure services on TCP 443 | [x] | [x] | [x] |
| FR-007 | n8n ingress NetworkPolicy MUST allow traffic from `n8n-prod` namespace pods with label `app: n8n` to port 3000 | [x] | [x] | [x] |

### Secret Management (US3)

| ID | Requirement | Testable | Clear | Complete |
|----|-------------|----------|-------|----------|
| FR-008 | SecretProviderClass MUST mount GitHub App credentials from Key Vault `iius-akv` | [x] | [x] | [x] |
| FR-009 | Kubernetes secret `claude-session` MUST contain Claude session token files | [x] | [x] | [x] |
| FR-010 | Kubernetes secret `teams-webhook` MUST contain Teams webhook URL | [x] | [x] | [x] |

### Deployment Security (US4)

| ID | Requirement | Testable | Clear | Complete |
|----|-------------|----------|-------|----------|
| FR-011 | Deployment MUST use image `iiusacr.azurecr.io/claude-agent:v4.6.2` | [x] | [x] | [x] |
| FR-012 | Deployment MUST run as non-root user (UID 1001) | [x] | [x] | [x] |
| FR-013 | Deployment MUST have `readOnlyRootFilesystem: true` with explicit writable mounts | [x] | [x] | [x] |
| FR-014 | Deployment MUST have `seccompProfile: RuntimeDefault` | [x] | [x] | [x] |
| FR-015 | Deployment MUST have `allowPrivilegeEscalation: false` and `capabilities: drop: ["ALL"]` | [x] | [x] | [x] |
| FR-016 | Deployment MUST have `terminationGracePeriodSeconds: 120` | [x] | [x] | [x] |
| FR-017 | Deployment MUST have `preStop` lifecycle hook with sleep 10 | [x] | [x] | [x] |
| FR-018 | Deployment MUST have init container to copy Claude session files to writable directory | [x] | [x] | [x] |

### Service (US5)

| ID | Requirement | Testable | Clear | Complete |
|----|-------------|----------|-------|----------|
| FR-019 | Service MUST be type ClusterIP exposing port 80 to target port 3000 | [x] | [x] | [x] |
| FR-020 | Service MUST select pods with label `app: claude-code-agent` | [x] | [x] | [x] |

## Success Criteria Validation

| ID | Criterion | Measurable | Achievable |
|----|-----------|------------|------------|
| SC-001 | Namespace and service account created within 1 minute | [x] | [x] |
| SC-002 | All 4 NetworkPolicies applied within 2 minutes | [x] | [x] |
| SC-003 | Pod reaches Running state within 5 minutes | [x] | [x] |
| SC-004 | Health endpoint responds within 1 second | [x] | [x] |
| SC-005 | Pod runs as UID 1001 | [x] | [x] |
| SC-006 | Security context includes required settings | [x] | [x] |
| SC-007 | Service reachable from n8n namespace | [x] | [x] |
| SC-008 | Graceful shutdown within 120 seconds | [x] | [x] |

## User Story Independence

| Story | Can be tested independently | Delivers standalone value |
|-------|----------------------------|--------------------------|
| US1 - Namespace/SA | [x] Apply manifests, verify annotations | [x] Enables Workload Identity |
| US2 - NetworkPolicies | [x] Apply policies, test connectivity | [x] Security isolation |
| US3 - Secrets | [x] Apply CSI/secrets, verify mounts | [x] Credential access |
| US4 - Deployment | [x] Apply deployment, check security | [x] Running agent |
| US5 - Service | [x] Apply service, test endpoints | [x] n8n integration |

## Dependency Verification

| Dependency | Required For | Verified Available |
|------------|--------------|-------------------|
| CLIENT_ID from Sprint 1 | FR-002 | [x] `866b8e62-d9ce-42d1-a6b0-4382baf39f7a` |
| GitHub credentials in Key Vault | FR-008 | [x] Sprint 2 complete |
| Claude session tokens | FR-009 | [x] Sprint 3 complete |
| Container image in ACR | FR-011 | [x] `v4.6.2` pushed |

## Summary

- **Total Requirements**: 20
- **Testable**: 20/20 (100%)
- **Clear**: 20/20 (100%)
- **Complete**: 20/20 (100%)

**Status**: Ready for `/speckit.plan`
