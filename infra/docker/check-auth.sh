#!/bin/bash
#
# Claude Authentication Check Script
#
# Tests Claude authentication by running a simple prompt.
# On success: exits with code 0
# On failure: sends Teams notification and exits with code 57
#
# Exit Codes:
#   0  - Authentication successful
#   57 - Authentication failed (session expired)
#   1  - General error
#
# Environment Variables:
#   TEAMS_WEBHOOK_URL - Teams webhook URL for notifications (required for notifications)
#   POD_NAME - Kubernetes pod name (optional, for notification context)
#   DOCS_URL - URL to credential refresh documentation (optional)
#

set -e

SCRIPT_DIR="$(dirname "$0")"
TIMEOUT_SECONDS=${AUTH_CHECK_TIMEOUT:-30}

echo "Starting Claude authentication check..."
echo "Timeout: ${TIMEOUT_SECONDS}s"

# Run auth test with timeout
AUTH_OUTPUT=""
AUTH_EXIT_CODE=0

if timeout "${TIMEOUT_SECONDS}s" claude -p "auth test" > /tmp/auth_test_output.txt 2>&1; then
    AUTH_OUTPUT=$(cat /tmp/auth_test_output.txt)
    AUTH_EXIT_CODE=0
    echo "Authentication check passed"
else
    AUTH_EXIT_CODE=$?
    AUTH_OUTPUT=$(cat /tmp/auth_test_output.txt 2>/dev/null || echo "No output")
    echo "Authentication check failed with exit code: ${AUTH_EXIT_CODE}"
fi

# Clean up temp file
rm -f /tmp/auth_test_output.txt

# Check if auth succeeded
if [ "$AUTH_EXIT_CODE" -eq 0 ]; then
    echo "Claude authentication: SUCCESS"
    exit 0
fi

# Authentication failed - send notification if webhook is configured
echo "Claude authentication: FAILED"
echo "Output: ${AUTH_OUTPUT}"

if [ -n "$TEAMS_WEBHOOK_URL" ]; then
    echo "Sending Teams notification..."
    if [ -x "${SCRIPT_DIR}/notify.sh" ]; then
        "${SCRIPT_DIR}/notify.sh" "Authentication Failed" "Claude session tokens have expired and need to be refreshed." || true
    else
        echo "Warning: notify.sh not found or not executable"
    fi
else
    echo "Warning: TEAMS_WEBHOOK_URL not set, skipping notification"
fi

# Exit with auth failure code
exit 57
