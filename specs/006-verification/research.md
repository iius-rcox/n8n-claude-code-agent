# Research: Verification

**Feature**: 006-verification
**Date**: 2026-01-15
**Purpose**: Research best practices for verification test design and execution

---

## R1: Azure Workload Identity Verification Best Practices

**Decision**: Use `az login --identity --allow-no-subscriptions` for authentication test, then `az storage container list` for authorization test

**Rationale**:
- The `--allow-no-subscriptions` flag prevents errors when the identity has resource-level RBAC but no subscription-level role
- Testing container list (not just blob read) verifies the Storage Blob Data Contributor role is correctly scoped
- This matches the Microsoft documentation for Workload Identity verification

**Alternatives Considered**:
- `az account get-access-token`: Only tests authentication, not authorization to specific resources
- Direct blob upload test: More complex, leaves test artifacts that need cleanup

---

## R2: Claude CLI Verification Best Practices

**Decision**: Execute a simple prompt that returns a predictable response (e.g., "Say 'Claude Max auth working'")

**Rationale**:
- A simple echo-style prompt minimizes token usage and execution time
- Predictable output makes verification scripting easier
- Tests the full authentication chain (session tokens → Claude API)

**Alternatives Considered**:
- `claude --version`: Only tests CLI installation, not authentication
- Complex prompt: Uses more tokens, takes longer, harder to verify output

---

## R3: CSI Driver Secret Verification Best Practices

**Decision**: Use `ls -la /secrets/github/` to verify files exist, then `cat /secrets/github/app-id` to verify content

**Rationale**:
- File presence confirms CSI driver mounted successfully
- Content verification confirms Key Vault integration is working
- Reading App ID (not private key) is safer for logs/output

**Alternatives Considered**:
- Only check file existence: Doesn't verify content was retrieved from Key Vault
- Verify private key content: Security risk if logged/displayed

---

## R4: NetworkPolicy Verification Best Practices

**Decision**: Verify policy count and test DNS resolution as functional proof

**Rationale**:
- Counting policies (expect 4) catches missing or extra policies
- DNS resolution test proves allow-dns policy works while default-deny blocks other traffic
- External IP connectivity test would prove allow-azure-egress but is more complex to verify

**Alternatives Considered**:
- Test all egress rules individually: Too complex for verification phase
- Only count policies: Doesn't prove policies are functioning

---

## R5: HTTP Health Endpoint Verification Best Practices

**Decision**: Use `curl -s http://localhost:3000/health` from within the pod

**Rationale**:
- localhost access doesn't require NetworkPolicy exceptions
- Silent mode (`-s`) provides clean output for verification
- JSON response can be parsed to verify structure

**Alternatives Considered**:
- External service access: Requires port-forward or ingress setup
- kubectl port-forward: Adds complexity, tests from outside pod

---

## R6: Test Output Format

**Decision**: Each test outputs a clear PASS/FAIL status with captured output for troubleshooting

**Rationale**:
- Binary pass/fail makes automation possible in future
- Captured output enables troubleshooting without re-running tests
- Consistent format across all tests

**Format**:
```
Test: [Test Name]
Command: [command executed]
Expected: [expected result]
Actual: [actual result]
Status: PASS | FAIL
```

---

## R7: Test Execution Order

**Decision**: Execute tests in dependency order: NetworkPolicies → Azure Identity → Claude Auth → GitHub CSI → HTTP Health

**Rationale**:
- NetworkPolicies must work for any egress (Azure, Claude API calls)
- Azure Identity must work before testing storage access
- Claude auth depends on network egress to Claude API
- CSI secrets depend on Azure identity for Key Vault access
- HTTP health is independent but tested last as it's the integration point

---

## R8: Idempotency and Non-Destructive Tests

**Decision**: All tests must be read-only and re-runnable without side effects

**Rationale**:
- Verification should not modify system state
- Tests may need to be re-run during troubleshooting
- No cleanup required after test execution

**Tests Verified as Non-Destructive**:
- `az login --identity`: Creates token cache only (inside pod, ephemeral)
- `az storage container list`: Read-only operation
- `claude -p "..."`: Executes prompt but doesn't modify files
- `ls`, `cat`: Read-only file operations
- `curl`: Read-only HTTP request
- `kubectl get/describe`: Read-only cluster queries

---

## Summary

All research items resolved. Key findings:
1. Use `--allow-no-subscriptions` for Workload Identity test
2. Simple echo prompts for Claude verification
3. Test DNS as functional proof of NetworkPolicies
4. All tests are non-destructive and idempotent
5. Execute in dependency order for meaningful failure isolation
