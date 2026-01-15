# Research: Teams Prompting

**Feature**: 007-teams-prompting
**Date**: 2026-01-15

## Research Topics

### 1. Microsoft Teams Incoming Webhook Creation

**Decision**: Use Power Automate "Post to a channel when a webhook request is received" workflow

**Rationale**:
- Microsoft deprecated legacy Office 365 Connectors in December 2024
- Power Automate workflows are the recommended replacement
- Workflows support the MessageCard format already used by `notify.sh`
- No code changes required to existing notification script

**Alternatives Considered**:
- Legacy Incoming Webhook Connector: Deprecated, will stop working
- Bot Framework: Over-engineered for simple notifications
- Azure Logic Apps: Requires separate Azure resource, additional cost

**Implementation Notes**:
1. Navigate to Teams channel → More options (⋯) → Workflows
2. Select "Post to a channel when a webhook request is received"
3. Copy the generated webhook URL
4. Store URL in Kubernetes secret

### 2. Kubernetes CronJob Best Practices

**Decision**: Use standard CronJob with `concurrencyPolicy: Forbid` and `startingDeadlineSeconds: 300`

**Rationale**:
- `concurrencyPolicy: Forbid` prevents overlapping job runs (critical for auth checks)
- `startingDeadlineSeconds: 300` (5 minutes) allows for scheduling delays without skipping checks
- `backoffLimit: 0` ensures no retries on failure (notification already sent)
- `restartPolicy: Never` required for Jobs

**Alternatives Considered**:
- `concurrencyPolicy: Replace`: Would terminate running job, could miss auth failures
- `concurrencyPolicy: Allow`: Could create resource contention
- No startingDeadlineSeconds: Would skip jobs on any delay

**Implementation Notes**:
- Schedule: `*/30 * * * *` (every 30 minutes)
- Must match main deployment's security context exactly
- Must mount same volumes (claude-session, claude-home) for auth check to work
- History limits: `successfulJobsHistoryLimit: 3`, `failedJobsHistoryLimit: 3`

### 3. CronJob Security Context

**Decision**: Replicate exact security context from main deployment

**Rationale**:
- CronJob runs the same container image with same scripts
- Security policies (NetworkPolicy, PodSecurityPolicy/Standards) apply per namespace
- Inconsistent security context could cause permission errors

**Configuration (from deployment.yaml)**:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault

containerSecurityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
```

### 4. n8n HTTP Request Integration

**Decision**: Use HTTP Request node with POST to ClusterIP service

**Rationale**:
- n8n already has NetworkPolicy allowing egress to claude-agent namespace
- ClusterIP service (`claude-agent.claude-agent.svc.cluster.local`) provides stable endpoint
- HTTP Request node is native n8n functionality, no custom code needed

**Implementation Notes**:
- URL: `http://claude-agent.claude-agent.svc.cluster.local/run`
- Method: POST
- Headers: `Content-Type: application/json`
- Body: `{"prompt": "...", "timeout": 300000}`
- Timeout: Set in n8n node settings (5 minutes recommended for typical prompts)

### 5. Teams Webhook URL Security

**Decision**: Store webhook URL in Kubernetes Secret, reference via secretKeyRef

**Rationale**:
- Webhook URL is sensitive (allows posting to Teams channel)
- Already referenced in deployment.yaml as `teams-webhook` secret
- No code changes needed - existing pattern in place

**Implementation Notes**:
- Secret name: `teams-webhook`
- Secret key: `url`
- Create/update command: `kubectl create secret generic teams-webhook --from-literal=url='$WEBHOOK_URL' -n claude-agent --dry-run=client -o yaml | kubectl apply -f -`

## Dependencies Verified

| Dependency | Status | Notes |
|------------|--------|-------|
| `check-auth.sh` in container | ✅ Exists | `/opt/claude-agent/check-auth.sh` |
| `notify.sh` in container | ✅ Exists | `/opt/claude-agent/notify.sh` |
| `teams-webhook` secret reference | ✅ In deployment | Line 87-91 of deployment.yaml |
| NetworkPolicy for Teams egress | ✅ allow-azure-egress | TCP 443 to any destination |
| NetworkPolicy for n8n ingress | ✅ allow-ingress-from-n8n | TCP 3000 from n8n-prod |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Teams webhook expires | Low | High | Document refresh process in quickstart.md |
| CronJob fails silently | Medium | Medium | Set `failedJobsHistoryLimit: 3` for debugging |
| Auth check times out | Low | Low | 30-second timeout in script; treated as failure |
| n8n NetworkPolicy blocks traffic | Low | High | Verified in Sprint 6; test in quickstart.md |

## Conclusion

All technical unknowns resolved. Implementation can proceed with:
1. Teams webhook creation (manual, documented in quickstart.md)
2. CronJob manifest (infra/k8s/cronjob.yaml)
3. Verification steps (quickstart.md)
