# Feature Specification: Azure Infrastructure Foundation

**Feature Branch**: `001-azure-infra`
**Created**: 2026-01-14
**Status**: Draft
**Input**: User description: "Sprint 1: Azure Infrastructure - Establish all Azure resources required for Workload Identity and secure storage access including hardened storage account, managed identity, federated credentials, RBAC roles, and Secrets Store CSI Driver"

## Clarifications

### Session 2026-01-14

- Q: How will administrators know if infrastructure is working correctly post-deployment (observability)? → A: Teams notifications from n8n workflow
- Q: What is the recovery strategy if resources are accidentally deleted or corrupted? → A: Full recreate from IaC scripts (no manual state backup needed)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Storage Access for Agent Workloads (Priority: P1)

As a DevOps engineer, I need the Claude agent running in Kubernetes to securely read and write files to cloud storage without using static credentials, so that the system maintains security best practices and credentials cannot be leaked or compromised.

**Why this priority**: Storage access is the foundational capability that all agent operations depend on. Without secure storage, agents cannot persist state, upload artifacts, or retrieve configurations. This is the core infrastructure requirement.

**Independent Test**: Can be fully tested by deploying a pod with the configured identity and verifying it can list, read, and write blobs to storage containers using only its workload identity (no keys or connection strings).

**Acceptance Scenarios**:

1. **Given** a Kubernetes pod with the configured service account, **When** the pod attempts to authenticate to Azure, **Then** authentication succeeds using workload identity without any static credentials.

2. **Given** a successfully authenticated pod, **When** the pod attempts to list storage containers, **Then** all 6 configured containers are visible and accessible.

3. **Given** a successfully authenticated pod, **When** the pod attempts to upload a file to a container, **Then** the upload succeeds and the file is retrievable.

4. **Given** a pod without the configured service account, **When** it attempts to access storage, **Then** the request is denied.

---

### User Story 2 - Network-Isolated Storage (Priority: P2)

As a security administrator, I need the storage account to be accessible only from authorized networks, so that even if credentials were somehow obtained, attackers from the public internet cannot access the data.

**Why this priority**: Network isolation is critical for defense-in-depth. While workload identity prevents credential theft, network restrictions provide an additional security layer that blocks unauthorized access at the network level.

**Independent Test**: Can be fully tested by attempting to access the storage account from outside the authorized network (e.g., local machine without VPN) and verifying access is denied, then accessing from within the authorized network and verifying access succeeds.

**Acceptance Scenarios**:

1. **Given** a storage account with network restrictions enabled, **When** a request arrives from a non-authorized IP/subnet, **Then** the request is denied regardless of credentials.

2. **Given** a storage account with network restrictions enabled, **When** a request arrives from the authorized Kubernetes cluster subnet, **Then** the request is allowed (subject to RBAC).

3. **Given** a storage account with network restrictions enabled, **When** Azure's own services need access (for identity operations), **Then** the request is allowed through the Azure services bypass.

---

### User Story 3 - Secrets Access from Key Vault (Priority: P3)

As a DevOps engineer, I need the agent pods to securely retrieve secrets from Key Vault without embedding credentials in configuration files, so that sensitive credentials (like GitHub App keys) are centrally managed and automatically rotated.

**Why this priority**: Key Vault integration enables secure secrets management for GitHub credentials and other sensitive data. While storage is the primary data store, Key Vault provides the secure credential foundation for integrations.

**Independent Test**: Can be fully tested by deploying a pod with the CSI driver configured and verifying that secrets appear as mounted files in the expected location, with correct content matching Key Vault values.

**Acceptance Scenarios**:

1. **Given** a Kubernetes cluster with CSI driver enabled, **When** an administrator deploys a pod with SecretProviderClass, **Then** secrets from Key Vault are mounted as files in the pod.

2. **Given** a pod with mounted Key Vault secrets, **When** the pod reads the secret files, **Then** the content matches the values stored in Key Vault.

3. **Given** a pod identity without Key Vault access, **When** it attempts to mount secrets, **Then** the mount fails and the pod reports an error.

---

### Edge Cases

- What happens when the AKS cluster does not have a configured subnet (kubenet networking)?
  - Storage network rules cannot be applied; deployment proceeds with warning and manual network configuration required.

- What happens when the managed identity creation fails due to quota limits?
  - Deployment halts with clear error message; administrator must request quota increase or clean up unused identities.

- What happens when the federated credential subject doesn't match the service account?
  - Workload identity authentication fails; pods cannot authenticate to Azure resources.

- What happens when CSI driver pods are not healthy?
  - Secret mounts fail; pods using SecretProviderClass enter pending state with descriptive error.

- What happens when storage account name is already taken (globally unique)?
  - Creation fails; administrator must choose alternative name and update all references.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a storage account with public blob access disabled to prevent accidental data exposure.
- **FR-002**: System MUST enforce TLS 1.2 or higher for all storage account connections to ensure encryption in transit.
- **FR-003**: System MUST configure storage account to deny access by default, allowing only explicitly authorized networks.
- **FR-004**: System MUST create 6 blob containers for agent operations: agent-state, agent-spec, agent-plan, agent-verification, agent-review, agent-release.
- **FR-005**: System MUST create a user-assigned managed identity dedicated to agent workloads.
- **FR-006**: System MUST grant the managed identity "Storage Blob Data Contributor" role scoped specifically to the storage account (not resource group).
- **FR-007**: System MUST grant the managed identity "Key Vault Secrets User" role scoped specifically to the Key Vault.
- **FR-008**: System MUST create a federated credential binding the managed identity to a specific Kubernetes service account.
- **FR-009**: System MUST enable the Secrets Store CSI Driver add-on on the Kubernetes cluster.
- **FR-010**: System MUST configure storage network rules to allow traffic from the Kubernetes cluster subnet.
- **FR-011**: System MUST configure storage to allow Azure services bypass for identity token operations.
- **FR-012**: System MUST support observability through Teams notifications triggered by n8n workflows for infrastructure health alerts (auth failures, access denials).

### Key Entities

- **Storage Account**: Cloud storage resource containing blob containers for agent artifacts. Must be hardened with network restrictions and TLS requirements.
- **Managed Identity**: Azure identity resource that represents the agent workload. Receives RBAC role assignments and federates with Kubernetes service account.
- **Federated Credential**: Trust relationship binding the managed identity to a Kubernetes namespace and service account, enabling passwordless authentication.
- **Blob Container**: Logical storage unit within the storage account. Each container serves a specific agent workflow phase.
- **RBAC Role Assignment**: Permission grant linking an identity to a specific role at a specific scope.

### Assumptions

- The AKS cluster `dev-aks` already exists and is operational in the `rg_prod` resource group.
- The Key Vault `iius-akv` already exists and is accessible.
- The administrator has sufficient Azure RBAC permissions to create resources and role assignments.
- The Kubernetes namespace `claude-agent` will be created in a subsequent phase.
- The AKS cluster uses Azure CNI networking with a configured subnet (required for storage network rules).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent pods can authenticate to Azure and access storage within 30 seconds of startup, without any static credentials in configuration.
- **SC-002**: Storage account blocks 100% of requests from unauthorized networks (verifiable via access attempts from external IPs).
- **SC-003**: All 6 required blob containers are created and accessible to authorized workloads.
- **SC-004**: Managed identity has exactly the required permissions (Storage Blob Data Contributor, Key Vault Secrets User) at the correct scopes - no more, no less.
- **SC-005**: Federated credential authentication works on first pod deployment without manual token management.
- **SC-006**: CSI driver pods are healthy and ready to mount secrets within 5 minutes of add-on enablement.
- **SC-007**: Configuration can be reproduced from documented commands without manual portal changes (Infrastructure as Code compliance).
- **SC-008**: All infrastructure resources can be fully recreated from repository artifacts (quickstart.md runbook) within 15 minutes if accidentally deleted (no manual state backup required).
