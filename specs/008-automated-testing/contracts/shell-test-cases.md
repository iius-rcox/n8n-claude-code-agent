# Shell Script Test Cases

**Feature**: 008-automated-testing
**Date**: 2026-01-15

## check-auth.sh Test Cases

### TC-AUTH-001: Success Path
**Given**: Claude CLI returns exit code 0
**When**: `check-auth.sh` executes
**Then**:
- Exit code is 0
- Message contains "SUCCESS"
- `notify.sh` is NOT called

### TC-AUTH-002: Auth Failure Path
**Given**: Claude CLI returns non-zero exit code
**When**: `check-auth.sh` executes
**Then**:
- Exit code is 57
- `notify.sh` IS called with "Authentication Failed" title
- Message contains "FAILED"

### TC-AUTH-003: Timeout Path
**Given**: Claude CLI exceeds AUTH_CHECK_TIMEOUT
**When**: `check-auth.sh` executes
**Then**:
- Exit code is 57 (treated as auth failure)
- `notify.sh` IS called
- Temp file is cleaned up

### TC-AUTH-004: Missing Webhook URL
**Given**: TEAMS_WEBHOOK_URL is not set
**And**: Claude CLI returns non-zero exit code
**When**: `check-auth.sh` executes
**Then**:
- Exit code is 57
- Warning message about missing webhook
- `notify.sh` NOT called (or called but handles gracefully)

## notify.sh Test Cases

### TC-NOTIFY-001: Success Path
**Given**: TEAMS_WEBHOOK_URL is set to valid URL
**And**: curl returns HTTP 200
**When**: `notify.sh "Title" "Message"` executes
**Then**:
- Exit code is 0
- Message contains "successfully"
- curl called with correct payload structure

### TC-NOTIFY-002: Missing Arguments
**Given**: TEAMS_WEBHOOK_URL is set
**When**: `notify.sh` called without arguments
**Then**:
- Exit code is 0 (graceful handling)
- Default values used for title/message

### TC-NOTIFY-003: Missing Webhook URL
**Given**: TEAMS_WEBHOOK_URL is NOT set
**When**: `notify.sh "Title" "Message"` executes
**Then**:
- Exit code is 0 (graceful)
- Warning message logged
- No curl call attempted

### TC-NOTIFY-004: Webhook Failure
**Given**: TEAMS_WEBHOOK_URL is set
**And**: curl returns non-200 status
**When**: `notify.sh "Title" "Message"` executes
**Then**:
- Exit code is 0 (graceful - don't fail the caller)
- Warning message about failed notification

## Mock Requirements

### Claude CLI Mock
| Scenario | Exit Code | stdout | stderr |
|----------|-----------|--------|--------|
| Auth success | 0 | "auth test response" | "" |
| Auth failure | 1 | "" | "authentication error" |
| Timeout | 124 | "" | "timeout" |

### curl Mock
| Scenario | Exit Code | stdout | stderr |
|----------|-----------|--------|--------|
| HTTP 200 | 0 | "" | "" |
| HTTP 400 | 0 | "Bad Request" | "" |
| Network error | 7 | "" | "connection refused" |

## Environment Variables

| Variable | Purpose | Test Values |
|----------|---------|-------------|
| TEAMS_WEBHOOK_URL | Teams webhook URL | "https://mock.webhook.url" |
| POD_NAME | Pod identifier | "test-pod-123" |
| AUTH_CHECK_TIMEOUT | Timeout in seconds | 5, 30 |
