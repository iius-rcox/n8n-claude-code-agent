#!/bin/bash
#
# Mock curl for BATS Testing
#
# This script simulates curl behavior for testing notify.sh.
# Control behavior via environment variables:
#
#   MOCK_CURL_EXIT_CODE   - Exit code to return (default: 0)
#   MOCK_CURL_HTTP_CODE   - HTTP status code to return (default: 200)
#   MOCK_CURL_OUTPUT      - Response body (default: "")
#   MOCK_CURL_STDERR      - stderr output (default: "")
#   MOCK_CURL_LOG_FILE    - File to log curl arguments to (optional)
#
# Usage in BATS tests:
#   export PATH="$BATS_TEST_DIRNAME/../mocks:$PATH"
#   export MOCK_CURL_HTTP_CODE=200
#   run notify.sh "Title" "Message"
#

# Log arguments if log file specified
if [ -n "$MOCK_CURL_LOG_FILE" ]; then
    echo "curl $*" >> "$MOCK_CURL_LOG_FILE"
fi

# Parse -w flag to handle HTTP code output
for arg in "$@"; do
    if [[ "$arg" == *"%{http_code}"* ]]; then
        # Output HTTP code
        echo "${MOCK_CURL_HTTP_CODE:-200}"
    fi
done

# Output response body
if [ -n "$MOCK_CURL_OUTPUT" ]; then
    echo "$MOCK_CURL_OUTPUT"
fi

# Output to stderr
if [ -n "$MOCK_CURL_STDERR" ]; then
    echo "$MOCK_CURL_STDERR" >&2
fi

# Exit with specified code (default 0)
exit "${MOCK_CURL_EXIT_CODE:-0}"
