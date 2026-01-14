# Feature Specification: GitHub App Integration

**Feature Branch**: `002-github-app`
**Created**: 2026-01-14
**Status**: Draft
**Input**: User description: "Sprint 2: GitHub App - Create GitHub App and store credentials in Key Vault for CSI Driver mounting"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Repository Access (Priority: P1)

As a DevOps engineer, I need the Claude agent running in Kubernetes to authenticate with GitHub without using personal access tokens, so that repository operations (cloning, pushing, creating PRs) work reliably and credentials are tied to the application rather than an individual user.

**Why this priority**: This is the foundational capability that enables all GitHub operations in the multi-agent system. Without GitHub authentication, agents cannot interact with repositories to create PRs, manage issues, or access code.

**Independent Test**: Can be fully tested by deploying a pod that retrieves GitHub App credentials from Key Vault and successfully authenticates to list repositories in the organization.

**Acceptance Scenarios**:

1. **Given** a GitHub App created in the ii-us organization, **When** the App ID and private key are retrieved from Key Vault, **Then** a valid installation access token can be generated.

2. **Given** a valid installation access token, **When** the agent attempts to list repositories, **Then** only repositories where the App is installed are visible.

3. **Given** a valid installation access token, **When** the agent attempts to clone a private repository, **Then** the clone succeeds without prompting for credentials.

4. **Given** a valid installation access token, **When** the agent creates a pull request, **Then** the PR is attributed to the GitHub App (not a personal user).

---

### User Story 2 - Secure Credential Storage (Priority: P2)

As a security administrator, I need GitHub App credentials stored securely in Azure Key Vault rather than in Kubernetes secrets or environment variables, so that credentials are centrally managed, auditable, and can be rotated without redeploying workloads.

**Why this priority**: Secure credential management is essential for compliance and operational security. Storing credentials in Key Vault enables audit logging, access policies, and centralized rotation.

**Independent Test**: Can be fully tested by storing credentials in Key Vault and verifying they are retrievable only by authorized identities with appropriate RBAC roles.

**Acceptance Scenarios**:

1. **Given** a GitHub App private key, **When** it is stored in Key Vault, **Then** the secret is encrypted at rest and access is logged.

2. **Given** credentials stored in Key Vault, **When** an unauthorized identity attempts access, **Then** the request is denied and logged.

3. **Given** credentials stored in Key Vault, **When** the managed identity with Key Vault Secrets User role attempts access, **Then** the credentials are returned successfully.

---

### User Story 3 - Kubernetes CSI Driver Integration (Priority: P3)

As a platform engineer, I need GitHub App credentials mounted into pods via the Secrets Store CSI Driver, so that credentials appear as files in the pod filesystem without being stored as Kubernetes secrets.

**Why this priority**: CSI Driver integration provides the bridge between Key Vault and Kubernetes, enabling secure credential delivery without intermediate storage in etcd.

**Independent Test**: Can be fully tested by deploying a pod with a SecretProviderClass and verifying the credentials appear as mounted files at the expected path.

**Acceptance Scenarios**:

1. **Given** a SecretProviderClass configured for the GitHub App secrets, **When** a pod is deployed with the CSI volume, **Then** credentials are mounted at the specified path.

2. **Given** mounted credentials, **When** the GitHub CLI reads the private key file, **Then** authentication succeeds.

3. **Given** a pod with CSI-mounted secrets, **When** the pod is deleted and recreated, **Then** the secrets are remounted without manual intervention.

---

### Edge Cases

- What happens when the GitHub App private key is rotated in Key Vault?
  - Pods must be restarted or use CSI driver sync to pick up new credentials.

- What happens when the GitHub App is uninstalled from a repository?
  - Operations on that repository fail with clear error messages indicating missing permissions.

- What happens when the GitHub App installation token expires?
  - The agent must regenerate tokens before each operation or handle 401 responses by refreshing.

- What happens when Key Vault is temporarily unavailable?
  - Pod startup fails if secrets cannot be mounted; running pods continue with cached credentials.

- What happens when the App ID secret is missing but private key exists (or vice versa)?
  - Authentication fails with a descriptive error indicating which credential is missing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a GitHub App in the ii-us organization with appropriate permissions for repository operations.
- **FR-002**: System MUST configure GitHub App with Contents (Read/Write) permission to enable code access.
- **FR-003**: System MUST configure GitHub App with Pull Requests (Read/Write) permission to enable PR creation and management.
- **FR-004**: System MUST configure GitHub App with Issues (Read/Write) permission to enable issue tracking integration.
- **FR-005**: System MUST configure GitHub App with Metadata (Read) permission for repository discovery.
- **FR-006**: System MUST generate and securely download a private key for the GitHub App.
- **FR-007**: System MUST install the GitHub App on target repositories in the organization.
- **FR-008**: System MUST store the GitHub App ID in Azure Key Vault as a secret.
- **FR-009**: System MUST store the GitHub App private key in Azure Key Vault as a secret.
- **FR-010**: System MUST NOT store GitHub App credentials in version control, Kubernetes secrets, or environment variables.
- **FR-011**: System MUST enable retrieval of credentials by workloads with the Key Vault Secrets User role.

### Key Entities

- **GitHub App**: Application identity registered with GitHub that can authenticate on behalf of an installation. Key attributes: App ID, private key, installation ID, configured permissions.
- **Key Vault Secret**: Encrypted credential stored in Azure Key Vault. Each secret has a name, value, version, and access policy.
- **SecretProviderClass**: Kubernetes custom resource that defines which Key Vault secrets to mount and where. Links Key Vault to CSI Driver.
- **Installation Access Token**: Short-lived token generated from App credentials that authorizes API calls. Expires after 1 hour.

### Assumptions

- The Azure Key Vault `iius-akv` already exists and is accessible.
- The managed identity `claude-agent-identity` has been granted Key Vault Secrets User role (Sprint 1).
- The Secrets Store CSI Driver is enabled on the AKS cluster (Sprint 1).
- The user has GitHub organization admin access to create Apps.
- Target repositories are within the ii-us GitHub organization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: GitHub App credentials can be retrieved from Key Vault within 5 seconds of pod startup.
- **SC-002**: 100% of GitHub API operations use App-based authentication (no personal access tokens).
- **SC-003**: Credentials are stored in exactly one location (Key Vault) with no copies in Kubernetes secrets or config files.
- **SC-004**: GitHub operations succeed on first attempt after pod deployment without manual credential configuration.
- **SC-005**: Credential access is auditable through Key Vault diagnostic logs showing which identity accessed which secret.
- **SC-006**: Installation access tokens can be generated programmatically without human intervention.
